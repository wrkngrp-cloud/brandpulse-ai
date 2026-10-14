import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { hashIp, ipOf } from '@/lib/tools/runs'
import { cacheGet, cacheSet } from '@/lib/tools/limits'
import { recordEvent } from '@/lib/tools/events'

export const runtime = 'nodejs'

/**
 * An enquiry from a campaign response page.
 *
 * Public by necessity: the person filling this in is a member of the public
 * who scanned a billboard, and they have no account. So it follows the pattern
 * the survey and ambassador endpoints already use — a service-role route that
 * validates the token in the path rather than opening anon RLS on the table.
 *
 * NDPR, and the part that is not negotiable: the row is refused without
 * consent. `consented_at` is written from the server clock when the box was
 * ticked, and the exact wording the person agreed to is stored next to it, so
 * there is a record of what was actually consented to rather than a boolean
 * whose meaning has since been edited.
 */

const Body = z.object({
  campaignId: z.string().uuid(),
  placement:  z.string().trim().max(60).optional(),
  name:       z.string().trim().max(80).optional(),
  email:      z.string().trim().email().max(160).optional().or(z.literal('')),
  phone:      z.string().trim().max(30).optional(),
  message:    z.string().trim().max(1000).optional(),
  wantsCallback: z.boolean().optional(),
  consent:    z.literal(true, { message: 'Consent is required.' }),
  consentText: z.string().trim().min(10).max(500),
})

const RESPONSES_PER_HOUR = 20

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    const consentIssue = parsed.error?.issues.some(i => i.path.includes('consent'))
    return NextResponse.json(
      { error: consentIssue ? 'Please tick the box so we know you agree to be contacted.' : 'Please check the form and try again.' },
      { status: 400 },
    )
  }
  const d = parsed.data

  // Something to reply to, or there is nothing to capture.
  if (!d.email && !d.phone) {
    return NextResponse.json({ error: 'Leave either an email address or a phone number so they can reach you.' }, { status: 400 })
  }

  const ipHash = hashIp(ipOf(req))
  const key = `tool:resp:${ipHash}`
  const seen = (await cacheGet<number>(key)) ?? 0
  if (seen >= RESPONSES_PER_HOUR) {
    return NextResponse.json({ error: 'That is a lot of enquiries from one connection. Try again later.' }, { status: 429 })
  }
  await cacheSet(key, seen + 1, 3600)

  const svc = await createServiceClient()

  // The campaign has to exist, belong to a workspace, and have capture on.
  // A campaign nobody has claimed has no owner to receive an enquiry.
  const { data: campaign } = await svc
    .from('tool_campaigns')
    .select('id, brand_id, response_enabled')
    .eq('id', d.campaignId)
    .maybeSingle()

  if (!campaign || !campaign.response_enabled || !campaign.brand_id) {
    return NextResponse.json({ error: 'This campaign is not taking enquiries.' }, { status: 404 })
  }

  let placementId: string | null = null
  if (d.placement) {
    const { data: placement } = await svc
      .from('tool_placements').select('id').eq('campaign_id', campaign.id).eq('slug', d.placement).maybeSingle()
    placementId = placement?.id ?? null
  }

  const { error } = await svc.from('tool_responses').insert({
    campaign_id:    campaign.id,
    placement_id:   placementId,
    name:           d.name || null,
    email:          d.email || null,
    phone:          d.phone || null,
    message:        d.message || null,
    wants_callback: d.wantsCallback ?? false,
    consented_at:   new Date().toISOString(),
    consent_text:   d.consentText,
  })

  if (error) {
    console.error('[offline-tracker] response insert failed:', error)
    return NextResponse.json({ error: 'That did not send. Try again in a moment.' }, { status: 500 })
  }

  await recordEvent({
    event: 'first_value_received', toolId: 'offline-tracker',
    workspaceId: null,
    props: { feature: 'campaign_response', placement: d.placement ?? '' },
  })

  return NextResponse.json({ ok: true })
}
