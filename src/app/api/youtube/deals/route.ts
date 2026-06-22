import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const Body = z.object({
  channel_name:       z.string().min(1),
  channel_url:        z.string().url().optional().nullable(),
  video_url:          z.string().url().optional().nullable(),
  deliverables:       z.string().optional().nullable(),
  fee_ngn:            z.number().positive().optional().nullable(),
  promo_code:         z.string().optional().nullable(),
  view_guarantee:     z.number().int().positive().optional().nullable(),
  linked_campaign_id: z.string().uuid().optional().nullable(),
  deal_date:          z.string().optional().nullable(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = Body.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { data: brand } = await supabase.from('brands').select('id, workspace_id').limit(1).single()
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const d = parsed.data

  // Extract video_id from URL if provided
  let videoId: string | null = null
  if (d.video_url) {
    try {
      const url = new URL(d.video_url)
      videoId = url.searchParams.get('v') ?? url.pathname.split('/').pop() ?? null
    } catch { /* leave null */ }
  }

  const { data, error } = await supabase
    .from('youtube_creator_deals')
    .insert({
      brand_id:           brand.id,
      workspace_id:       brand.workspace_id,
      channel_name:       d.channel_name,
      channel_url:        d.channel_url ?? null,
      video_url:          d.video_url ?? null,
      video_id:           videoId,
      deliverables:       d.deliverables ?? null,
      fee_ngn:            d.fee_ngn ?? null,
      promo_code:         d.promo_code ?? null,
      view_guarantee:     d.view_guarantee ?? null,
      linked_campaign_id: d.linked_campaign_id ?? null,
      deal_date:          d.deal_date ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, deal: data })
}
