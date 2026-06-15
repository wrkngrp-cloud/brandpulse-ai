import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { callAi } from '@/lib/ai/client'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

// ── Fuzzy helpers ────────────────────────────────────────────────────────────

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function fuzzyMatch(input: string, candidates: string[]): string | null {
  const n = normalise(input)
  const exact = candidates.find(c => normalise(c) === n)
  if (exact) return exact
  const contains = candidates.find(c => normalise(c).includes(n) || n.includes(normalise(c)))
  return contains ?? null
}

// ── Slug generator ───────────────────────────────────────────────────────────

function makeVanitySlug(publication: string, editionDate: string): string {
  const pubSlug = publication
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 20)
  const dateSlug = editionDate.replace(/-/g, '').slice(0, 8)
  const random = Math.random().toString(36).slice(2, 6)
  return `print-${pubSlug}-${dateSlug}-${random}`
}

// ── Column mapper via Claude ─────────────────────────────────────────────────

async function mapColumns(
  type: string,
  actualHeaders: string[],
  expectedHeaders: string[],
): Promise<Record<string, string>> {
  const prompt = `You are a media plan data import assistant.

The user uploaded a "${type}" media plan spreadsheet with these column headers:
${JSON.stringify(actualHeaders)}

The expected columns are:
${JSON.stringify(expectedHeaders)}

Return a JSON object mapping each expected column name to the actual column header that best matches it.
If an expected column cannot be matched, map it to null.
Return ONLY valid JSON, no explanation.`

  try {
    const result = await callAi({
      tier: 'cultural',
      system: 'You map spreadsheet column headers to a canonical schema. Output only JSON.',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 512,
    })
    return JSON.parse(result) as Record<string, string>
  } catch {
    // Fallback: identity mapping
    const map: Record<string, string> = {}
    expectedHeaders.forEach(h => { map[h] = h })
    return map
  }
}

// ── Row parsers ──────────────────────────────────────────────────────────────

function parseDate(val: ExcelJS.CellValue): string | null {
  if (!val) return null
  if (val instanceof Date) return val.toISOString().slice(0, 10)
  if (typeof val === 'string') {
    const d = new Date(val)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }
  if (typeof val === 'number') {
    // Excel serial date
    const d = new Date((val - 25569) * 86400 * 1000)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }
  return null
}

function parseNum(val: ExcelJS.CellValue): number | null {
  if (val === null || val === undefined || val === '') return null
  const n = typeof val === 'object' && 'result' in (val as object)
    ? (val as ExcelJS.CellFormulaValue).result
    : val
  const parsed = parseFloat(String(n))
  return isNaN(parsed) ? null : parsed
}

function parseStr(val: ExcelJS.CellValue): string | null {
  if (val === null || val === undefined) return null
  const s = typeof val === 'object' && 'result' in (val as object)
    ? String((val as ExcelJS.CellFormulaValue).result)
    : String(val)
  return s.trim() || null
}

