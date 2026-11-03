import { createClient } from '@/lib/supabase/server'
import { getActiveBrand } from '@/lib/active-brand'
import { checkinMetricFor, lastWeek, weekLabel, lagosToday, addDays } from '@/lib/brief/metrics'
import type { BriefContent } from '@/lib/brief/build'
import { BriefView } from './brief-view'
import { BriefPanel } from './brief-panel'

/**
 * The Monday Brief on the dashboard home. Reads through RLS only. Renders
 * nothing if the brief tables are not there yet (before the migration), so
 * the home page never breaks for want of it.
 */
export async function BriefSection() {
  const supabase = await createClient()
  const brand = await getActiveBrand<{ id: string; brand_type: string | null; brief_hour: number | null }>(supabase, 'id, brand_type, brief_hour')
  if (!brand || brand.brief_hour == null) return null

  const metric = checkinMetricFor(brand.brand_type)
  const { start } = lastWeek()
  const today = lagosToday()

  const [briefRes, numberRes, momentsRes] = await Promise.all([
    supabase.from('weekly_briefs').select('status, content, share_token, week_start')
      .eq('brand_id', brand.id).order('week_start', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('metric_manual').select('value, is_index')
      .eq('brand_id', brand.id).eq('metric_key', metric.key).eq('period_start', start).maybeSingle(),
    supabase.from('brand_moments').select('id, happened_on, kind, title')
      .eq('brand_id', brand.id).gte('happened_on', addDays(today, -21)).order('happened_on', { ascending: false }).limit(6),
  ])
  if (briefRes.error) return null

  const brief = briefRes.data
  const appUrl = process.env.APP_URL || 'https://brandgauge.app'
  return (
    <BriefPanel
      brief={brief?.status === 'ready' ? <BriefView content={brief.content as BriefContent} /> : null}
      needsNumbers={brief?.status === 'needs_numbers'}
      shareUrl={brief?.status === 'ready' ? `${appUrl}/brief/${brief.share_token}` : null}
      checkin={{
        question:      metric.question,
        example:       metric.example,
        weekLabel:     weekLabel(start),
        lastWeekValue: numberRes.data ? Number(numberRes.data.value) : null,
        isIndex:       !!numberRes.data?.is_index,
      }}
      moments={momentsRes.data ?? []}
      briefHour={brand.brief_hour}
      today={today}
    />
  )
}
