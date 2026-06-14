import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FunnelClient } from './funnel-client'

export const dynamic = 'force-dynamic'

export default async function FunnelPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const fourteenDaysAgo = new Date(now)
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

  const [
    { data: sovSnap },
    { data: recentPosts },
    { data: sentDays },
    { data: allInteractions },
    { data: oohSites },
    { data: surveyResponses },
    { data: brand },
  ] = await Promise.all([
    supabase
      .from('sov_snapshots')
      .select('social_sov, snapshot_date')
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('social_posts')
      .select('engagement_rate, likes, comments, shares')
      .gte('posted_at', thirtyDaysAgo.toISOString()),
    supabase
      .from('sentiment_daily')
      .select('social_score, day')
      .gte('day', fourteenDaysAgo.toISOString().split('T')[0]),
    supabase
      .from('event_interactions')
      .select('interaction_type'),
    supabase
      .from('ooh_sites')
      .select('visits')
      .eq('status', 'active'),
    supabase
      .from('survey_responses')
      .select('answers')
      .eq('quality_flag', 'ok'),
    supabase
      .from('brands')
      .select('name, industry')
      .limit(1)
      .maybeSingle(),
  ])

  // ── 1. Awareness: SOV % (direct, already 0-100)
  const awarenessScore: number | null =
    sovSnap?.social_sov != null ? Math.round(sovSnap.social_sov) : null

  // ── 2. Consideration: avg engagement_rate (stored as %) — 10% avg = 100 score
  const postsWithEng = (recentPosts ?? []).filter(p => p.engagement_rate != null)
  const avgEngRate =
    postsWithEng.length > 0
      ? postsWithEng.reduce((s, p) => s + (p.engagement_rate ?? 0), 0) / postsWithEng.length
      : null
  const considerationScore: number | null =
    avgEngRate != null ? Math.min(Math.round(avgEngRate * 10), 100) : null

  // ── 3. Preference: avg sentiment score over last 14 days (already 0-100)
  const sentDaysWithData = (sentDays ?? []).filter(d => d.social_score != null)
  const preferenceScore: number | null =
    sentDaysWithData.length > 0
      ? Math.round(
          sentDaysWithData.reduce((s, d) => s + (d.social_score ?? 0), 0) /
            sentDaysWithData.length
        )
      : null

  // ── 4. Action: lead-capture rate (60pts) + OOH vanity visits (40pts)
  const leads = (allInteractions ?? []).filter(i =>
    ['new_lead', 'new_customer'].includes(i.interaction_type)
  ).length
  const totalInt = (allInteractions ?? []).length
  const oohVisits = (oohSites ?? []).reduce(
    (s, site) => s + (site.visits ?? 0),
    0
  )

  let actionScore: number | null = null
  if (totalInt > 0 || oohVisits > 0) {
    const leadComponent =
      totalInt > 0 ? Math.min(Math.round((leads / totalInt) * 100 * 0.6), 60) : 0
    // 8,000 OOH visits → 40 pts; scales linearly
    const oohComponent = Math.min(Math.round(oohVisits / 200), 40)
    actionScore = Math.min(leadComponent + oohComponent, 100)
  }

  // ── 5. Loyalty: NPS from survey responses (-100 to +100) → rescaled 0-100
  const npsScores: number[] = []
  for (const r of surveyResponses ?? []) {
    const answers = r.answers as Record<string, unknown>
    for (const val of Object.values(answers)) {
      if (typeof val === 'number' && Number.isInteger(val) && val >= 0 && val <= 10) {
        npsScores.push(val)
        break
      }
    }
  }
  const promoters  = npsScores.filter(s => s >= 9).length
  const detractors = npsScores.filter(s => s <= 6).length
  const loyaltyScore: number | null =
    npsScores.length >= 3
      ? Math.round(((promoters - detractors) / npsScores.length) * 100 / 2 + 50)
      : null

  // ── 6. Advocacy: share rate — shares / total engagements, amplified × 5, cap 100
  const totalShares = (recentPosts ?? []).reduce((s, p) => s + (p.shares ?? 0), 0)
  const totalEngagements = (recentPosts ?? []).reduce(
    (s, p) => s + (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0),
    0
  )
  const advocacyScore: number | null =
    totalEngagements >= 50
      ? Math.min(Math.round((totalShares / totalEngagements) * 100 * 5), 100)
      : null

  const scores = {
    awareness:     { score: awarenessScore,     source: 'Share of Voice',         dataPoints: sovSnap        != null ? 1                     : 0 },
    consideration: { score: considerationScore, source: 'Social engagement rate',  dataPoints: postsWithEng.length },
    preference:    { score: preferenceScore,    source: 'Sentiment score',         dataPoints: sentDaysWithData.length },
    action:        { score: actionScore,        source: 'Leads + OOH visits',      dataPoints: totalInt + (oohSites ?? []).length },
    loyalty:       { score: loyaltyScore,       source: 'NPS (surveys)',           dataPoints: npsScores.length },
    advocacy:      { score: advocacyScore,      source: 'Organic share rate',      dataPoints: (recentPosts ?? []).length },
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Brand Funnel</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          How your audience moves from discovering{' '}
          {brand?.name ?? 'your brand'} to advocating for it.
        </p>
      </div>

      <FunnelClient
        scores={scores}
        brandName={brand?.name ?? 'your brand'}
        industry={brand?.industry ?? null}
      />
    </div>
  )
}
