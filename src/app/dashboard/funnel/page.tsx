import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FunnelClient } from './funnel-client'
import { getActiveBrandId } from '@/lib/active-brand'
import { computeStageComposite } from '@/lib/bhi'

export const dynamic = 'force-dynamic'

function fmtNum(v: number): string {
  return Math.round(v).toLocaleString('en-NG')
}

export default async function FunnelPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const now = new Date()
  const thirtyDaysAgo = new Date(now);  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const fourteenDaysAgo = new Date(now); fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
  const sevenDaysAgo = new Date(now);   sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const ninetyDaysAgo = new Date(now);  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const todayStr          = now.toISOString().split('T')[0]
  const thirtyDaysAgoStr  = thirtyDaysAgo.toISOString().split('T')[0]
  const fourteenDaysAgoStr = fourteenDaysAgo.toISOString().split('T')[0]
  const sevenDaysAgoStr   = sevenDaysAgo.toISOString().split('T')[0]
  const ninetyDaysAgoStr  = ninetyDaysAgo.toISOString().split('T')[0]

  const brandId = await getActiveBrandId(supabase)
  const bid = brandId ?? ''

  const [
    { data: sovSnap },
    { data: recentPosts },
    { data: sentDays14 },
    { data: allInteractions },
    { data: oohSites },
    { data: surveyResponses },
    { data: perceptionSurveyIds },
    { data: brand },
    { data: brandEvents },
    { data: digitalPerf },
    { data: influencerPosts },
    { data: pressMentions },
    { data: tvSchedules },
    { data: radioSchedules },
    { data: aiVis },
    { count: considerationCount },
    { count: mentionCount },
    { data: culturalScores },
    { data: marketplaceSnaps },
    { count: purchaseSuccessCount },
    { data: ecommerceSales },
    { data: referralCodes },
    { count: referralEventCount },
    { count: sdkConversionCount },
    { data: npsRecords },
    { data: customerProfiles },
    { count: loyaltyEarnCount },
    { data: advocacyScore },
    { count: activePromoterCount },
    { count: visualAdvocacyCount },
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
      .select('social_score, positive_pct, day')
      .eq('brand_id', bid)
      .gte('day', fourteenDaysAgoStr),
    supabase
      .from('event_interactions')
      .select('interaction_type'),
    supabase
      .from('ooh_sites')
      .select('visits, daily_traffic, campaign_end')
      .eq('brand_id', bid)
      .eq('status', 'active')
      .gte('campaign_end', todayStr),
    supabase
      .from('survey_responses')
      .select('answers, survey_id')
      .eq('quality_flag', 'ok'),
    supabase
      .from('surveys')
      .select('id')
      .eq('brand_id', bid)
      .eq('type', 'perception_audit'),
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
      .select('impressions, ctr, video_view_rate, conversions, clicks')
      .eq('brand_id', bid)
      .gte('date', thirtyDaysAgoStr),
    supabase
      .from('influencer_posts')
      .select('reach')
      .eq('brand_id', bid)
      .gte('created_at', thirtyDaysAgo.toISOString()),
    supabase
      .from('press_mentions')
      .select('estimated_reach, sentiment_label')
      .eq('brand_id', bid)
      .gte('published_at', ninetyDaysAgoStr),
    supabase
      .from('tv_schedules')
      .select('grp_delivered')
      .eq('brand_id', bid)
      .gte('spot_date', thirtyDaysAgoStr),
    supabase
      .from('radio_schedules')
      .select('spots_aired')
      .eq('brand_id', bid)
      .gte('spot_date', thirtyDaysAgoStr),
    supabase
      .from('ai_visibility_scores')
      .select('visibility_score')
      .eq('brand_id', bid)
      .order('week_of', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('social_posts')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', bid)
      .eq('funnel_stage', 'consideration')
      .gte('posted_at', thirtyDaysAgo.toISOString()),
    supabase
      .from('mentions')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', bid)
      .eq('is_competitor', false)
      .gte('created_at', thirtyDaysAgo.toISOString()),
    supabase
      .from('cultural_resonance_scores')
      .select('crs')
      .eq('brand_id', bid)
      .not('crs', 'is', null)
      .order('snapshot_date', { ascending: false })
      .limit(5),
    supabase
      .from('marketplace_snapshots')
      .select('rating, marketplace_products!inner(is_own_product)')
      .eq('brand_id', bid)
      .eq('marketplace_products.is_own_product', true)
      .not('rating', 'is', null)
      .order('snapshot_date', { ascending: false })
      .limit(20),
    supabase
      .from('purchase_events')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', bid)
      .eq('status', 'success')
      .gte('occurred_at', thirtyDaysAgo.toISOString()),
    supabase
      .from('ecommerce_sales')
      .select('units')
      .eq('brand_id', bid)
      .gte('sold_at', thirtyDaysAgo.toISOString()),
    supabase
      .from('referral_codes')
      .select('conversions')
      .eq('brand_id', bid),
    supabase
      .from('referral_events')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', bid)
      .in('event_type', ['signup', 'purchase'])
      .gte('created_at', thirtyDaysAgo.toISOString()),
    supabase
      .from('sdk_events')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', bid)
      .in('event_type', ['purchase', 'lead'])
      .gte('occurred_at', thirtyDaysAgo.toISOString()),
    supabase
      .from('nps_records')
      .select('promoter_type')
      .eq('brand_id', bid)
      .gte('created_at', thirtyDaysAgo.toISOString()),
    supabase
      .from('customer_profiles')
      .select('total_orders, retention_risk_score')
      .eq('brand_id', bid),
    supabase
      .from('loyalty_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', bid)
      .eq('transaction_type', 'earn')
      .gte('created_at', thirtyDaysAgo.toISOString()),
    supabase
      .from('advocacy_scores')
      .select('advocacy_score')
      .eq('brand_id', bid)
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('promoters')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', bid)
      .eq('status', 'active'),
    supabase
      .from('visual_mentions')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', bid)
      .eq('brand_visible', true)
      .in('visual_sentiment', ['positive', 'neutral'])
      .gte('detected_at', thirtyDaysAgo.toISOString()),
  ])

  // ── Shared derived values ──────────────────────────────────────────────────

  // OOH (active sites only)
  const oohMonthlyReach = (oohSites ?? []).reduce((s, x) => s + (x.daily_traffic ?? 0) * 30, 0)
  const oohVisits       = (oohSites ?? []).reduce((s, x) => s + (x.visits ?? 0), 0)

  // Events
  const eventAttendance = (brandEvents ?? []).reduce((s, e) => {
    const d = e.debrief as { actual_attendance?: number } | null
    return s + (d?.actual_attendance ?? 0)
  }, 0)

  // Digital
  const digitalImpressions = (digitalPerf ?? []).reduce((s, d) => s + (d.impressions ?? 0), 0)
  const digitalConversions = (digitalPerf ?? []).reduce((s, d) => s + (d.conversions ?? 0), 0)
  const ctrRows = (digitalPerf ?? []).filter(d => d.ctr != null)
  const avgCtr  = ctrRows.length > 0 ? ctrRows.reduce((s, d) => s + (d.ctr ?? 0), 0) / ctrRows.length : null
  const vvrRows = (digitalPerf ?? []).filter(d => d.video_view_rate != null)
  const avgVvr  = vvrRows.length > 0 ? vvrRows.reduce((s, d) => s + (d.video_view_rate ?? 0), 0) / vvrRows.length : null

  // Influencer / press / offline media
  const influencerReach = (influencerPosts ?? []).reduce((s, p) => s + (p.reach ?? 0), 0)
  const pressReach      = (pressMentions ?? []).reduce((s, p) => s + (p.estimated_reach ?? 0), 0)
  const pressPositive   = (pressMentions ?? []).filter(p => p.sentiment_label === 'positive').length
  const pressTotal      = (pressMentions ?? []).length
  const tvGrps     = (tvSchedules ?? []).reduce((s, t) => s + (t.grp_delivered ?? 0), 0)
  const radioSpots = (radioSchedules ?? []).reduce((s, r) => s + (r.spots_aired ?? 0), 0)
  const aiVisScore = aiVis?.visibility_score ?? null

  // Social engagement / shares
  const postsWithEng = (recentPosts ?? []).filter(p => p.engagement_rate != null)
  const avgEngRate   = postsWithEng.length > 0
    ? postsWithEng.reduce((s, p) => s + (p.engagement_rate ?? 0), 0) / postsWithEng.length
    : null
  const totalShares = (recentPosts ?? []).reduce((s, p) => s + (p.shares ?? 0), 0)
  const totalEngagements = (recentPosts ?? []).reduce(
    (s, p) => s + (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0), 0,
  )

  // Sentiment 14d / 7d
  const sent14 = (sentDays14 ?? []).filter(d => d.social_score != null)
  const sentScore14 = sent14.length > 0
    ? sent14.reduce((s, d) => s + (d.social_score ?? 0), 0) / sent14.length : null
  const pos14Rows = (sentDays14 ?? []).filter(d => d.positive_pct != null)
  const posPct14  = pos14Rows.length > 0
    ? pos14Rows.reduce((s, d) => s + (d.positive_pct ?? 0), 0) / pos14Rows.length : null
  const sent7 = (sentDays14 ?? []).filter(d => d.social_score != null && (d.day as string) >= sevenDaysAgoStr)
  const sentScore7 = sent7.length > 0
    ? sent7.reduce((s, d) => s + (d.social_score ?? 0), 0) / sent7.length : null

  // Perception audit (q2–q9, 1–5 → 0–100)
  const perceptionIds = new Set((perceptionSurveyIds ?? []).map(s => s.id))
  const perceptionResponses = (surveyResponses ?? []).filter(r => perceptionIds.has(r.survey_id))
  let perceptionScore: number | null = null
  if (perceptionResponses.length >= 2) {
    const dims = ['q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9']
    const dimScores: number[] = []
    for (const r of perceptionResponses) {
      const answers = r.answers as Record<string, unknown>
      for (const key of dims) {
        const val = answers[key]
        if (typeof val === 'number' && val >= 1 && val <= 5) dimScores.push((val / 5) * 100)
      }
    }
    if (dimScores.length > 0) perceptionScore = Math.round(dimScores.reduce((s, v) => s + v, 0) / dimScores.length)
  }

  // Cultural resonance (latest 5 avg)
  const crsVals = (culturalScores ?? []).map(c => c.crs as number).filter(v => v != null)
  const crsAvg  = crsVals.length > 0 ? crsVals.reduce((s, v) => s + v, 0) / crsVals.length : null

  // Marketplace own-product rating (0–5 → ×20 = 0–100)
  const ratingVals = (marketplaceSnaps ?? []).map(m => m.rating as number).filter(v => v != null)
  const ratingAvg  = ratingVals.length > 0 ? ratingVals.reduce((s, v) => s + v, 0) / ratingVals.length : null

  // Action: event lead capture
  const leads    = (allInteractions ?? []).filter(i => ['new_lead', 'new_customer'].includes(i.interaction_type)).length
  const totalInt = (allInteractions ?? []).length
  const leadRate = totalInt > 0 ? (leads / totalInt) * 100 : null

  // Action: e-commerce + referral conversions
  const ecomUnits    = (ecommerceSales ?? []).reduce((s, e) => s + (e.units ?? 0), 0)
  const referralConv = (referralCodes ?? []).reduce((s, c) => s + (c.conversions ?? 0), 0)

  // Loyalty: NPS + customer profiles
  const npsTotal      = (npsRecords ?? []).length
  const npsPromoters  = (npsRecords ?? []).filter(n => n.promoter_type === 'promoter').length
  const npsDetractors = (npsRecords ?? []).filter(n => n.promoter_type === 'detractor').length
  const npsValue = npsTotal >= 3 ? ((npsPromoters - npsDetractors) / npsTotal) * 50 + 50 : null
  const npsPromoterShare = npsTotal >= 3 ? (npsPromoters / npsTotal) * 100 : null

  const profileCount = (customerProfiles ?? []).length
  const repeatCount  = (customerProfiles ?? []).filter(c => (c.total_orders ?? 0) >= 2).length
  const repeatRate   = profileCount > 0 ? (repeatCount / profileCount) * 100 : null
  const avgRetentionRisk = profileCount > 0
    ? (customerProfiles ?? []).reduce((s, c) => s + (c.retention_risk_score ?? 0), 0) / profileCount : null
  const retentionHealth = avgRetentionRisk != null ? 100 - avgRetentionRisk : null

  // Advocacy: referral activity + organic share rate
  const referralActivity = (referralEventCount ?? 0) + referralConv
  const shareRatio = totalEngagements >= 50 ? Math.min(100, (totalShares / totalEngagements) * 500) : null

  // ── Stage composites ────────────────────────────────────────────────────────

  const awareness = computeStageComposite([
    { label: 'Social SOV',            value: sovSnap?.social_sov ?? null, weight: 20, scale: 100,       rawDisplay: sovSnap?.social_sov != null ? `${sovSnap.social_sov.toFixed(1)}%` : null },
    { label: 'OOH Monthly Reach',     value: oohMonthlyReach > 0 ? oohMonthlyReach : null, weight: 18, scale: 5_000_000, rawDisplay: oohMonthlyReach > 0 ? fmtNum(oohMonthlyReach) : null },
    { label: 'Digital Impressions',   value: digitalImpressions > 0 ? digitalImpressions : null, weight: 12, scale: 5_000_000, rawDisplay: digitalImpressions > 0 ? fmtNum(digitalImpressions) : null },
    { label: 'Event Attendance',      value: eventAttendance > 0 ? eventAttendance : null, weight: 10, scale: 10_000, rawDisplay: eventAttendance > 0 ? fmtNum(eventAttendance) : null },
    { label: 'Influencer Post Reach', value: influencerReach > 0 ? influencerReach : null, weight: 8, scale: 2_000_000, rawDisplay: influencerReach > 0 ? fmtNum(influencerReach) : null },
    { label: 'Press / Earned Reach',  value: pressReach > 0 ? pressReach : null, weight: 10, scale: 5_000_000, rawDisplay: pressReach > 0 ? fmtNum(pressReach) : null },
    { label: 'TV GRPs Delivered',     value: (tvSchedules ?? []).length > 0 ? tvGrps : null, weight: 8, scale: 500, rawDisplay: (tvSchedules ?? []).length > 0 ? `${fmtNum(tvGrps)} GRPs` : null },
    { label: 'Radio Spots',           value: (radioSchedules ?? []).length > 0 ? radioSpots : null, weight: 6, scale: 200, rawDisplay: (radioSchedules ?? []).length > 0 ? `${fmtNum(radioSpots)} spots` : null },
    { label: 'AI Visibility',         value: aiVisScore, weight: 8, scale: 100, rawDisplay: aiVisScore != null ? `${aiVisScore}/100` : null },
  ])

  const consideration = computeStageComposite([
    { label: 'Social Engagement Rate', value: avgEngRate != null ? avgEngRate * 10 : null, weight: 25, scale: 100, rawDisplay: avgEngRate != null ? `${avgEngRate.toFixed(2)}% avg` : null },
    { label: 'Consideration Content',  value: (considerationCount ?? 0) > 0 ? (considerationCount ?? 0) : null, weight: 20, scale: 50, rawDisplay: (considerationCount ?? 0) > 0 ? `${considerationCount} posts` : null },
    { label: 'Brand Mention Volume',   value: (mentionCount ?? 0) > 0 ? (mentionCount ?? 0) : null, weight: 15, scale: 300, rawDisplay: (mentionCount ?? 0) > 0 ? `${fmtNum(mentionCount ?? 0)} mentions` : null },
    { label: 'Digital CTR',            value: avgCtr, weight: 20, scale: 0.05, rawDisplay: avgCtr != null ? `${(avgCtr * 100).toFixed(2)}%` : null },
    { label: 'Video View-Through',     value: avgVvr, weight: 10, scale: 0.50, rawDisplay: avgVvr != null ? `${(avgVvr * 100).toFixed(0)}%` : null },
    { label: 'AI Visibility Score',    value: aiVisScore, weight: 10, scale: 100, rawDisplay: aiVisScore != null ? `${aiVisScore}/100` : null },
  ])

  const preference = computeStageComposite([
    { label: 'Sentiment Score (14d avg)',  value: sentScore14, weight: 28, scale: 100, rawDisplay: sentScore14 != null ? `${sentScore14.toFixed(0)}/100` : null },
    { label: 'Positive Sentiment % (14d)', value: posPct14, weight: 12, scale: 100, rawDisplay: posPct14 != null ? `${posPct14.toFixed(0)}%` : null },
    { label: 'Perception Quality',         value: perceptionScore, weight: 20, scale: 100, rawDisplay: perceptionScore != null ? `${perceptionScore}/100` : null },
    { label: 'Cultural Resonance',         value: crsAvg, weight: 18, scale: 100, rawDisplay: crsAvg != null ? `${crsAvg.toFixed(0)}/100` : null },
    { label: 'Press Sentiment',            value: pressTotal > 0 ? (pressPositive / pressTotal) * 100 : null, weight: 12, scale: 100, rawDisplay: pressTotal > 0 ? `${pressPositive}/${pressTotal} positive` : null },
    { label: 'Marketplace Own Rating',     value: ratingAvg != null ? ratingAvg * 20 : null, weight: 10, scale: 100, rawDisplay: ratingAvg != null ? `${ratingAvg.toFixed(1)}★` : null },
  ])

  const action = computeStageComposite([
    { label: 'Purchase Events',      value: (purchaseSuccessCount ?? 0) > 0 ? (purchaseSuccessCount ?? 0) : null, weight: 20, scale: 50, rawDisplay: (purchaseSuccessCount ?? 0) > 0 ? `${purchaseSuccessCount} purchases` : null },
    { label: 'E-commerce Sales',     value: ecomUnits > 0 ? ecomUnits : null, weight: 18, scale: 200, rawDisplay: ecomUnits > 0 ? `${fmtNum(ecomUnits)} units` : null },
    { label: 'Digital Conversions',  value: digitalConversions > 0 ? digitalConversions : null, weight: 18, scale: 500, rawDisplay: digitalConversions > 0 ? `${fmtNum(digitalConversions)} conv` : null },
    { label: 'Event Lead Capture',   value: leadRate, weight: 15, scale: 100, rawDisplay: totalInt > 0 ? `${leads}/${totalInt} leads` : null },
    { label: 'OOH Visit-throughs',   value: (oohSites ?? []).length > 0 ? oohVisits : null, weight: 12, scale: 1000, rawDisplay: (oohSites ?? []).length > 0 ? `${fmtNum(oohVisits)} visits` : null },
    { label: 'Referral Conversions', value: referralConv > 0 ? referralConv : null, weight: 10, scale: 50, rawDisplay: referralConv > 0 ? `${fmtNum(referralConv)} conv` : null },
    { label: 'SDK Conversions',      value: (sdkConversionCount ?? 0) > 0 ? (sdkConversionCount ?? 0) : null, weight: 7, scale: 100, rawDisplay: (sdkConversionCount ?? 0) > 0 ? `${fmtNum(sdkConversionCount ?? 0)} events` : null },
  ])

  const loyalty = computeStageComposite([
    { label: 'NPS Score',                value: npsValue, weight: 30, scale: 100, rawDisplay: npsValue != null ? `${npsPromoters}P / ${npsDetractors}D of ${npsTotal}` : null },
    { label: 'Repeat Customer Rate',     value: repeatRate, weight: 25, scale: 100, rawDisplay: repeatRate != null ? `${repeatCount}/${profileCount} repeat` : null },
    { label: 'Retention Health',         value: retentionHealth, weight: 22, scale: 100, rawDisplay: retentionHealth != null ? `${retentionHealth.toFixed(0)}/100` : null },
    { label: 'Loyalty Program Activity', value: (loyaltyEarnCount ?? 0) > 0 ? (loyaltyEarnCount ?? 0) : null, weight: 13, scale: 100, rawDisplay: (loyaltyEarnCount ?? 0) > 0 ? `${fmtNum(loyaltyEarnCount ?? 0)} earns` : null },
    { label: 'Post-purchase Sentiment', value: sentScore7, weight: 10, scale: 100, rawDisplay: sentScore7 != null ? `${sentScore7.toFixed(0)}/100` : null },
  ])

  const advocacy = computeStageComposite([
    { label: 'Advocacy Score (weekly)', value: advocacyScore?.advocacy_score ?? null, weight: 30, scale: 100, rawDisplay: advocacyScore?.advocacy_score != null ? `${Number(advocacyScore.advocacy_score).toFixed(0)}/100` : null },
    { label: 'Referral Activity',       value: referralActivity > 0 ? referralActivity : null, weight: 22, scale: 50, rawDisplay: referralActivity > 0 ? `${referralEventCount ?? 0} events + ${referralConv} conv` : null },
    { label: 'Active Promoters',        value: (activePromoterCount ?? 0) > 0 ? (activePromoterCount ?? 0) : null, weight: 18, scale: 20, rawDisplay: (activePromoterCount ?? 0) > 0 ? `${activePromoterCount} active` : null },
    { label: 'NPS Promoter Share',      value: npsPromoterShare, weight: 15, scale: 100, rawDisplay: npsPromoterShare != null ? `${npsPromoterShare.toFixed(0)}%` : null },
    { label: 'Visual Brand Advocacy',   value: (visualAdvocacyCount ?? 0) > 0 ? (visualAdvocacyCount ?? 0) : null, weight: 10, scale: 30, rawDisplay: (visualAdvocacyCount ?? 0) > 0 ? `${visualAdvocacyCount} posts` : null },
    { label: 'Organic Share Rate',      value: shareRatio, weight: 5, scale: 100, rawDisplay: totalEngagements >= 50 ? `${totalShares} shares / ${fmtNum(totalEngagements)} eng` : null },
  ])

  const activeCount = (b: { sources: { score: number | null }[] }) =>
    b.sources.filter(s => s.score !== null).length

  const scores = {
    awareness: {
      score:      awareness.score,
      source:     'SOV · OOH · Digital · Press · TV · Radio · AI',
      dataPoints: activeCount(awareness.breakdown),
      breakdown:  awareness.breakdown.sources,
    },
    consideration: {
      score:      consideration.score,
      source:     'Engagement · Content · Mentions · CTR · Video · AI',
      dataPoints: activeCount(consideration.breakdown),
      breakdown:  consideration.breakdown.sources,
    },
    preference: {
      score:      preference.score,
      source:     'Sentiment · Perception · Cultural · Press · Marketplace',
      dataPoints: activeCount(preference.breakdown),
      breakdown:  preference.breakdown.sources,
    },
    action: {
      score:      action.score,
      source:     'Purchases · Sales · Conversions · Leads · OOH · Referrals',
      dataPoints: activeCount(action.breakdown),
      breakdown:  action.breakdown.sources,
    },
    loyalty: {
      score:      loyalty.score,
      source:     'NPS · Repeat rate · Retention · Loyalty · Sentiment',
      dataPoints: activeCount(loyalty.breakdown),
      breakdown:  loyalty.breakdown.sources,
    },
    advocacy: {
      score:      advocacy.score,
      source:     'Advocacy · Referrals · Promoters · NPS · Visual · Shares',
      dataPoints: activeCount(advocacy.breakdown),
      breakdown:  advocacy.breakdown.sources,
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
