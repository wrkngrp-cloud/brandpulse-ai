import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrandId } from '@/lib/active-brand'
import { checkWatch, type WatchRow } from '@/lib/tools/competitor-watch'
import { recordEvent } from '@/lib/tools/events'

export const runtime = 'nodejs'
export const maxDuration = 60

const Body = z.object({ watchId: z.string().uuid() })

/**
 * Check one watched competitor now, rather than waiting for Monday.
 *
 * The watch row is fetched through the RLS client first and the id is matched
 * against the caller's active brand, so the service-role writes inside
 * checkWatch cannot be pointed at another tenant's watch. This is the pattern
 * CLAUDE.md requires for any user-triggered route that ends in service-role
 * work: verify through RLS, then do the work.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No active brand.' }, { status: 400 })

  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Bad request.' }, { status: 400 })

  const { data: watch } = await supabase
    .from('competitor_watches')
    .select('id, brand_id, competitor_id, competitor_name, website_url, market, home_hash, pricing_hash')
    .eq('id', parsed.data.watchId)
    .eq('brand_id', brandId)
    .maybeSingle()

  if (!watch) return NextResponse.json({ error: 'That watch is not yours.' }, { status: 404 })

  const result = await checkWatch(watch as WatchRow)

  await recordEvent({
    event: 'beta_feature_used', toolId: 'competitor-tracker', userId: user.id,
    props: { feature: 'watch_checked', newMoves: result.newMoves, siteChanges: result.siteChanges },
  })

  return NextResponse.json(result)
}
