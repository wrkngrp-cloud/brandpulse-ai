import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getActiveBrandId } from '@/lib/active-brand'
import { buildBrief } from '@/lib/brief/build'
import { lastWeek } from '@/lib/brief/metrics'
import { cacheGet, cacheSet } from '@/lib/tools/limits'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * "Write it now": the same brief the Monday job writes, for last week, shown
 * on the dashboard and not emailed. The brand is resolved through RLS first,
 * then the service role writes the row, because members can read briefs but
 * never write them. Once per brand per ten minutes, since each run is an AI
 * call.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in and try again.' }, { status: 401 })
  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'We could not find your brand.' }, { status: 404 })

  const key = `brief:now:${brandId}`
  if (await cacheGet<number>(key)) {
    return NextResponse.json({ error: 'You just did that. Give it ten minutes before asking again.' }, { status: 429 })
  }
  await cacheSet(key, 1, 600)

  const { start } = lastWeek()
  const svc = await createServiceClient()
  const outcome = await buildBrief(svc, brandId, start)
  const { error } = await svc.from('weekly_briefs').upsert({
    brand_id: brandId, week_start: start, status: outcome.status,
    content: outcome.content, updated_at: new Date().toISOString(),
  }, { onConflict: 'brand_id,week_start' })
  if (error) {
    console.error('[brief/generate] save failed:', error.message)
    return NextResponse.json({ error: 'The brief was written but did not save. Try again.' }, { status: 500 })
  }
  return NextResponse.json({ status: outcome.status })
}
