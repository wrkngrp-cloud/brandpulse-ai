import { NextRequest, NextResponse } from 'next/server'
import { getActiveBrandId } from '@/lib/active-brand'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const MARKER_TYPES = [
  'product_launch', 'campaign_launch', 'partnership',
  'crisis', 'rebrand', 'event', 'other',
] as const

const createSchema = z.object({
  label:       z.string().trim().min(1, 'Label is required').max(120),
  marker_type: z.enum(MARKER_TYPES),
  marker_date: z.string().refine(v => !Number.isNaN(Date.parse(v)), 'Invalid date'),
  notes:       z.string().trim().max(2000).optional(),
})

// GET — list markers for the active brand (last 90d by default) with BHI delta
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const bid = await getActiveBrandId(supabase)
  if (!bid) return NextResponse.json({ error: 'No active brand' }, { status: 404 })

  const daysParam = Number(req.nextUrl.searchParams.get('days') ?? 90)
  const days = Number.isFinite(daysParam) ? Math.min(365, Math.max(1, daysParam)) : 90
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffDate = cutoff.toISOString().split('T')[0]

  const { data: markers, error } = await supabase
    .from('brand_launch_markers')
    .select('id, brand_id, label, marker_type, marker_date, notes, created_at')
    .eq('brand_id', bid)
    .gte('marker_date', cutoffDate)
    .order('marker_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // For each marker, compute BHI delta (7d before vs 7d after marker_date)
  const markersWithDelta = await Promise.all((markers ?? []).map(async m => {
    const markerDate = new Date(m.marker_date)
    const sevenBefore = new Date(markerDate)
    sevenBefore.setDate(sevenBefore.getDate() - 7)
    const sevenAfter = new Date(markerDate)
    sevenAfter.setDate(sevenAfter.getDate() + 7)

    const [{ data: beforeRows }, { data: afterRows }] = await Promise.all([
      supabase
        .from('brand_health_snapshots')
        .select('bhi')
        .eq('brand_id', bid)
        .gte('snapshot_date', sevenBefore.toISOString().split('T')[0])
        .lt('snapshot_date', m.marker_date),
      supabase
        .from('brand_health_snapshots')
        .select('bhi')
        .eq('brand_id', bid)
        .gt('snapshot_date', m.marker_date)
        .lte('snapshot_date', sevenAfter.toISOString().split('T')[0]),
    ])

    const beforeAvg = beforeRows?.length
      ? Math.round(beforeRows.reduce((s, r) => s + (r.bhi ?? 0), 0) / beforeRows.length)
      : null
    const afterAvg = afterRows?.length
      ? Math.round(afterRows.reduce((s, r) => s + (r.bhi ?? 0), 0) / afterRows.length)
      : null

    return {
      ...m,
      bhi_delta: {
        before_avg: beforeAvg,
        after_avg:  afterAvg,
        delta:      beforeAvg != null && afterAvg != null ? afterAvg - beforeAvg : null,
      },
    }
  }))

  return NextResponse.json({ markers: markersWithDelta })
}

// POST — create a new marker
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = createSchema.safeParse(await req.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message }, { status: 400 })

  const bid = await getActiveBrandId(supabase)
  if (!bid) return NextResponse.json({ error: 'No active brand' }, { status: 404 })

  const service = await createServiceClient()
  const { data, error } = await service
    .from('brand_launch_markers')
    .insert({
      brand_id:    bid,
      label:       body.data.label,
      marker_type: body.data.marker_type,
      marker_date: body.data.marker_date,
      notes:       body.data.notes ?? null,
    })
    .select('id, brand_id, label, marker_type, marker_date, notes, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ marker: data })
}

// DELETE ?id= — delete a marker
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const bid = await getActiveBrandId(supabase)
  if (!bid) return NextResponse.json({ error: 'No active brand' }, { status: 404 })

  const service = await createServiceClient()
  const { error } = await service
    .from('brand_launch_markers')
    .delete()
    .eq('id', id)
    .eq('brand_id', bid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
