import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrand } from '@/lib/active-brand'
import { checkinMetricFor, lastWeek, mondayOf, addDays } from '@/lib/brief/metrics'

/** The weekly check-in: one number for one week. RLS client throughout. */
const body = z.object({
  value:     z.number().finite().min(0).max(1e12),
  isIndex:   z.boolean().default(false),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in and try again.' }, { status: 401 })

  const parsed = body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Enter a number, like 4210.' }, { status: 400 })

  const brand = await getActiveBrand<{ id: string; brand_type: string | null }>(supabase, 'id, brand_type')
  if (!brand) return NextResponse.json({ error: 'We could not find your brand.' }, { status: 404 })

  // Only a Monday in the last eight weeks, so a typo cannot file a number
  // against a week the brief will never read.
  const last = lastWeek().start
  const weekStart = parsed.data.weekStart ? mondayOf(parsed.data.weekStart) : last
  if (weekStart > last || weekStart < addDays(last, -7 * 8)) {
    return NextResponse.json({ error: 'You can fill in any of the last eight weeks.' }, { status: 400 })
  }

  const metric = checkinMetricFor(brand.brand_type)
  const { error } = await supabase.from('metric_manual').upsert({
    brand_id:     brand.id,
    metric_key:   metric.key,
    value:        parsed.data.value,
    is_index:     parsed.data.isIndex,
    period_start: weekStart,
    period_end:   addDays(weekStart, 6),
    entered_by:   user.id,
    updated_at:   new Date().toISOString(),
  }, { onConflict: 'brand_id,metric_key,period_start' })
  if (error) {
    console.error('[brief/checkin] save failed:', error.message)
    return NextResponse.json({ error: 'That did not save. Try again in a minute.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, weekStart })
}
