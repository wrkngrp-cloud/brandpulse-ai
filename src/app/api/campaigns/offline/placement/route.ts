import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getActiveBrandId } from '@/lib/active-brand'
import { mintSlug, slugify, trackingUrlFor } from '@/lib/tools/offline-tracker'
import { recordEvent } from '@/lib/tools/events'

export const runtime = 'nodejs'

const Body = z.object({
  campaignId: z.string().uuid(),
  name:       z.string().trim().min(1).max(60),
})

/**
 * Add a placement to a claimed campaign.
 *
 * The campaign is fetched through the RLS client and matched against the
 * caller's active brand before any service-role work, per the data-access rule
 * in CLAUDE.md: a campaign id in the body is not evidence that the caller owns
 * it, and mintSlug writes with the service role.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No active brand.' }, { status: 400 })

  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Give the placement a name.' }, { status: 400 })

  const { data: campaign } = await supabase
    .from('tool_campaigns')
    .select('id, name')
    .eq('id', parsed.data.campaignId)
    .eq('brand_id', brandId)
    .maybeSingle()

  if (!campaign) return NextResponse.json({ error: 'That campaign is not yours.' }, { status: 404 })

  const utmContent = slugify(parsed.data.name, 30) || 'placement'
  const slug = await mintSlug(`${campaign.name}-${parsed.data.name}`)

  const svc = await createServiceClient()
  const { data: row, error } = await svc.from('tool_placements').insert({
    campaign_id: campaign.id,
    name:        parsed.data.name,
    slug,
    utm_content: utmContent,
  }).select('id, name, slug, utm_content, visits, unique_visits, created_at').single()

  if (error || !row) return NextResponse.json({ error: 'That did not save.' }, { status: 500 })

  await recordEvent({
    event: 'beta_feature_used', toolId: 'offline-tracker', userId: user.id,
    props: { feature: 'placement_added' },
  })

  return NextResponse.json({ placement: { ...row, trackingUrl: trackingUrlFor(slug) } })
}
