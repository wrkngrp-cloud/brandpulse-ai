import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrand } from '@/lib/active-brand'

export const runtime = 'nodejs'

// PATCH: update status (start/pause/conclude) or set winner
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string }>(supabase, 'id')
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const body = await request.json() as {
    status?: 'draft' | 'running' | 'paused' | 'concluded'
    winner_variant_id?: string
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.status) {
    updates.status = body.status
    if (body.status === 'running' && !updates.started_at) updates.started_at = new Date().toISOString()
    if (body.status === 'concluded') updates.concluded_at = new Date().toISOString()
  }
  if (body.winner_variant_id) updates.winner_variant_id = body.winner_variant_id

  const { data, error } = await supabase
    .from('ab_experiments')
    .update(updates)
    .eq('id', id)
    .eq('brand_id', brand.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ experiment: data })
}

// POST /api/experiments/[id]/event — record an impression or conversion
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: experimentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string }>(supabase, 'id')
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const body = await request.json() as {
    variant_id: string
    event_type: 'impression' | 'click' | 'conversion' | 'revenue'
    value?: number
    session_id?: string
    user_hash?: string
  }

  if (!body.variant_id || !body.event_type) {
    return NextResponse.json({ error: 'variant_id and event_type required' }, { status: 400 })
  }

  await supabase.from('ab_events').insert({
    brand_id:      brand.id,
    experiment_id: experimentId,
    variant_id:    body.variant_id,
    event_type:    body.event_type,
    value:         body.value ?? null,
    session_id:    body.session_id ?? null,
    user_hash:     body.user_hash ?? null,
  })

  // Increment variant counters
  const inc: Record<string, number> = {}
  if (body.event_type === 'impression') inc.impressions = 1
  if (body.event_type === 'conversion') inc.conversions = 1
  if (body.event_type === 'revenue' && body.value) {
    // revenue handled separately — update directly
    const { data: v } = await supabase.from('ab_variants').select('revenue').eq('id', body.variant_id).single()
    await supabase.from('ab_variants').update({ revenue: (v?.revenue ?? 0) + body.value }).eq('id', body.variant_id)
  } else {
    const { data: v } = await supabase.from('ab_variants').select('impressions, conversions').eq('id', body.variant_id).single()
    if (v) {
      await supabase.from('ab_variants').update({
        impressions: (v.impressions ?? 0) + (inc.impressions ?? 0),
        conversions: (v.conversions ?? 0) + (inc.conversions ?? 0),
      }).eq('id', body.variant_id)
    }
  }

  return NextResponse.json({ ok: true })
}
