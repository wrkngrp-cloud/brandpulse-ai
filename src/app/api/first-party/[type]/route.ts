import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import crypto from 'crypto'

type MetricType = 'fintech' | 'saas' | 'venue' | 'platform' | 'trade'

const TABLE_MAP: Record<MetricType, string> = {
  fintech:  'fintech_metrics',
  saas:     'saas_metrics',
  venue:    'venue_traffic',
  platform: 'platform_metrics',
  trade:    'trade_partner_metrics',
}

const REQUIRED_FIELDS: Record<MetricType, string[]> = {
  fintech:  ['period_start', 'period_end'],
  saas:     ['period_start', 'period_end'],
  venue:    ['date'],
  platform: ['period_start', 'period_end'],
  trade:    ['period_start', 'period_end'],
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params
  const table = TABLE_MAP[type as MetricType]
  if (!table) {
    return NextResponse.json(
      { error: `Unknown metric type: ${type}. Valid types: fintech, saas, venue, platform, trade` },
      { status: 400 }
    )
  }

  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer bp_live_')) {
    return NextResponse.json(
      { error: 'Invalid or missing API key. Include: Authorization: Bearer bp_live_...' },
      { status: 401 }
    )
  }

  const rawKey  = authHeader.slice(7)
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')

  const sb = await createServiceClient()

  const { data: apiKey, error: keyError } = await sb
    .from('brand_api_keys')
    .select('id, brand_id, revoked_at')
    .eq('key_hash', keyHash)
    .maybeSingle()

  if (keyError || !apiKey) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
  }
  if (apiKey.revoked_at) {
    return NextResponse.json({ error: 'This API key has been revoked' }, { status: 401 })
  }

  await sb
    .from('brand_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKey.id)

  const body = await req.json() as Record<string, unknown>

  // Validate required fields
  const required = REQUIRED_FIELDS[type as MetricType] ?? []
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
    }
  }

  // brand_id always comes from the validated key, not the request body
  const payload = { ...body, brand_id: apiKey.brand_id }

  const { error: insertError } = await sb.from(table).insert(payload)
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, type, brand_id: apiKey.brand_id })
}
