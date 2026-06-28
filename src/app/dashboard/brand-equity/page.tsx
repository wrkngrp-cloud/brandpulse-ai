import { createClient }  from '@/lib/supabase/server'
import { redirect }      from 'next/navigation'
import {
  computeFullBHI,
  computeAwarenessComposite,
  type FullBHIComponents,
  type BHIBreakdowns,
  type ComponentBreakdown,
  type BreakdownSource,
} from '@/lib/bhi'
import { BrandEquityClient } from './brand-equity-client'
import { DateRangeFilter } from '@/components/dashboard/date-range-filter'
import { SeedDemoPanel } from './seed-demo-panel'
import { getActiveBrandId } from '@/lib/active-brand'

export const dynamic = 'force-dynamic'

const NGN_CPM_BENCHMARK = 500    // ₦ per 1,000 impressions (organic social)
const NGN_CPE_BENCHMARK = 50     // ₦ per engagement
const EMV_SCALE_MAX     = 10_000_000  // ₦10M EMV → score 100

export default async function BrandEquityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const days = Math.min(365, Math.max(7, Number(params.days ?? 30)))

  const DEMO_EMAIL = 'demo@jarafoods.brandpulse.ai'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const isDemoUser = user.email === DEMO_EMAIL

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffDate = cutoff.toISOString().split('T')[0]
  const cutoffISO  = cutoff.toISOString()
  const todayDate  = new Date().toISOString().split('T')[0]

  const brandId = await getActiveBrandId(supabase)
  const bid = brandId ?? ''

  const [
    { data: sentDays },
    { data: sovSnap },
    { data: allResponses },
    { data: perceptionSurveyIds },
    { data: socialPosts },
    { data: brand },
    { data: bhiHistory },
    { data: culturalScores },
    { data: oohSites },
    { data: brandEvents },
    { data: digitalPerf },
    { data: influencers },
  ] = await Promise.all([
    supabase
      .from('sentiment_daily')
      .select('social_score, day, platform_breakdown')
      .eq('brand_id', bid)
      .gte('day', cutoffDate)
      .order('day', { ascending: false }),
    supabase
      .from('sov_snapshots')
      .select('social_sov, snapshot_date')
      .eq('brand_id', bid)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('survey_responses')
      .select('answers, survey_id')
      .eq('quality_flag', 'ok'),
    supabase
      .from('surveys')
      .select('id')
      .eq('brand_id', bid)
      .eq('type', 'perception_audit'),
    supabase
      .from('social_posts')
      .select('impressions, reach, likes, comments, shares')
      .eq('brand_id', bid)
      .gte('posted_at', cutoffISO),
    bid
      ? supabase.from('brands').select('name, category, market_share_pct').eq('id', bid).maybeSingle()
      : supabase.from('brands').select('name, category, market_share_pct').limit(1).maybeSingle(),
    supabase
      .from('brand_health_snapshots')
      .select('bhi, snapshot_date')
      .eq('brand_id', bid)
      .order('snapshot_date', { ascending: false })
      .limit(days),
    supabase
      .from('pre_post_analyses')
      .select('cultural_score')
      .eq('brand_id', bid)
      .not('cultural_score', 'is', null)
      .order('created_at', { ascending: false })
      .limit(30),
    // ── Awareness sub-sources ──
    supabase
      .from('ooh_sites')
      .select('daily_traffic, campaign_end')
      .eq('brand_id', bid)
      .gte('campaign_end', todayDate),
    supabase
      .from('events')
      .select('debrief')
      .eq('brand_id', bid)
      .gte('date_start', cutoffDate)
      .lte('date_start', todayDate),
    supabase
      .from('digital_performance_daily')
      .select('impressions')
      .eq('brand_id', bid)
      .gte('date', cutoffDate),
    supabase
      .from('influencers')
      .select('latest_post_reach')
      .eq('brand_id', bid),
  ])

  // ── 1. Awareness (20%) — multi-source composite
  const oohReach = (oohSites ?? []).reduce(
    (sum, s) => sum + (s.daily_traffic ?? 0) * days,
    0,
  )
  const eventAttendanceTotal = (brandEvents ?? []).reduce((sum, e) => {
    const debrief = e.debrief as { actual_attendance?: number } | null
    return sum + (debrief?.actual_attendance ?? 0)
  }, 0)
  const digitalImpressionsTotal = (digitalPerf ?? []).reduce(
    (sum, d) => sum + (d.impressions ?? 0),
    0,
  )
  const influencerReachTotal = (influencers ?? []).reduce(
    (sum, i) => sum + (i.latest_post_reach ?? 0),
    0,
  )

  const awarenessResult = computeAwarenessComposite({
    socialSov:          sovSnap?.social_sov ?? null,
    oohMonthlyReach:    oohReach > 0           ? oohReach              : null,
    eventAttendance:    eventAttendanceTotal > 0 ? eventAttendanceTotal : null,
    digitalImpressions: digitalImpressionsTotal > 0 ? digitalImpressionsTotal : null,
    influencerReach:    influencerReachTotal > 0 ? influencerReachTotal : null,
  })
  const awarenessScore: number | null = awarenessResult.score

  // ── 2. Salience (15%) — aided awareness rate from surveys
  // From awareness_check / b2_intercept responses: all respondents are already aware
  // From awareness_check q1, "Yes — I know them well" / "Yes — I have heard of them"
  const awarenessCheckIds = new Set<string>()
  const { data: awSurveys } = await supabase
    .from('surveys')
    .select('id')
    .in('type', ['awareness_check', 'b2_intercept'])

  for (const s of awSurveys ?? []) awarenessCheckIds.add(s.id)

  const awarenessResponses = (allResponses ?? []).filter(r => awarenessCheckIds.has(r.survey_id))
  let salienceScore: number | null = null
  if (awarenessResponses.length >= 3) {
    const knownCount = awarenessResponses.filter(r => {
      const answers = r.answers as Record<string, unknown>
      const q1 = answers['q1']
      return typeof q1 === 'string' && q1.toLowerCase().startsWith('yes')
    }).length
    salienceScore = Math.round((knownCount / awarenessResponses.length) * 100)
  }

  // ── 3. Sentiment (20%) — avg score last 14 days
  const sentWithData = (sentDays ?? []).filter(d => d.social_score != null)
  const sentimentScore: number | null = sentWithData.length > 0
    ? Math.round(sentWithData.reduce((s, d) => s + (d.social_score ?? 0), 0) / sentWithData.length)
    : null

  // ── 4. Perception (15%) — avg of perception audit question ratings (q2-q9), normalized
  const perceptionIds = new Set((perceptionSurveyIds ?? []).map(s => s.id))
  const perceptionResponses = (allResponses ?? []).filter(r => perceptionIds.has(r.survey_id))

  let perceptionScore: number | null = null
  if (perceptionResponses.length >= 2) {
    const dimensionKeys = ['q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9']
    const dimensionScores: number[] = []

    for (const r of perceptionResponses) {
      const answers = r.answers as Record<string, unknown>
      for (const key of dimensionKeys) {
        const val = answers[key]
        if (typeof val === 'number' && val >= 1 && val <= 5) {
          dimensionScores.push((val / 5) * 100)
        }
      }
    }
    if (dimensionScores.length > 0) {
      perceptionScore = Math.round(
        dimensionScores.reduce((s, v) => s + v, 0) / dimensionScores.length
      )
    }
  }

  // ── 5. Cultural Resonance (15%) — average of pre/post cultural scores
  const validCultural = (culturalScores ?? []).filter(r => r.cultural_score != null)
  const culturalResonance: number | null = validCultural.length > 0
    ? Math.round(
        validCultural.reduce((s, r) => s + (r.cultural_score ?? 0), 0) / validCultural.length
      )
    : null

  // ── 6. Blended SOV (10%) — same source as awareness for now
  const blendedSov: number | null = sovSnap?.social_sov ?? null

  // ── 7. EMV (5%) — computed from social posts
  const totalImpressions = (socialPosts ?? []).reduce((s, p) => s + (p.impressions ?? 0), 0)
  const totalReach       = (socialPosts ?? []).reduce((s, p) => s + (p.reach ?? 0), 0)
  const totalEngagements = (socialPosts ?? []).reduce(
    (s, p) => s + (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0), 0
  )
  const emvRaw = ((totalImpressions + totalReach) * (NGN_CPM_BENCHMARK / 1000)) + (totalEngagements * NGN_CPE_BENCHMARK)
  const emvScore: number | null = (socialPosts ?? []).length > 0
    ? Math.min(Math.round((emvRaw / EMV_SCALE_MAX) * 100), 100)
    : null

  // ── Build per-component breakdowns ────────────────────────────────────────

  // Sentiment: aggregate per-platform from platform_breakdown JSONB
  type PlatformEntry = { volume?: number; score?: number }
  const platformTotals: Record<string, { weightedScore: number; totalVolume: number }> = {}
  for (const day of sentWithData) {
    const pb = (day as { platform_breakdown?: Record<string, PlatformEntry> }).platform_breakdown
    if (!pb) continue
    for (const [platform, entry] of Object.entries(pb)) {
      const vol   = (entry as PlatformEntry).volume ?? 0
      const score = (entry as PlatformEntry).score  ?? 0
      if (vol > 0) {
        if (!platformTotals[platform]) platformTotals[platform] = { weightedScore: 0, totalVolume: 0 }
        platformTotals[platform].weightedScore += score * vol
        platformTotals[platform].totalVolume   += vol
      }
    }
  }
  const platformNames: Record<string, string> = {
    twitter: 'X (Twitter)', instagram: 'Instagram', tiktok: 'TikTok',
    facebook: 'Facebook', linkedin: 'LinkedIn',
  }
  const sentimentSources: BreakdownSource[] = Object.entries(platformTotals).map(([p, t]) => {
    const avgScore = Math.round(t.weightedScore / t.totalVolume)
    return {
      label:      platformNames[p] ?? p,
      rawDisplay: `${Math.round(t.totalVolume).toLocaleString('en-NG')} mentions`,
      weight:     Math.round((t.totalVolume / Object.values(platformTotals).reduce((s, v) => s + v.totalVolume, 0)) * 100),
      score:      avgScore,
    }
  })
  // If no platform breakdown available, fall back to the blended score as single source
  const sentimentBreakdown: ComponentBreakdown = sentimentSources.length > 0
    ? { sources: sentimentSources, composite: sentimentScore }
    : {
        sources: [{ label: 'Social (blended)', rawDisplay: null, weight: 100, score: sentimentScore }],
        composite: sentimentScore,
      }

  // Simple single-source breakdowns for the remaining components
  const mkSingle = (label: string, rawDisplay: string | null, score: number | null): ComponentBreakdown => ({
    sources: [{ label, rawDisplay, weight: 100, score }],
    composite: score,
  })

  const breakdowns: BHIBreakdowns = {
    awareness:         awarenessResult.breakdown,
    sentiment:         sentimentBreakdown,
    salience:          mkSingle('Awareness Check surveys', salienceScore !== null ? `${salienceScore}% aware` : null, salienceScore),
    perception:        mkSingle('Perception Audit surveys', perceptionScore !== null ? `${perceptionScore}/100` : null, perceptionScore),
    culturalResonance: mkSingle('Cultural analyses', culturalResonance !== null ? `${culturalResonance}/100` : null, culturalResonance),
    blendedSov:        mkSingle('Social SOV', blendedSov !== null ? `${blendedSov?.toFixed(1)}%` : null, blendedSov),
    emv:               mkSingle('Social posts EMV', emvScore !== null ? `${emvScore}/100` : null, emvScore),
  }

  // ── Compute full BHI
  const components: FullBHIComponents = {
    awareness: awarenessScore, salience: salienceScore, sentiment: sentimentScore,
    perception: perceptionScore, culturalResonance, blendedSov, emv: emvScore,
  }
  const bhi = computeFullBHI(components, breakdowns)

  // ── Perception radar data (8 dimensions)
  const DIMENSIONS = ['Quality', 'Trust', 'Innovation', 'Value', 'Cultural Relevance', 'Accessibility', 'Reliability', 'Emotional Connection']
  const dimensionAvgs = DIMENSIONS.map((label, idx) => {
    const key = `q${idx + 2}`
    const vals: number[] = []
    for (const r of perceptionResponses) {
      const answers = r.answers as Record<string, unknown>
      const v = answers[key]
      if (typeof v === 'number' && v >= 1 && v <= 5) vals.push(v)
    }
    return {
      dimension: label,
      score:     vals.length > 0
        ? Number((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2))
        : null,
    }
  })

  // ── Sector benchmarks
  const sectorMap: Record<string, string> = {
    'fmcg':'FMCG','consumer goods':'FMCG','fintech':'Fintech','financial services':'Fintech',
    'banking':'Fintech','telecommunications':'Telecommunications','telecom':'Telecommunications',
    'entertainment':'Entertainment','media':'Entertainment','e-commerce':'E-commerce',
    'retail':'E-commerce','fashion':'Fashion','lifestyle':'Fashion','food & beverage':'Food & Beverage',
    'food':'Food & Beverage','healthcare':'Healthcare','technology':'Technology','tech':'Technology',
    'real estate':'Real Estate',
  }
  const sector = sectorMap[(brand?.category ?? '').toLowerCase().trim()] ?? 'FMCG'
  const { data: benchmarkRows } = await supabase
    .from('sector_benchmarks')
    .select('metric, p25, p50, p75, top_decile')
    .eq('sector', sector)
  const benchmarks: Record<string, { p25: number; p50: number; p75: number; top_decile: number }> = {}
  for (const b of benchmarkRows ?? []) {
    benchmarks[b.metric] = { p25: b.p25, p50: b.p50, p75: b.p75, top_decile: b.top_decile }
  }

  // ── NPS for ESOV (also shown in BHI)
  const npsScores: number[] = []
  for (const r of allResponses ?? []) {
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
  const currentNps = npsScores.length >= 3
    ? Math.round(((promoters - detractors) / npsScores.length) * 100)
    : null

  // ── BHI history sparkline — uses brand_health_snapshots.bhi (real BHI, not sentiment)
  const sparkline = (bhiHistory ?? [])
    .filter(d => d.bhi != null)
    .reverse()
    .map(d => ({ date: d.snapshot_date, score: d.bhi }))

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Brand Equity Tracker</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Full 7-component Brand Health Index, ESOV engine, and perception analysis for{' '}
            {brand?.name ?? 'your brand'}.
          </p>
        </div>
        <DateRangeFilter currentDays={days} defaultDays={30} />
      </div>

      <BrandEquityClient
        bhi={bhi}
        sparkline={sparkline}
        sovPct={sovSnap?.social_sov ?? null}
        currentNps={currentNps}
        npsTotal={npsScores.length}
        emvRaw={Math.round(emvRaw)}
        perceptionDimensions={dimensionAvgs}
        brandName={brand?.name ?? 'your brand'}
        industry={brand?.category ?? null}
        marketSharePct={brand?.market_share_pct ?? null}
        days={days}
        sector={sector}
        benchmarks={benchmarks}
      />

      {isDemoUser && (
        <SeedDemoPanel />
      )}
    </div>
  )
}
