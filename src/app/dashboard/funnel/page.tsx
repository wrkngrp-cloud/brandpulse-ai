import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FunnelClient } from './funnel-client'
import { getActiveBrandId } from '@/lib/active-brand'
import { computeAwarenessComposite } from '@/lib/bhi'

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
  const todayStr = now.toISOString().split('T')[0]
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

  const brandId = await getActiveBrandId(supabase)
  const bid = brandId ?? ''

  const [
    { data: sovSnap },
    { data: recentPosts },
    { data: sentDays },
    { data: allInteractions },
    { data: oohSites },
    { data: surveyResponses },
    { data: brand },
    { data: brandEvents },
    { data: digitalPerf },
    { data: influencers },
  ] = await Promise.all([
    supabase
      .from('sov_snapshots')
      .select('social_sov, snapshot_date')
      .eq('brand_id', bid)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('social_posts')
      .select('engagement_rate, likes, comments, shares')
      .eq('brand_id', bid)
      .gte('posted_at', thirtyDaysAgo.toISOString()),
    supabase
      .from('sentiment_daily')
      .select('social_score, day')
      .eq('brand_id', bid)
      .gte('day', fourteenDaysAgo.toISOString().split('T')[0]),
    supabase
      .from('event_interactions')
      .select('interaction_type'),
    supabase
      .from('ooh_sites')
      .select('visits, daily_traffic, campaign_end')
      .eq('brand_id', bid)
      .eq('status', 'active'),
    supabase
      .from('survey_responses')
      .select('answers')
      .eq('quality_flag', 'ok'),
    bid
      ? supabase.from('brands').select('name, category').eq('id', bid).maybeSingle()
      : supabase.from('brands').select('name, category').limit(1).maybeSingle(),
    supabase
      .from('events')
      .select('debrief')
      .eq('brand_id', bid)
      .gte('date_start', thirtyDaysAgoStr)
      .lte('date_start', todayStr),
    supabase
      .from('digital_performance_daily')
      .select('impressions')
      .eq('brand_id', bid)
      .gte('date', thirtyDaysAgoStr),
    supabase
      .from('influencers')
      .select('latest_post_reach')
      .eq('brand_id', bid),
  ])

  // ── 1. Awareness: multi-source composite
  const oohMonthlyReach = (oohSites ?? []).reduce(
    (s, site) => s + (site.daily_traffic ?? 0) * 30,
    0,
  )
  const eventAttendance = (brandEvents ?? []).reduce((s, e) => {
    const d = e.debrief as { actual_attendance?: number } | null
    return s + (d?.actual_attendance ?? 0)
  }, 0)
  const digitalImpressions = (digitalPerf ?? []).reduce(
    (s, d) => s + (d.impressions ?? 0),
    0,
  )
  const influencerReach = (influencers ?? []).reduce(
    (s, i) => s + (i.latest_post_reach ?? 0),
    0,
  )

  const awarenessResult = computeAwarenessComposite({
    socialSov:          sovSnap?.social_sov ?? null,
    oohMonthlyReach:    oohMonthlyReach > 0    ? oohMonthlyReach    : null,
    eventAttendance:    eventAttendance > 0     ? eventAttendance    : null,
    digitalImpressions: digitalImpressions > 0  ? digitalImpressions : null,
    influencerReach:    influencerReach > 0      ? influencerReach    : null,
  })
  const awarenessScore = awarenessResult.score

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
            sentDaysWithData.length,
        )
      : null

  // ── 4. Action: lead-capture rate (60pts) + OOH vanity visits (40pts)
  const leads = (allInteractions ?? []).filter(i =>
    ['new_lead', 'new_customer'].includes(i.interaction_type),
  ).length
  const totalInt = (allInteractions ?? []).length
  const oohVisits = (oohSites ?? []).reduce((s, site) => s + (site.visits ?? 0), 0)

  let actionScore: number | null = null
  const leadComponent = totalInt > 0 ? Math.min(Math.round((leads / totalInt) * 100 * 0.6), 60) : 0
  const oohComponent  = oohVisits > 0 ? Math.min(Math.round(oohVisits / 200), 40) : 0
  if (totalInt > 0 || oohVisits > 0) {
    actionScore = Math.min(leadComponent + oohComponent, 100)
  }

  // ── 5. Loyalty: NPS from survey responses — rescaled to 0-100
  const npsScores: number[] = []
  for (const r of surveyResponses ?? []) {
    const answers = r.answers as Record<string, unknown>
    for (const val of Object.values(answers)) {
      if (typeof val === 'number' && Number.isInteger(val) && val >= 0 && val <= 10) {
        npsScores.push(val); break
      }
    }
  }
  const promoters  = npsScores.filter(s => s >= 9).length
  const detractors = npsScores.filter(s => s <= 6).length
  const loyaltyScore: number | null =
    npsScores.length >= 3
      ? Math.round(((promoters - detractors) / npsScores.length) * 100 / 2 + 50)
      : null

  // ── 6. Advocacy: share rate
  const totalShares = (recentPosts ?? []).reduce((s, p) => s + (p.shares ?? 0), 0)
  const totalEngagements = (recentPosts ?? []).reduce(
    (s, p) => s + (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0),
    0,
  )
  const advocacyScore: number | null =
    totalEngagements >= 50
      ? Math.min(Math.round((totalShares / totalEngagements) * 100 * 5), 100)
      : null

  const scores = {
    awareness: {
      score:      awarenessScore,
      source:     'SOV · OOH · Events · Digital · Influencer',
      dataPoints: awarenessResult.breakdown.sources.filter(s => s.score !== null).length,
      breakdown:  awarenessResult.breakdown.sources.map(s => ({
        label:      s.label,
        rawDisplay: s.rawDisplay,
        weight:     s.weight,
        score:      s.score,
      })),
    },
    consideration: {
      score:      considerationScore,
      source:     'Social engagement rate',
      dataPoints: postsWithEng.length,
      breakdown:  [{
        label:      'Social Engagement Rate',
        rawDisplay: avgEngRate != null ? `${avgEngRate.toFixed(2)}% avg` : null,
        weight:     100,
        score:      considerationScore,
      }],
    },
    preference: {
      score:      preferenceScore,
      source:     'Sentiment score (14d avg)',
      dataPoints: sentDaysWithData.length,
      breakdown:  [{
        label:      'Sentiment Score (14-day avg)',
        rawDisplay: sentDaysWithData.length > 0 ? `${sentDaysWithData.length} days` : null,
        weight:     100,
        score:      preferenceScore,
      }],
    },
    action: {
      score:      actionScore,
      source:     'Lead conversion + OOH visits',
      dataPoints: totalInt + (oohSites ?? []).length,
      breakdown:  [
        {
          label:      'Lead Conversion',
          rawDisplay: totalInt > 0 ? `${leads}/${totalInt} leads` : null,
          weight:     60,
          score:      totalInt > 0 ? Math.min(Math.round((leads / totalInt) * 100), 100) : null,
        },
        {
          label:      'OOH Visit-throughs',
          rawDisplay: oohVisits > 0 ? `${oohVisits.toLocaleString('en-NG')} visits` : null,
          weight:     40,
          score:      oohVisits > 0 ? Math.min(Math.round(oohVisits / 80), 100) : null,
        },
      ],
    },
    loyalty: {
      score:      loyaltyScore,
      source:     'NPS (post-purchase surveys)',
      dataPoints: npsScores.length,
      breakdown:  [
        {
          label:      'Promoters (9–10)',
          rawDisplay: npsScores.length >= 3 ? `${promoters} of ${npsScores.length}` : null,
          weight:     50,
          score:      npsScores.length >= 3 ? Math.round((promoters / npsScores.length) * 100) : null,
        },
        {
          label:      'Detractors (0–6)',
          rawDisplay: npsScores.length >= 3 ? `${detractors} of ${npsScores.length}` : null,
          weight:     50,
          score:      npsScores.length >= 3 ? Math.round((1 - detractors / npsScores.length) * 100) : null,
        },
      ],
    },
    advocacy: {
      score:      advocacyScore,
      source:     'Organic share rate',
      dataPoints: (recentPosts ?? []).length,
      breakdown:  [{
        label:      'Organic Share Rate',
        rawDisplay: totalEngagements > 0
          ? `${totalShares} shares / ${totalEngagements} engagements`
          : null,
        weight:     100,
        score:      advocacyScore,
      }],
    },
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
        industry={brand?.category ?? null}
      />
    </div>
  )
}
