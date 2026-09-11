import { createClient }  from '@/lib/supabase/server'
import { redirect }      from 'next/navigation'
import { computeFullBHI, computeTrustScore } from '@/lib/bhi'
import { BrandEquityClient } from './brand-equity-client'
import { LaunchMarkersPanel } from './launch-markers-panel'
import { AspectSentimentPanel } from './aspect-sentiment-panel'
import { DeveloperHealthPanel } from './developer-health-panel'
import { DateRangeFilter } from '@/components/dashboard/date-range-filter'
import { TourTrigger } from '@/components/tours/tour-trigger'
import { SeedDemoPanel } from './seed-demo-panel'
import { VenueReputationPanel } from './venue-reputation-panel'
import { TrustPillarCard } from './trust-pillar-card'
import { getActiveBrandId } from '@/lib/active-brand'
import { loadBHIInputs } from '@/lib/bhi-inputs'
import { PageHeader } from '@/components/dashboard/page-header'
import { PAGE_META } from '@/components/dashboard/page-meta'

export const dynamic = 'force-dynamic'

export default async function BrandEquityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const days = Math.min(365, Math.max(7, Number(params.days ?? 30)))

  const DEMO_EMAIL = 'demo@jarafoods.brandgauge.app'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const isDemoUser = user.email === DEMO_EMAIL

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffDate = cutoff.toISOString().split('T')[0]

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const brandId = await getActiveBrandId(supabase)
  const bid = brandId ?? ''

  const [
    { data: sentDays },
    { data: sovSnap },
    { data: allResponses },
    { data: brand },
    { data: bhiHistory },
    { data: venueSnapshot },
    { data: appStoreSnaps },
    { data: regMentions },
    { data: volumeSurgeAlerts },
    { data: launchMarkers },
    { data: aspectRows },
    { data: devHealthSnaps },
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
    bid
      ? supabase.from('brands').select('name, category, industry, market_share_pct, brand_type, google_place_id').eq('id', bid).maybeSingle()
      : supabase.from('brands').select('name, category, industry, market_share_pct, brand_type, google_place_id').limit(1).maybeSingle(),
    supabase
      .from('brand_health_snapshots')
      .select('bhi, snapshot_date')
      .eq('brand_id', bid)
      .order('snapshot_date', { ascending: false })
      .limit(days),
    supabase
      .from('review_platform_snapshots')
      .select('rating, review_count, review_velocity, period_end, metadata')
      .eq('brand_id', bid)
      .eq('platform', 'google_maps')
      .order('period_end', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('review_platform_snapshots')
      .select('platform, rating, review_count, period_end')
      .eq('brand_id', bid)
      .in('platform', ['app_store', 'play_store'])
      .order('period_end', { ascending: false })
      .limit(4),
    supabase
      .from('regulatory_mentions')
      .select('mention_type, mention_date, source_entity')
      .eq('brand_id', bid)
      .gte('mention_date', ninetyDaysAgo.toISOString().split('T')[0])
      .order('mention_date', { ascending: false })
      .limit(20),
    supabase
      .from('notifications')
      .select('id')
      .eq('brand_id', bid)
      .eq('alert_subtype', 'volume_surge')
      .gte('created_at', thirtyDaysAgo.toISOString()),
    supabase
      .from('brand_launch_markers')
      .select('marker_date, label, marker_type')
      .eq('brand_id', bid)
      .order('marker_date', { ascending: false })
      .limit(20),
    supabase
      .from('review_aspect_sentiment')
      .select('aspect, sentiment, score, mention_count, platform, period_end')
      .eq('brand_id', bid)
      .order('period_end', { ascending: false })
      .limit(30),
    supabase
      .from('developer_health_snapshots')
      .select('platform, stars, forks, open_issues, downloads_weekly, question_count, period_end')
      .eq('brand_id', bid)
      .order('period_end', { ascending: false })
      .limit(10),
  ])

  // ── BHI components ────────────────────────────────────────────────────────
  // Loaded through the shared pipeline so this page, the Overview, Ask AI and
  // the nightly snapshot all produce the same score from the same inputs.
  const { components, breakdowns, brandType, extras } = await loadBHIInputs(supabase, bid, days)
  const bhi = computeFullBHI(components, breakdowns, brandType)

  const { emvRaw, perceptionResponses } = extras

  // ── Trust score (fintech brand types only)
  const latestAppStore = (appStoreSnaps ?? []).find(s => s.platform === 'app_store')
  const latestPlayStore = (appStoreSnaps ?? []).find(s => s.platform === 'play_store')
  const bestAppRating   = latestAppStore?.rating ?? latestPlayStore?.rating ?? null

  let regulatoryStatus: 'clean' | 'under_review' | 'sanctioned' | null = null
  if ((regMentions ?? []).length > 0) {
    const hasSanction    = (regMentions ?? []).some(m => m.mention_type === 'sanction')
    const hasInvestigation = (regMentions ?? []).some(m => m.mention_type === 'investigation')
    regulatoryStatus = hasSanction ? 'sanctioned' : hasInvestigation ? 'under_review' : 'clean'
  }

  const sentRows14d      = (sentDays ?? []).filter(d => d.day >= fourteenDaysAgo.toISOString().split('T')[0])
  const avgPosPct        = sentRows14d.length > 0
    ? sentRows14d.reduce((s, d) => s + (d.social_score ?? 0), 0) / sentRows14d.length
    : null
  const negSentimentTrend = avgPosPct != null ? Math.max(0, 100 - avgPosPct) : null

  const trustScore = computeTrustScore({
    appStoreRating:     bestAppRating != null ? +bestAppRating : null,
    regulatoryStatus,
    complaintSurges30d: (volumeSurgeAlerts ?? []).length,
    negSentimentTrend,
  })

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

  // ── Aspect sentiment — deduplicate to latest per aspect+platform ─────────────
  type AspectRow = {
    aspect: string; sentiment: 'positive' | 'neutral' | 'negative'
    score: number; mention_count: number; platform: string; period_end: string | null
  }
  const aspectMap = new Map<string, AspectRow>()
  for (const row of (aspectRows ?? []) as AspectRow[]) {
    const key = `${row.aspect}:${row.platform}`
    const existing = aspectMap.get(key)
    if (!existing ||
        (row.period_end ?? '') > (existing.period_end ?? '') ||
        ((row.period_end ?? '') === (existing.period_end ?? '') && row.mention_count > existing.mention_count)
    ) { aspectMap.set(key, row) }
  }
  const aspectScores = Array.from(aspectMap.values())

  // ── Developer health — latest + previous per platform ─────────────────────
  type DevSnap = {
    platform: string; stars: number | null; forks: number | null
    open_issues: number | null; downloads_weekly: number | null
    question_count: number | null; period_end: string | null
  }
  const devRows      = (devHealthSnaps ?? []) as DevSnap[]
  const githubSnaps  = devRows.filter(r => r.platform === 'github')
  const npmSnaps     = devRows.filter(r => r.platform === 'npm')
  const soSnaps      = devRows.filter(r => r.platform === 'stackoverflow')
  const githubSnap   = githubSnaps[0] ?? null
  const githubPrev   = githubSnaps[1] ?? null
  const npmSnap      = npmSnaps[0] ?? null
  const npmPrev      = npmSnaps[1] ?? null
  const soSnap       = soSnaps[0] ?? null
  const hasDevData   = githubSnap != null || npmSnap != null || soSnap != null
  const isDevBrand   = ['fintech', 'b2b_saas', 'marketplace'].includes(brandType)

  // ── BHI history sparkline — uses brand_health_snapshots.bhi (real BHI, not sentiment)
  const sparkline = (bhiHistory ?? [])
    .filter(d => d.bhi != null)
    .reverse()
    .map(d => ({ date: d.snapshot_date, score: d.bhi }))

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        {...PAGE_META['/dashboard/brand-equity']}
        title="Brand Equity Tracker"
        subtitle={<>Full 7-component Brand Health Index, ESOV engine, and perception analysis for{' '} {brand?.name ?? 'your brand'}.</>}
        actions={<><div className="flex items-center gap-2 shrink-0">
          <TourTrigger module="brand_health" autoStart />
          <DateRangeFilter currentDays={days} defaultDays={30} />
        </div></>}
      />

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
        brandType={brandType}
        markers={launchMarkers ?? []}
      />

      <LaunchMarkersPanel />

      {(brandType === 'venue' || brand?.google_place_id) && (
        <VenueReputationPanel
          snapshot={venueSnapshot ?? null}
          hasPlaceId={Boolean(brand?.google_place_id)}
        />
      )}

      {brandType === 'fintech' && (
        <TrustPillarCard trust={trustScore} />
      )}

      {(['venue', 'fintech', 'b2b_saas'] as const).includes(brandType as 'venue') && aspectScores.length > 0 && (
        <AspectSentimentPanel
          aspects={aspectScores}
          platform={brandType === 'venue' ? 'google_maps' : 'app_store'}
          brandType={brandType}
        />
      )}

      {isDevBrand && hasDevData && (
        <DeveloperHealthPanel
          github={githubSnap}
          githubPrev={githubPrev}
          npm={npmSnap}
          npmPrev={npmPrev}
          stackoverflow={soSnap}
        />
      )}

      {isDemoUser && (
        <SeedDemoPanel />
      )}
    </div>
  )
}
