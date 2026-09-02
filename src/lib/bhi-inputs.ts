import type { SupabaseClient } from '@supabase/supabase-js'
import {
  computeAwarenessComposite,
  resolveBrandType,
  type FullBHIComponents,
  type BHIBreakdowns,
  type ComponentBreakdown,
  type BreakdownSource,
  type BrandType,
} from '@/lib/bhi'

// Single source of truth for the seven BHI component inputs.
//
// Every surface that shows a BHI reads from here: the Overview, Brand Equity,
// the nightly snapshot job, and the Ask AI context. Before this existed each of
// those assembled its own inputs, and they had drifted far enough apart that the
// same brand scored differently depending on which page you opened.

export const NGN_CPM_BENCHMARK = 500          // ₦ per 1,000 impressions (organic social)
export const NGN_CPE_BENCHMARK = 50           // ₦ per engagement
export const EMV_SCALE_MAX     = 10_000_000   // ₦10M EMV → score 100

// Bump when a component's formula or scaling changes, so a stored snapshot can
// always be traced back to the formula that produced it.
export const BHI_FORMULA_VERSION = 2

export interface BHIInputs {
  components: FullBHIComponents
  breakdowns: BHIBreakdowns
  brandType:  BrandType
  /** Derived values some pages display alongside the score. Computed here so
   *  they always agree with the components rather than being re-derived. */
  extras: {
    /** Earned media value in naira, before normalising to a 0-100 score. */
    emvRaw: number
    /** Perception audit responses, for the 8-dimension radar on Brand Equity. */
    perceptionResponses: { answers: unknown; survey_id: string }[]
  }
}

const PLATFORM_NAMES: Record<string, string> = {
  twitter: 'X (Twitter)', instagram: 'Instagram', tiktok: 'TikTok',
  facebook: 'Facebook', linkedin: 'LinkedIn',
}

function mkSingle(label: string, rawDisplay: string | null, score: number | null): ComponentBreakdown {
  return { sources: [{ label, rawDisplay, weight: 100, score }], composite: score }
}

/**
 * Load every BHI component for a brand over a rolling window.
 *
 * Works with either Supabase client. Callers holding the RLS client get their
 * own workspace's rows; the nightly job passes the service client and an
 * explicit brandId. Every query is scoped by brand_id either way, so a
 * multi-brand workspace cannot bleed one brand's data into another's score.
 */
