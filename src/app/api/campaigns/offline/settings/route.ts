import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { recordEvent } from '@/lib/tools/events'

export const runtime = 'nodejs'

const Body = z.object({
  campaignId:       z.string().uuid(),
  responseEnabled:  z.boolean().optional(),
  responseHeadline: z.string().trim().max(120).optional(),
  responseBlurb:    z.string().trim().max(400).optional(),
})

/**
 * The campaign's response page settings.
 *
 * Switching response capture on changes where a printed QR code lands: the
 * campaign's own page comes first, carrying the destination as its primary
 * action. That is the owner's call to make, which is why it is off until they
 * make it, and why the UI says plainly what it changes.
 *
 * Straight through the RLS client. The update policy on tool_campaigns scopes
 * to the workspace that owns the brand, so a campaign id from another tenant
 * updates nothing.
 */
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Bad request.' }, { status: 400 })
  const { campaignId, responseEnabled, responseHeadline, responseBlurb } = parsed.data

  const patch: Record<string, unknown> = {}
  if (responseEnabled !== undefined)  patch.response_enabled  = responseEnabled
  if (responseHeadline !== undefined) patch.response_headline = responseHeadline || null
  if (responseBlurb !== undefined)    patch.response_blurb    = responseBlurb || null
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 })

  const { error, count } = await supabase
    .from('tool_campaigns').update(patch, { count: 'exact' }).eq('id', campaignId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!count) return NextResponse.json({ error: 'That campaign is not yours.' }, { status: 404 })

  if (responseEnabled !== undefined) {
    await recordEvent({
      event: 'beta_feature_used', toolId: 'offline-tracker', userId: user.id,
      props: { feature: 'response_capture', enabled: responseEnabled },
    })
  }

  return NextResponse.json({ ok: true })
}
