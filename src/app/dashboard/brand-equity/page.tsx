import { createClient }  from '@/lib/supabase/server'
import { redirect }      from 'next/navigation'
import { computeFullBHI, type FullBHIComponents } from '@/lib/bhi'
import { BrandEquityClient } from './brand-equity-client'
import { DateRangeFilter } from '@/components/dashboard/date-range-filter'
import { SeedDemoPanel } from './seed-demo-panel'

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
  const days = Math.min(180, Math.max(7, Number(params.days ?? 30)))

  const DEMO_EMAIL = 'demo@jarafoods.brandpulse.ai'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const isDemoUser = user.email === DEMO_EMAIL

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffDate = cutoff.toISOString().split('T')[0]
  const cutoffISO  = cutoff.toISOString()

  const [
    { data: sentDays },
    { data: sovSnap },
    { data: allResponses },
    { data: perceptionSurveyIds },
    { data: socialPosts },
    { data: brand },
    { data: bhiHistory },
    { data: culturalScores },
  ] = await Promise.all([
    supabase
      .from('sentiment_daily')
      .select('social_score, day')
      .gte('day', cutoffDate)
      .order('day', { ascending: false }),
    supabase
      .from('sov_snapshots')
      .select('social_sov, snapshot_date')
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
      .eq('type', 'perception_audit'),
    supabase
      .from('social_posts')
      .select('impressions, reach, likes, comments, shares')
      .gte('posted_at', cutoffISO),
    supabase
      .from('brands')
      .select('name, industry')
      .limit(1)
      .maybeSingle(),
    supabase
      .from('brand_health_snapshots')
      .select('bhi, snapshot_date')
      .order('snapshot_date', { ascending: false })
      .limit(days),
    supabase
      .from('pre_post_analyses')
      .select('cultural_score')
      .not('cultural_score', 'is', null)
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  // ── 1. Awareness (20%) — SOV %
  const awarenessScore: number | null = sovSnap?.social_sov ?? null

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
      return Object.values(answers).some(v => typeof v === 'string' && v.toLowerCase().startsWith('yes'))
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

  // ── Compute full BHI
  const components: FullBHIComponents = {
    awareness: awarenessScore, salience: salienceScore, sentiment: sentimentScore,
    perception: perceptionScore, culturalResonance, blendedSov, emv: emvScore,
  }
  const bhi = computeFullBHI(components)

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
        industry={brand?.industry ?? null}
        days={days}
      />

      {isDemoUser && (
        <SeedDemoPanel />
      )}
    </div>
  )
}