export async function loadBHIInputs(
  supabase: SupabaseClient,
  brandId:  string,
  days     = 30,
): Promise<BHIInputs> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffDate = cutoff.toISOString().split('T')[0]
  const cutoffISO  = cutoff.toISOString()
  const todayDate  = new Date().toISOString().split('T')[0]

  const [
    { data: sentDays },
    { data: sovSnap },
    { data: brand },
    { data: perceptionSurveyIds },
    { data: awarenessSurveyIds },
    { data: socialPosts },
    { data: culturalScores },
    { data: oohSites },
    { data: brandEvents },
    { data: digitalPerf },
    { data: influencers },
  ] = await Promise.all([
    supabase.from('sentiment_daily')
      .select('social_score, day, platform_breakdown')
      .eq('brand_id', brandId).gte('day', cutoffDate)
      .order('day', { ascending: false }),
    supabase.from('sov_snapshots')
      .select('social_sov, snapshot_date')
      .eq('brand_id', brandId)
      .order('snapshot_date', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('brands')
      .select('brand_type, industry').eq('id', brandId).maybeSingle(),
    supabase.from('surveys')
      .select('id').eq('brand_id', brandId).eq('type', 'perception_audit'),
    supabase.from('surveys')
      .select('id').eq('brand_id', brandId).in('type', ['awareness_check', 'b2_intercept']),
    supabase.from('social_posts')
      .select('impressions, reach, likes, comments, shares')
      .eq('brand_id', brandId).gte('posted_at', cutoffISO),
    supabase.from('pre_post_analyses')
      .select('cultural_score').eq('brand_id', brandId)
      .not('cultural_score', 'is', null)
      .order('created_at', { ascending: false }).limit(30),
    supabase.from('ooh_sites')
      .select('daily_traffic, campaign_end')
      .eq('brand_id', brandId).gte('campaign_end', todayDate),
    supabase.from('events')
      .select('debrief').eq('brand_id', brandId)
      .gte('date_start', cutoffDate).lte('date_start', todayDate),
    supabase.from('digital_performance_daily')
      .select('impressions').eq('brand_id', brandId).gte('date', cutoffDate),
    supabase.from('influencers')
      .select('latest_post_reach').eq('brand_id', brandId),
  ])

  // Survey responses are fetched by survey id, which is already brand-scoped above.
  const surveyIds = [
    ...(perceptionSurveyIds ?? []).map(s => s.id),
    ...(awarenessSurveyIds  ?? []).map(s => s.id),
  ]
  const { data: allResponses } = surveyIds.length > 0
    ? await supabase.from('survey_responses')
        .select('answers, survey_id')
        .eq('quality_flag', 'ok')
        .in('survey_id', surveyIds)
    : { data: [] as { answers: unknown; survey_id: string }[] }

  // ── 1. Awareness — multi-source composite
  const oohReach = (oohSites ?? []).reduce((sum, s) => sum + (s.daily_traffic ?? 0) * days, 0)
  const eventAttendanceTotal = (brandEvents ?? []).reduce((sum, e) => {
    const debrief = e.debrief as { actual_attendance?: number } | null
    return sum + (debrief?.actual_attendance ?? 0)
  }, 0)
  const digitalImpressionsTotal = (digitalPerf ?? []).reduce((sum, d) => sum + (d.impressions ?? 0), 0)
  const influencerReachTotal    = (influencers ?? []).reduce((sum, i) => sum + (i.latest_post_reach ?? 0), 0)

  const awarenessResult = computeAwarenessComposite({
    socialSov:          sovSnap?.social_sov ?? null,
    oohMonthlyReach:    oohReach > 0                ? oohReach                : null,
    eventAttendance:    eventAttendanceTotal > 0    ? eventAttendanceTotal    : null,
    digitalImpressions: digitalImpressionsTotal > 0 ? digitalImpressionsTotal : null,
    influencerReach:    influencerReachTotal > 0    ? influencerReachTotal    : null,
  })

  // ── 2. Salience — aided awareness rate from surveys
  const awarenessIds = new Set((awarenessSurveyIds ?? []).map(s => s.id))
  const awarenessResponses = (allResponses ?? []).filter(r => awarenessIds.has(r.survey_id))
  let salienceScore: number | null = null
  if (awarenessResponses.length >= 3) {
    const knownCount = awarenessResponses.filter(r => {
      const q1 = (r.answers as Record<string, unknown>)?.['q1']
      return typeof q1 === 'string' && q1.toLowerCase().startsWith('yes')
    }).length
    salienceScore = Math.round((knownCount / awarenessResponses.length) * 100)
  }

  // ── 3. Sentiment — average daily score across the window
  const sentWithData = (sentDays ?? []).filter(d => d.social_score != null)
  const sentimentScore: number | null = sentWithData.length > 0
    ? Math.round(sentWithData.reduce((s, d) => s + (d.social_score ?? 0), 0) / sentWithData.length)
    : null

  // ── 4. Perception — average of perception audit ratings (q2–q9), normalised
  const perceptionIds = new Set((perceptionSurveyIds ?? []).map(s => s.id))
  const perceptionResponses = (allResponses ?? []).filter(r => perceptionIds.has(r.survey_id))
  let perceptionScore: number | null = null
  if (perceptionResponses.length >= 2) {
    const dimensionScores: number[] = []
    for (const r of perceptionResponses) {
      const answers = r.answers as Record<string, unknown>
      for (const key of ['q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9']) {
        const val = answers?.[key]
        if (typeof val === 'number' && val >= 1 && val <= 5) dimensionScores.push((val / 5) * 100)
      }
    }
    if (dimensionScores.length > 0) {
      perceptionScore = Math.round(dimensionScores.reduce((s, v) => s + v, 0) / dimensionScores.length)
    }
  }

  // ── 5. Cultural resonance — average of pre/post cultural scores
  const validCultural = (culturalScores ?? []).filter(r => r.cultural_score != null)
  const culturalResonance: number | null = validCultural.length > 0
    ? Math.round(validCultural.reduce((s, r) => s + (r.cultural_score ?? 0), 0) / validCultural.length)
    : null

  // ── 6. Blended SOV
  const blendedSov: number | null = sovSnap?.social_sov ?? null

  // ── 7. EMV — from social post reach and engagement
  const posts = socialPosts ?? []
  const totalImpressions = posts.reduce((s, p) => s + (p.impressions ?? 0), 0)
  const totalReach       = posts.reduce((s, p) => s + (p.reach ?? 0), 0)
  const totalEngagements = posts.reduce((s, p) => s + (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0), 0)
  const emvRaw = ((totalImpressions + totalReach) * (NGN_CPM_BENCHMARK / 1000)) + (totalEngagements * NGN_CPE_BENCHMARK)
  const emvScore: number | null = posts.length > 0
    ? Math.min(Math.round((emvRaw / EMV_SCALE_MAX) * 100), 100)
    : null

  // ── Per-platform sentiment breakdown
  type PlatformEntry = { volume?: number; score?: number }
  const platformTotals: Record<string, { weightedScore: number; totalVolume: number }> = {}
  for (const day of sentWithData) {
    const pb = (day as { platform_breakdown?: Record<string, PlatformEntry> }).platform_breakdown
    if (!pb) continue
    for (const [platform, entry] of Object.entries(pb)) {
      const vol   = entry?.volume ?? 0
      const score = entry?.score  ?? 0
      if (vol > 0) {
        platformTotals[platform] ??= { weightedScore: 0, totalVolume: 0 }
        platformTotals[platform].weightedScore += score * vol
        platformTotals[platform].totalVolume   += vol
      }
    }
  }
  const volumeAcrossPlatforms = Object.values(platformTotals).reduce((s, v) => s + v.totalVolume, 0)
  const sentimentSources: BreakdownSource[] = Object.entries(platformTotals).map(([p, t]) => ({
    label:      PLATFORM_NAMES[p] ?? p,
    rawDisplay: `${Math.round(t.totalVolume).toLocaleString('en-NG')} mentions`,
    weight:     volumeAcrossPlatforms > 0 ? Math.round((t.totalVolume / volumeAcrossPlatforms) * 100) : 0,
    score:      Math.round(t.weightedScore / t.totalVolume),
  }))
  const sentimentBreakdown: ComponentBreakdown = sentimentSources.length > 0
    ? { sources: sentimentSources, composite: sentimentScore }
    : mkSingle('Social (blended)', null, sentimentScore)

  const components: FullBHIComponents = {
    awareness:  awarenessResult.score,
    salience:   salienceScore,
    sentiment:  sentimentScore,
    perception: perceptionScore,
    culturalResonance,
    blendedSov,
    emv:        emvScore,
  }

  const breakdowns: BHIBreakdowns = {
    awareness:         awarenessResult.breakdown,
    sentiment:         sentimentBreakdown,
    salience:          mkSingle('Awareness Check surveys', salienceScore  !== null ? `${salienceScore}% aware`   : null, salienceScore),
    perception:        mkSingle('Perception Audit surveys', perceptionScore !== null ? `${perceptionScore}/100`  : null, perceptionScore),
    culturalResonance: mkSingle('Cultural analyses', culturalResonance !== null ? `${culturalResonance}/100` : null, culturalResonance),
    blendedSov:        mkSingle('Social SOV', blendedSov !== null ? `${blendedSov.toFixed(1)}%` : null, blendedSov),
    emv:               mkSingle('Social posts EMV', emvScore !== null ? `${emvScore}/100` : null, emvScore),
  }

  return {
    components,
    breakdowns,
    brandType: resolveBrandType(brand?.brand_type, brand?.industry),
    extras: { emvRaw, perceptionResponses },
  }
}
