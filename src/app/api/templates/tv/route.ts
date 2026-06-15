import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

const TV_CHANNELS = [
  'NTA 1', 'NTA 2', 'NTA Lagos', 'NTA Abuja', 'NTA Ibadan', 'NTA Kano',
  'AIT', 'Channels TV', 'TVC', 'Silverbird TV', 'Galaxy TV', 'MITV',
  'Rave TV', 'Wazobia TV',
  'Africa Magic', 'Africa Magic Urban', 'Africa Magic Epic',
  'CNN International', 'MTV Base', 'SoundCity', 'Telemundo', 'M-Net',
  'SuperSport', 'E! Entertainment', 'Zee World', 'EbonyLife TV',
  'Discovery Channel', 'National Geographic',
  'Pearl Music TV', 'Nollywood Movies',
]

const DAYPARTS = [
  'Breakfast (6-9am)',
  'Daytime (9am-5pm)',
  'Early Fringe (5-7pm)',
  'Prime Time (7-10pm)',
  'Late Fringe (10pm-midnight)',
]

const STATUSES = ['Scheduled', 'Aired', 'Missed', 'Make-good']
const DURATIONS = ['10', '15', '30', '45', '60']

export async function GET() {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'BrandPulse AI'
  wb.created = new Date()

  // ── Hidden lists sheet ──────────────────────────────────────────────────
  const lists = wb.addWorksheet('Lists')
  lists.state = 'veryHidden'
  TV_CHANNELS.forEach((c, i) => {
    lists.getCell(i + 1, 1).value = c
  })

  // ── TV Buy Plan sheet ───────────────────────────────────────────────────
  const ws = wb.addWorksheet('TV Buy Plan')

  // Title row
  ws.mergeCells('A1:O1')
  const titleCell = ws.getCell('A1')
  titleCell.value = 'BrandPulse TV Buy Template'
  titleCell.font = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF3FF' } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 30

  // Header row
  const headers = [
    'Channel', 'Programme/Show', 'Daypart', 'Spot Date', 'TX Time',
    'Duration (sec)', 'Spots Planned', 'Spots Aired', 'GRP (estimated)',
    'Material Name', 'Rate Card (₦)', 'Discount %', 'Net Cost (₦)',
    'Status', 'Notes',
  ]
  const headerRow = ws.getRow(2)
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = h
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })
  headerRow.height = 22

  // Column widths
  ws.columns = [
    { width: 22 }, // Channel
    { width: 22 }, // Programme
    { width: 24 }, // Daypart
    { width: 15 }, // Spot Date
    { width: 12 }, // TX Time
    { width: 14 }, // Duration
    { width: 14 }, // Spots Planned
    { width: 12 }, // Spots Aired
    { width: 16 }, // GRP
    { width: 20 }, // Material Name
    { width: 16 }, // Rate Card
    { width: 12 }, // Discount %
    { width: 16 }, // Net Cost
    { width: 12 }, // Status
    { width: 30 }, // Notes
  ]

  // Data rows (3-102)
  for (let row = 3; row <= 102; row++) {
    ws.getCell(row, 4).numFmt = 'DD-MMM-YYYY'
    // Net Cost: Rate Card * (1 - Discount%/100) * Spots Planned
    ws.getCell(row, 13).value = { formula: `=IF(K${row}="","",K${row}*(1-L${row}/100)*G${row})` }
    ws.getCell(row, 13).numFmt = '#,##0.00'
    ws.getCell(row, 11).numFmt = '#,##0.00'
  }

  // Data validations — dataValidations exists at runtime but is missing from ExcelJS TS types
  type WsWithValidations = typeof ws & { dataValidations: { add(ref: string, rule: object): void } }
  const wsv = ws as WsWithValidations

  wsv.dataValidations.add(`A3:A102`, {
    type: 'list',
    allowBlank: true,
    formulae: [`Lists!$A$1:$A$${TV_CHANNELS.length}`],
    showErrorMessage: true,
    errorStyle: 'warning',
    errorTitle: 'Unknown channel',
    error: 'Select from the list or type the exact channel name.',
  })

  wsv.dataValidations.add('C3:C102', {
    type: 'list',
    allowBlank: true,
    formulae: [`"${DAYPARTS.join(',')}"`],
    showErrorMessage: true,
    errorStyle: 'warning',
    errorTitle: 'Invalid daypart',
    error: 'Please select a valid daypart.',
  })

  wsv.dataValidations.add('F3:F102', {
    type: 'list',
    allowBlank: true,
    formulae: [`"${DURATIONS.join(',')}"`],
    showErrorMessage: true,
    errorStyle: 'warning',
    errorTitle: 'Invalid duration',
    error: 'Duration must be 10, 15, 30, 45, or 60 seconds.',
  })

  wsv.dataValidations.add('N3:N102', {
    type: 'list',
    allowBlank: true,
    formulae: [`"${STATUSES.join(',')}"`],
    showErrorMessage: true,
    errorStyle: 'warning',
    errorTitle: 'Invalid status',
    error: 'Please select a valid status.',
  })

  // Freeze top 2 rows
  ws.views = [{ state: 'frozen', ySplit: 2, xSplit: 0, topLeftCell: 'A3', activeCell: 'A3' }]

  // ── Instructions sheet ──────────────────────────────────────────────────
  const inst = wb.addWorksheet('Instructions')

  const instData = [
    ['BrandPulse TV Buy Template — Instructions', ''],
    ['', ''],
    ['HOW TO USE THIS TEMPLATE', ''],
    ['', ''],
    ['1.', 'Fill in one row per TV spot booking. Each row represents a single spot or block of identical spots on the same channel/date.'],
    ['2.', 'Use dropdowns in columns A (Channel), C (Daypart), F (Duration), and N (Status).'],
    ['3.', 'Net Cost (column M) auto-calculates: Rate Card × (1 - Discount%) × Spots Planned.'],
    ['4.', 'Upload to BrandPulse via the TV Intelligence page → Upload Media Plan.'],
    ['', ''],
    ['COLUMN GUIDE', ''],
    ['', ''],
    ['Channel',          'Select the TV channel from the dropdown.'],
    ['Programme/Show',   'The programme or show during which the spot will air (e.g. "Citizen").'],
    ['Daypart',          'Select the broadcast daypart window.'],
    ['Spot Date',        'Broadcast date in DD-MMM-YYYY format.'],
    ['TX Time',          'Transmission time in HH:MM 24-hour format.'],
    ['Duration (sec)',   'Spot length in seconds.'],
    ['Spots Planned',    'Number of spots in this buy.'],
    ['Spots Aired',      'Confirmed spots delivered. Fill in after post-analysis.'],
    ['GRP (estimated)',  'Estimated Gross Rating Points for this spot/daypart.'],
    ['Material Name',    'TVC material name or version code.'],
    ['Rate Card (₦)',    'Published rate per spot in Naira.'],
    ['Discount %',       'Agency or volume discount percentage.'],
    ['Net Cost (₦)',     'Auto-calculated total net cost.'],
    ['Status',           'Scheduled / Aired / Missed / Make-good.'],
    ['Notes',            'Any additional notes.'],
  ]

  instData.forEach((row, idx) => {
    const r = inst.getRow(idx + 1)
    r.getCell(1).value = row[0]
    r.getCell(2).value = row[1]
    if (idx === 0) {
      r.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } }
    } else if (row[1] === '' && row[0] !== '' && !row[0].startsWith('•') && !row[0].match(/^\d\./)) {
      r.getCell(1).font = { bold: true, color: { argb: 'FF1E3A5F' } }
    }
  })

  inst.columns = [{ width: 20 }, { width: 80 }]

  // ── Serialize ────────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="brandpulse-tv-buy-template.xlsx"',
    },
  })
}
