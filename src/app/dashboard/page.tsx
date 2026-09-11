import { createClient } from '@/lib/supabase/server'
import { Skeleton } from '@/components/ui/skeleton'
import { Suspense } from 'react'
import { computeFullBHI, resolveBrandType, type BHIResult } from '@/lib/bhi'
import { loadBHIInputs } from '@/lib/bhi-inputs'
import { OverviewClient } from '@/components/dashboard/overview-client'
import { getActiveBrandId } from '@/lib/active-brand'
import { getIndustryFromCategory, SUGGESTED_CONNECTORS_BY_INDUSTRY, type IndustryId } from '@/lib/industry-config'
import { DEFAULT_WIDGET_IDS, TEMPLATE_BY_INDUSTRY } from '@/lib/widget-catalog'
import { getTourStatuses } from '@/app/dashboard/tours/actions'
import type { ConnectChecklistItem } from '@/components/dashboard/connect-checklist'

async function DashboardContent({ days }: { days: number }) {
  const supabase = await createClient()

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const brandId = await getActiveBrandId(supabase)

  const [
    { data: brand },
    { data: dashPrefs },
    { data: sentimentRow },
    { data: sovRow },
    { data: bhiHistory },
    { data: recentMentions },
    { count: mentionCount7d },
    { data: activeCampaigns },
    { data: upcomingEvents },
    { data: sentimentTrendRaw },
    { data: socialConnections },
    { count: surveyCount },
    { data: ga4Connection },
    { data: metaAdsAccount },
    { data: webhookConfigs },
  ] = await Promise.all([
    brandId
      ? supabase.from('brands').select('id, name, category, industry, brand_type').eq('id', brandId).single()
      : supabase.from('brands').select('id, name, category, industry, brand_type').limit(1).single(),
    supabase.from('user_dashboard_prefs')
      .select('template, widget_ids')
      .eq('brand_id', brandId ?? '')
      .maybeSingle(),
    supabase.from('sentiment_daily').select('social_score, day, positive_pct, negative_pct').eq('brand_id', brandId ?? '').order('day', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('sov_snapshots').select('social_sov, snapshot_date').eq('brand_id', brandId ?? '').order('snapshot_date', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('brand_health_snapshots').select('bhi, snapshot_date').eq('brand_id', brandId ?? '').order('snapshot_date', { ascending: false }).limit(days),
    supabase.from('mentions').select('id, content, author_handle, platform, sentiment_label, created_at').eq('brand_id', brandId ?? '').order('created_at', { ascending: false }).limit(4),
    supabase.from('mentions').select('id', { count: 'exact', head: true }).eq('brand_id', brandId ?? '').gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from('campaigns').select('id, name, status, objectives, start_date, total_budget, currency').eq('brand_id', brandId ?? '').in('status', ['active', 'paused']).order('created_at', { ascending: false }).limit(3),
    supabase.from('events').select('id, name, status, city, day, activation_type').eq('brand_id', brandId ?? '').in('status', ['planned', 'live']).order('day', { ascending: true }).limit(3),
    supabase.from('sentiment_daily').select('social_score, day').eq('brand_id', brandId ?? '').gte('day', cutoffStr).order('day', { ascending: true }),
    supabase.from('social_connections').select('id').eq('brand_id', brandId ?? '').limit(1),
    supabase.from('surveys').select('id', { count: 'exact', head: true }).eq('brand_id', brandId ?? ''),
    supabase.from('ga4_connections').select('id').eq('brand_id', brandId ?? '').maybeSingle(),
    supabase.from('digital_ad_accounts').select('id').eq('brand_id', brandId ?? '').eq('platform', 'meta').maybeSingle(),
    supabase.from('webhook_configs').select('provider').eq('brand_id', brandId ?? '').limit(1),
  ])

  // ── Sentiment score ──────────────────────────────────────────────────────
  const sentimentScore = sentimentRow?.social_score ?? null
  const sovScore       = sovRow?.social_sov ?? null

  // ── BHI ───────────────────────────────────────────────────────────────────
  // Seven components, loaded through the shared pipeline so this page, Brand
  // Equity, Ask AI and the nightly snapshot all score the same brand the same
  // way. This block used to assemble its own inputs and passed SOV alone as
  // awareness with cultural resonance hardcoded to null, which is why the
  // Overview and Brand Equity showed different numbers for the same brand.
  const { components: bhiComponents, breakdowns: bhiBreakdowns, brandType } =
    brandId ? await loadBHIInputs(supabase, brandId, days) : {
      components: {
        awareness: null, salience: null, sentiment: null, perception: null,
        culturalResonance: null, blendedSov: null, emv: null,
      },
      breakdowns: undefined,
      brandType: resolveBrandType(brand?.brand_type, brand?.industry),
    }
  const fullBhi = computeFullBHI(bhiComponents, bhiBreakdowns, brandType)

  // Map to BHIResult shape for gauge (show 3 most readable components)
  const bhi: BHIResult = {
    score:    fullBhi.score,
    coverage: fullBhi.coverage,
    zone:     fullBhi.zone,
    components: {
      sentiment: fullBhi.components.sentiment,
      sov:       fullBhi.components.awareness,
      survey:    fullBhi.components.perception ?? fullBhi.components.salience,
    },
  }

  const sparkline = [...(bhiHistory ?? [])]
    .reverse()
    .map(r => ({ date: r.snapshot_date, score: Number(r.bhi) }))

  const bhiByDate = new Map(sparkline.map(r => [r.date, r.score]))
  const sentimentByDate = new Map((sentimentTrendRaw ?? []).map(r => [r.day, r.social_score]))
  const allDates = [...new Set([...bhiByDate.keys(), ...sentimentByDate.keys()])].sort()
  const trendData = allDates.map(date => ({
    date,
    bhi:       bhiByDate.get(date) ?? null,
    sentiment: sentimentByDate.get(date) ?? null,
  }))

  const hasAnyData = sentimentScore !== null || sovScore !== null

  const industry = (brand as { industry?: string | null } | null)?.industry
    || getIndustryFromCategory(brand?.category ?? '')

  const widgetIds       = (dashPrefs?.widget_ids as string[] | null) ?? DEFAULT_WIDGET_IDS
  const isFirstVisit    = !dashPrefs
  const industryTemplate = TEMPLATE_BY_INDUSTRY[industry] ?? null

  // ── First-run connect checklist ───────────────────────────────────────────
  // Recommendations branch on the brand's industry (never assume FMCG).
  const suggestedConnectors = SUGGESTED_CONNECTORS_BY_INDUSTRY[industry as IndustryId] ?? []
  const checklistItems: ConnectChecklistItem[] = [
    {
      id:          'social',
      label:       'Connect X or Instagram',
      description: 'We read your mentions nightly and turn them into sentiment and share of voice.',
      href:        '/dashboard/connectors',
      done:        (socialConnections ?? []).length > 0,
    },
    {
      id:          'ga4',
      label:       'Connect Google Analytics',
      description: 'Website traffic feeds your funnel and campaign reporting.',
      href:        '/dashboard/connectors',
      done:        !!ga4Connection,
    },
    {
      id:          'meta_ads',
      label:       'Connect Meta Ads',
      description: 'Ad spend and results flow into your ROI and budget views.',
      href:        '/dashboard/connectors',
      done:        !!metaAdsAccount,
    },
    ...(suggestedConnectors.includes('paystack') || suggestedConnectors.includes('flutterwave')
      ? [{
          id:          'payments',
          label:       'Add your payment webhook',
          description: 'Paystack or Flutterwave purchases link marketing to real revenue.',
          href:        '/dashboard/connectors',
          done:        (webhookConfigs ?? []).length > 0,
        }]
      : []),
    {
      id:          'survey',
      label:       'Launch your first survey',
      description: 'Survey answers power your NPS, awareness and perception scores.',
      href:        '/dashboard/surveys',
      done:        (surveyCount ?? 0) > 0,
    },
  ]
  // Demo accounts get an empty status map back, so dismissal falls to the
  // browser's localStorage inside the component (same pattern as tours).
  const { statuses: checklistStatuses } = await getTourStatuses(['connect_checklist'])
  const checklistDismissed = !!checklistStatuses['connect_checklist']

  return (
    <OverviewClient
      brandName={brand?.name ?? 'Your brand'}
      category={brand?.category ?? null}
      industry={industry}
      bhi={bhi}
      sparkline={sparkline}
      sentiment={sentimentRow ?? null}
      sovScore={sovScore}
      sovDate={sovRow?.snapshot_date ?? null}
      activeCampaigns={(activeCampaigns ?? []).map(c => ({
        ...c,
        objectives: c.objectives as string[] | null,
      }))}
      upcomingEvents={upcomingEvents ?? []}
      recentMentions={recentMentions ?? []}
      mentionCount7d={mentionCount7d ?? 0}
      hasAnyData={hasAnyData}
      trendData={trendData}
      days={days}
      widgetIds={widgetIds}
      isFirstVisit={isFirstVisit}
      industryTemplate={industryTemplate}
      checklistItems={checklistItems}
      checklistDismissed={checklistDismissed}
    />
  )
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const days = Math.min(365, Math.max(7, Number(params.days ?? 30)))

  return (
    <Suspense fallback={
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-8 w-40 hidden sm:block" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-72 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map(i => <Skeleton key={i} className="h-52 rounded-2xl" />)}
        </div>
      </div>
    }>
      <DashboardContent days={days} />
    </Suspense>
  )
}
