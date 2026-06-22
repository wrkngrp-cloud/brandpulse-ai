import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const MAX_FILE_SIZE = 5 * 1024 * 1024

const BodySchema = z.object({
  source:      z.enum(['jumia', 'konga', 'paystack', 'flutterwave', 'manual']),
  campaign_id: z.string().uuid().optional(),
})

// ── Normalise a header string for fuzzy matching ───────────────────────────
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

// ── Map actual CSV headers to canonical column names ──────────────────────
function detectHeaders(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {}
  const candidates: Record<string, string[]> = {
    order_ref:    ['orderid', 'orderref', 'orderreference', 'ordernumber', 'ref', 'reference'],
    sold_at:      ['date', 'orderdate', 'saledate', 'createdat', 'created', 'solddate', 'soldat', 'ordertime'],
    product_name: ['product', 'productname', 'itemname', 'item', 'description', 'productdescription'],
    sku:          ['sku', 'skucode', 'productcode', 'barcode', 'itemcode'],
    units:        ['qty', 'quantity', 'units', 'quantityordered', 'qtyordered'],
    amount:       ['amount', 'price', 'total', 'netamount', 'revenue', 'saleamount', 'ordertotal', 'totalamount', 'grandtotal'],
    promo_code:   ['promocode', 'vouchercode', 'coupon', 'discountcode', 'promoкод'],
  }

  headers.forEach((h, i) => {
    const n = norm(h)
    for (const [canonical, aliases] of Object.entries(candidates)) {
      if (aliases.some(a => n === a || n.includes(a) || a.includes(n))) {
        if (!(canonical in map)) map[canonical] = i
      }
    }
  })

  return map
}

// ── Simple CSV parser (no external dependency) ────────────────────────────
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    if (!line.trim()) continue
    const cells: string[] = []
    let cur = ''
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"' && !inQuote) { inQuote = true; continue }
      if (ch === '"' && inQuote) {
        if (line[i + 1] === '"') { cur += '"'; i++; continue }
        inQuote = false; continue
      }
      if (ch === ',' && !inQuote) { cells.push(cur.trim()); cur = ''; continue }
      cur += ch
    }
    cells.push(cur.trim())
    rows.push(cells)
  }
  return rows
}

function parseDate(val: string): string | null {
  if (!val) return null
  const d = new Date(val)
  if (!isNaN(d.getTime())) return d.toISOString()
  return null
}

function parseNum(val: string): number | null {
  if (!val) return null
  const cleaned = val.replace(/[^\d.-]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file       = formData.get('file')
  const sourceRaw  = formData.get('source')
  const campaignId = formData.get('campaign_id')

  const bodyParsed = BodySchema.safeParse({
    source:      sourceRaw,
    campaign_id: campaignId || undefined,
  })
  if (!bodyParsed.success) {
    return NextResponse.json({ error: bodyParsed.error.issues[0].message }, { status: 400 })
  }

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  }
  if (!file.name.toLowerCase().endsWith('.csv')) {
    return NextResponse.json({ error: 'Only CSV files are accepted' }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File exceeds 5 MB limit' }, { status: 400 })
  }

  const { data: brand } = await supabase
    .from('brands')
    .select('id, workspace_id')
    .limit(1)
    .single()
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const text = await file.text()
  const rows = parseCSV(text)
  if (rows.length < 2) {
    return NextResponse.json({ error: 'CSV must have a header row and at least one data row' }, { status: 400 })
  }

  const headers = rows[0]
  const colMap  = detectHeaders(headers)
  const svc     = await createServiceClient()

  const records: object[] = []
  const errors:  string[] = []
  let   skipped = 0

  for (let i = 1; i < rows.length; i++) {
    const row    = rows[i]
    const rowNum = i + 1

    const amountRaw = colMap.amount != null ? row[colMap.amount] : null
    const amount    = amountRaw ? parseNum(amountRaw) : null
    if (!amount || amount <= 0) {
      skipped++
      if (amountRaw !== null && amountRaw !== undefined && amountRaw !== '') {
        errors.push(`Row ${rowNum}: invalid amount "${amountRaw}"`)
      }
      continue
    }

    records.push({
      brand_id:     brand.id,
      workspace_id: brand.workspace_id,
      campaign_id:  bodyParsed.data.campaign_id ?? null,
      source:       bodyParsed.data.source,
      order_ref:    colMap.order_ref    != null ? (row[colMap.order_ref]    || null) : null,
      product_name: colMap.product_name != null ? (row[colMap.product_name] || null) : null,
      sku:          colMap.sku          != null ? (row[colMap.sku]          || null) : null,
      units:        colMap.units        != null ? (parseNum(row[colMap.units] ?? '') ?? 1) : 1,
      amount,
      currency:     'NGN',
      promo_code:   colMap.promo_code   != null ? (row[colMap.promo_code]   || null) : null,
      sold_at:      colMap.sold_at      != null ? parseDate(row[colMap.sold_at] ?? '') : null,
    })
  }

  if (records.length === 0) {
    return NextResponse.json({ imported: 0, skipped, errors: ['No valid rows found in the file'] })
  }

  const BATCH = 500
  let imported = 0
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH)
    const { error } = await svc.from('ecommerce_sales').insert(batch)
    if (error) {
      return NextResponse.json({ error: `Database insert failed: ${error.message}` }, { status: 500 })
    }
    imported += batch.length
  }

  return NextResponse.json({ imported, skipped, errors })
}
