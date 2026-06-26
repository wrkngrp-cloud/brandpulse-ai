import { NextRequest, NextResponse } from 'next/server'
import { getActiveBrandId } from '@/lib/active-brand'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const targetSchema = z.object({
  metric:       z.string().min(1),
  comparator:   z.enum(['lte', 'gte']),
  target_value: z.number().positive(),
  period:       z.enum(['daily', 'campaign']).default('campaign'),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No active brand' }, { status: 404 })
  const brand = { id: brandId }

  const { data, error } = await supabase
    .from('campaign_targets')
    .select('*')
    .eq('brand_id', brand.id)
    .eq('platform_campaign_id', campaignId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No active brand' }, { status: 404 })
  const brand = { id: brandId }

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = targetSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const extra = body as { campaign_name?: string; platform?: string }

  const { data, error } = await supabase
    .from('campaign_targets')
    .upsert({
      brand_id:             brand.id,
      platform_campaign_id: campaignId,
      campaign_name:        extra.campaign_name ?? null,
      platform:             extra.platform      ?? null,
      metric:               parsed.data.metric,
      comparator:           parsed.data.comparator,
      target_value:         parsed.data.target_value,
      period:               parsed.data.period,
      updated_at:           new Date().toISOString(),
    }, { onConflict: 'brand_id,platform_campaign_id,metric' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No active brand' }, { status: 404 })
  const brand = { id: brandId }

  const { searchParams } = new URL(req.url)
  const metric = searchParams.get('metric')
  if (!metric) return NextResponse.json({ error: 'metric param required' }, { status: 400 })

  const { error } = await supabase
    .from('campaign_targets')
    .delete()
    .eq('brand_id', brand.id)
    .eq('platform_campaign_id', campaignId)
    .eq('metric', metric)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