function cellValue(row: ExcelJS.Row, col: number): ExcelJS.CellValue {
  return row.getCell(col).value
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: brand } = await supabase
    .from('brands').select('id').limit(1).single()
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 400 })

  // Parse multipart form
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  const type = formData.get('type') as string | null
  const campaignId = formData.get('campaign_id') as string | null

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  }
  if (!type || !['radio', 'tv', 'print'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type. Must be radio, tv, or print.' }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File exceeds 5 MB limit' }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(arrayBuffer)
  } catch {
    return NextResponse.json({ error: 'Could not parse file. Make sure it is a valid .xlsx file.' }, { status: 400 })
  }

  // Find first non-hidden, non-lists sheet
  const ws = wb.worksheets.find(
    s => s.state !== 'hidden' && s.state !== 'veryHidden' && s.name !== 'Lists' && s.name !== 'Instructions'
  )
  if (!ws) {
    return NextResponse.json({ error: 'No data sheet found in the workbook.' }, { status: 400 })
  }

  // Read header row (row 2 for BrandPulse templates, row 1 for generic)
  const firstRow = ws.getRow(1)
  const secondRow = ws.getRow(2)
  const headerRowIndex = String(secondRow.getCell(1).value ?? '').length > 0 &&
    String(firstRow.getCell(1).value ?? '').toLowerCase().includes('brandpulse')
    ? 2
    : 1

  const actualHeaders: string[] = []
  ws.getRow(headerRowIndex).eachCell({ includeEmpty: false }, cell => {
    actualHeaders.push(String(cell.value ?? '').trim())
  })

  const svc = await createServiceClient()

  const errors: string[] = []
  const warnings: string[] = []
  let imported = 0

  // ── RADIO ─────────────────────────────────────────────────────────────────
  if (type === 'radio') {
    const expected = ['Station', 'Daypart', 'Spot Date', 'Spot Time', 'Duration (sec)',
      'Spots Planned', 'Spots Aired', 'Material Name', 'Rate Card (₦)', 'Discount %',
      'Net Cost (₦)', 'Status', 'Notes']

    const colMap = await mapColumns('radio', actualHeaders, expected)

    const { data: stations } = await svc
      .from('radio_stations').select('id, name')
    const stationNames = (stations ?? []).map(s => s.name)

    const DAYPART_MAP: Record<string, string> = {
      'Early Morning (5-7am)': 'early_morning',
      'Morning Drive (7-10am)': 'morning_drive',
      'Daytime (10am-3pm)': 'daytime',
      'Afternoon Drive (3-7pm)': 'afternoon_drive',
      'Evening (7-10pm)': 'evening',
      'Late Night (10pm-5am)': 'late_night',
    }

    const STATUS_MAP: Record<string, string> = {
      'Scheduled': 'scheduled', 'Aired': 'aired',
      'Missed': 'missed', 'Make-good': 'make_good',
    }

    const idxOf = (name: string) => {
      const mapped = colMap[name]
      if (!mapped) return -1
      return actualHeaders.findIndex(h => h === mapped) + 1
    }

    const rows: object[] = []

    ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (rowNum <= headerRowIndex) return

      const stationRaw = parseStr(cellValue(row, idxOf('Station')))
      if (!stationRaw) return

      const spotDate = parseDate(cellValue(row, idxOf('Spot Date')))
      if (!spotDate) { errors.push(`Row ${rowNum}: invalid or missing Spot Date`); return }

      const durationRaw = parseNum(cellValue(row, idxOf('Duration (sec)')))
      const duration = durationRaw ?? 30
      if (![10, 15, 30, 45, 60].includes(duration)) {
        warnings.push(`Row ${rowNum}: invalid duration ${duration}, defaulted to 30`)
      }

      const matchedStation = fuzzyMatch(stationRaw, stationNames)
      if (!matchedStation) {
        warnings.push(`Row ${rowNum}: station "${stationRaw}" not in reference list — imported as-is`)
      }

      const stationId = matchedStation
        ? (stations ?? []).find(s => s.name === matchedStation)?.id ?? null
        : null

      const daypartRaw = parseStr(cellValue(row, idxOf('Daypart'))) ?? ''
      const daypart = DAYPART_MAP[daypartRaw] ?? 'daytime'

      const statusRaw = parseStr(cellValue(row, idxOf('Status'))) ?? 'Scheduled'
      const status = STATUS_MAP[statusRaw] ?? 'scheduled'

      rows.push({
        brand_id:     brand.id,
        campaign_id:  campaignId || null,
        station_id:   stationId,
        station_name: matchedStation ?? stationRaw,
        daypart,
        spot_date:    spotDate,
        spot_time:    parseStr(cellValue(row, idxOf('Spot Time'))),
        duration_sec: [10, 15, 30, 45, 60].includes(duration) ? duration : 30,
        spots_planned: Math.max(1, parseNum(cellValue(row, idxOf('Spots Planned'))) ?? 1),
        spots_aired:  parseNum(cellValue(row, idxOf('Spots Aired'))),
        material_name: parseStr(cellValue(row, idxOf('Material Name'))),
        rate_card:    parseNum(cellValue(row, idxOf('Rate Card (₦)'))),
        discount_pct: parseNum(cellValue(row, idxOf('Discount %'))) ?? 0,
        net_cost:     parseNum(cellValue(row, idxOf('Net Cost (₦)'))),
        status,
        notes:        parseStr(cellValue(row, idxOf('Notes'))),
      })
    })

    if (rows.length > 0) {
      const { error } = await svc.from('radio_schedules').insert(rows)
      if (error) {
        return NextResponse.json({ error: `Database insert failed: ${error.message}` }, { status: 500 })
      }
      imported = rows.length
    }
  }

  // ── TV ────────────────────────────────────────────────────────────────────
  else if (type === 'tv') {
    const expected = ['Channel', 'Programme/Show', 'Daypart', 'Spot Date', 'TX Time',
      'Duration (sec)', 'Spots Planned', 'Spots Aired', 'GRP (estimated)', 'Material Name',
      'Rate Card (₦)', 'Discount %', 'Net Cost (₦)', 'Status', 'Notes']

    const colMap = await mapColumns('tv', actualHeaders, expected)

    const { data: channels } = await svc
      .from('tv_channels').select('id, name')
    const channelNames = (channels ?? []).map(c => c.name)

    const DAYPART_MAP: Record<string, string> = {
      'Breakfast (6-9am)': 'breakfast',
      'Daytime (9am-5pm)': 'daytime',
      'Early Fringe (5-7pm)': 'early_fringe',
      'Prime Time (7-10pm)': 'prime_time',
      'Late Fringe (10pm-midnight)': 'late_fringe',
    }

    const STATUS_MAP: Record<string, string> = {
      'Scheduled': 'scheduled', 'Aired': 'aired',
      'Missed': 'missed', 'Make-good': 'make_good',
    }

    const idxOf = (name: string) => {
      const mapped = colMap[name]
      if (!mapped) return -1
      return actualHeaders.findIndex(h => h === mapped) + 1
    }

    const rows: object[] = []

    ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (rowNum <= headerRowIndex) return

      const channelRaw = parseStr(cellValue(row, idxOf('Channel')))
      if (!channelRaw) return

      const spotDate = parseDate(cellValue(row, idxOf('Spot Date')))
      if (!spotDate) { errors.push(`Row ${rowNum}: invalid or missing Spot Date`); return }

      const durationRaw = parseNum(cellValue(row, idxOf('Duration (sec)')))
      const duration = durationRaw ?? 30

      const matchedChannel = fuzzyMatch(channelRaw, channelNames)
      if (!matchedChannel) {
        warnings.push(`Row ${rowNum}: channel "${channelRaw}" not in reference list — imported as-is`)
      }

      const channelId = matchedChannel
        ? (channels ?? []).find(c => c.name === matchedChannel)?.id ?? null
        : null

      const daypartRaw = parseStr(cellValue(row, idxOf('Daypart'))) ?? ''
      const daypart = DAYPART_MAP[daypartRaw] ?? 'prime_time'

      const statusRaw = parseStr(cellValue(row, idxOf('Status'))) ?? 'Scheduled'
      const status = STATUS_MAP[statusRaw] ?? 'scheduled'

      rows.push({
        brand_id:      brand.id,
        campaign_id:   campaignId || null,
        channel_id:    channelId,
        channel_name:  matchedChannel ?? channelRaw,
        programme:     parseStr(cellValue(row, idxOf('Programme/Show'))),
        daypart,
        spot_date:     spotDate,
        tx_time:       parseStr(cellValue(row, idxOf('TX Time'))),
        duration_sec:  [10, 15, 30, 45, 60].includes(duration) ? duration : 30,
        spots_planned: Math.max(1, parseNum(cellValue(row, idxOf('Spots Planned'))) ?? 1),
        spots_aired:   parseNum(cellValue(row, idxOf('Spots Aired'))),
        grp_planned:   parseNum(cellValue(row, idxOf('GRP (estimated)'))),
        material_name: parseStr(cellValue(row, idxOf('Material Name'))),
        rate_card:     parseNum(cellValue(row, idxOf('Rate Card (₦)'))),
        discount_pct:  parseNum(cellValue(row, idxOf('Discount %'))) ?? 0,
        net_cost:      parseNum(cellValue(row, idxOf('Net Cost (₦)'))),
        status,
        notes:         parseStr(cellValue(row, idxOf('Notes'))),
      })
    })

    if (rows.length > 0) {
      const { error } = await svc.from('tv_schedules').insert(rows)
      if (error) {
        return NextResponse.json({ error: `Database insert failed: ${error.message}` }, { status: 500 })
      }
      imported = rows.length
    }
  }

  // ── PRINT ─────────────────────────────────────────────────────────────────
  else if (type === 'print') {
    const expected = ['Publication', 'Edition Date', 'Position', 'Size', 'Colour',
      'Insertions', 'Rate Card (₦)', 'Discount %', 'Net Cost (₦)',
      'Attribution URL', 'Status', 'Notes']

    const colMap = await mapColumns('print', actualHeaders, expected)

    const { data: publications } = await svc
      .from('print_publications').select('id, name')
    const pubNames = (publications ?? []).map(p => p.name)

    const POSITION_MAP: Record<string, string> = {
      'Front Page': 'front_page', 'Back Page': 'back_page',
      'Page 3': 'page_3', 'ROP Interior': 'rop_interior',
      'Centrespread': 'centrespread',
    }

    const SIZE_MAP: Record<string, string> = {
      'Full Page': 'full_page', 'Half Page': 'half_page',
      'Quarter Page': 'quarter_page', 'Strip': 'strip', 'Jacket': 'jacket',
    }

    const COLOUR_MAP: Record<string, string> = {
      'Full Colour': 'full_colour', 'Black & White': 'black_white',
    }

    const STATUS_MAP: Record<string, string> = {
      'Scheduled': 'scheduled', 'Published': 'published', 'Cancelled': 'cancelled',
    }

    const idxOf = (name: string) => {
      const mapped = colMap[name]
      if (!mapped) return -1
      return actualHeaders.findIndex(h => h === mapped) + 1
    }

    const rows: object[] = []

    ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (rowNum <= headerRowIndex) return

      const pubRaw = parseStr(cellValue(row, idxOf('Publication')))
      if (!pubRaw) return

      const editionDate = parseDate(cellValue(row, idxOf('Edition Date')))
      if (!editionDate) { errors.push(`Row ${rowNum}: invalid or missing Edition Date`); return }

      const matchedPub = fuzzyMatch(pubRaw, pubNames)
      if (!matchedPub) {
        warnings.push(`Row ${rowNum}: publication "${pubRaw}" not in reference list — imported as-is`)
      }

      const pubId = matchedPub
        ? (publications ?? []).find(p => p.name === matchedPub)?.id ?? null
        : null

      const positionRaw = parseStr(cellValue(row, idxOf('Position'))) ?? 'ROP Interior'
      const position = POSITION_MAP[positionRaw] ?? 'rop_interior'

      const sizeRaw = parseStr(cellValue(row, idxOf('Size'))) ?? 'Full Page'
      const size = SIZE_MAP[sizeRaw] ?? 'full_page'

      const colourRaw = parseStr(cellValue(row, idxOf('Colour'))) ?? 'Full Colour'
      const colour = COLOUR_MAP[colourRaw] ?? 'full_colour'

      const statusRaw = parseStr(cellValue(row, idxOf('Status'))) ?? 'Scheduled'
      const status = STATUS_MAP[statusRaw] ?? 'scheduled'

      const attributionUrl = parseStr(cellValue(row, idxOf('Attribution URL')))
      const vanitySlug = attributionUrl ? makeVanitySlug(matchedPub ?? pubRaw, editionDate) : null

      rows.push({
        brand_id:         brand.id,
        campaign_id:      campaignId || null,
        publication_id:   pubId,
        publication_name: matchedPub ?? pubRaw,
        edition_date:     editionDate,
        position,
        size,
        colour,
        rate_card:        parseNum(cellValue(row, idxOf('Rate Card (₦)'))),
        discount_pct:     parseNum(cellValue(row, idxOf('Discount %'))) ?? 0,
        net_cost:         parseNum(cellValue(row, idxOf('Net Cost (₦)'))),
        insertions:       Math.max(1, parseNum(cellValue(row, idxOf('Insertions'))) ?? 1),
        attribution_url:  attributionUrl,
        vanity_slug:      vanitySlug,
        status,
        notes:            parseStr(cellValue(row, idxOf('Notes'))),
      })
    })

    if (rows.length > 0) {
      const { error } = await svc.from('print_placements').insert(rows)
      if (error) {
        return NextResponse.json({ error: `Database insert failed: ${error.message}` }, { status: 500 })
      }
      imported = rows.length
    }
  }

  return NextResponse.json({ imported, errors, warnings })
}
