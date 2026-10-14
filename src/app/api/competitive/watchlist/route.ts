import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrand } from '@/lib/active-brand'
import { createWatch, WATCH_LIMIT } from '@/lib/tools/competitor-watch'
import { recordEvent } from '@/lib/tools/events'
import { normaliseUrl } from '@/lib/tools/fetch-public'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Add a competitor to the watchlist, or turn one off.
 *
 * The RLS client resolves the brand, so the brand is the caller's by
 * construction and nothing here takes a brand id from the body. The watch
 * rows themselves are written with the service role inside createWatch,
 * which is why that resolution has to happen first.
 */

const AddBody = z.object({
  competitorWebsite: z.string().trim().min(4).max(300),
  market:            z.string().trim().max(60).optional(),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string; website_url: string | null }>(supabase, 'id, website_url')
  if (!brand) return NextResponse.json({ error: 'No active brand.' }, { status: 400 })

  const parsed = AddBody.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Give us a competitor website.' }, { status: 400 })

  const url = normaliseUrl(parsed.data.competitorWebsite)
  if (!url) return NextResponse.json({ error: 'That did not look like a website.' }, { status: 400 })

  // Read through the RLS client: the count is the caller's own watches.
  const { count } = await supabase
    .from('competitor_watches').select('id', { count: 'exact', head: true }).eq('brand_id', brand.id)

  if ((count ?? 0) >= WATCH_LIMIT) {
    return NextResponse.json(
      { error: `You are watching ${WATCH_LIMIT} competitors, which is the ceiling while we are in beta. Turn one off to add another.` },
      { status: 409 },
    )
  }

  const outcome = await createWatch({
    brandId:           brand.id,
    brandWebsite:      brand.website_url,
    competitorWebsite: url.toString(),
    market:            parsed.data.market ?? null,
  })

  if (!outcome.ok) return NextResponse.json({ error: outcome.note }, { status: 422 })

  await recordEvent({
    event: 'beta_feature_used', toolId: 'competitor-tracker', userId: user.id,
    props: { feature: 'watch_added', competitor: outcome.name },
  })

  return NextResponse.json({ name: outcome.name, baselineMoves: outcome.moves })
}

const PatchBody = z.object({
  watchId: z.string().uuid(),
  enabled: z.boolean(),
})

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = PatchBody.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Bad request.' }, { status: 400 })

  // Straight through the RLS client, so the policy is the authorisation: a
  // watch id belonging to another workspace updates nothing.
  const { error, count } = await supabase
    .from('competitor_watches')
    .update({ enabled: parsed.data.enabled }, { count: 'exact' })
    .eq('id', parsed.data.watchId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!count) return NextResponse.json({ error: 'That watch is not yours.' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
