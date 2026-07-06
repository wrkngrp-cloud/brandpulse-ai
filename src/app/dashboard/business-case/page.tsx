import { Suspense }     from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { getActiveBrand } from '@/lib/active-brand'
import { computeLiveBHI } from '@/lib/live-bhi'
import { computeCommercialMetrics, visibleCommercialMetrics } from '@/lib/commercial-metrics'
import { resolveBrandType } from '@/lib/bhi'
import { Skeleton }     from '@/components/ui/skeleton'
import { BusinessCaseClient } from './business-case-client'
import { AiExecutiveBrief } from './ai-executive-brief'

export const dynamic = 'force-dynamic'

export default async function BusinessCasePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const brand = await getActiveBrand<{ id: string; name: string; category: string | null; market_share_pct: number | null; brand_voice: Record<string, unknown>; brand_type: string | null; industry: string | null }>(
    supabase, 'id, name, category, market_share_pct, brand_voice, brand_type, industry'
  )
  if (!brand) redirect('/onboarding')

  const brandType = resolveBrandType(brand.brand_type, brand.industry)

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [
    liveBhi,
    commercial,
    { data: bhiTrend },
    { data: latestSov },
    { data: campaigns },
    { count: mentions30d },
    { data: npsData },
    { data: sentimentTrend },
    { data: competitors },
  ] = await Promise.all([
    computeLiveBHI(supabase, brand.id),
    computeCommercialMetrics(supabase, brand.id),

    supabase.from('brand_health_snapshots')
      .select('bhi, snapshot_date')
      .eq('brand_id', brand.id)
      .gte('snapshot_date', ninetyDaysAgo)
      .order('snapshot_date', { ascending: true }),

    supabase.from('sov_snapshots')
      .select('social_sov, snapshot_date')
      .eq('brand_id', brand.id)
      .order('snapshot_date', { ascending: false })
      .limit(1).maybeSingle(),

    supabase.from('campaigns')
      .select('id, name, status, total_budget, start_date, end_date, campaign_channels(channel, budget_allocation)')
      .eq('brand_id', brand.id)
      .gte('start_date', ninetyDaysAgo)
      .order('start_date', { ascending: false }),

    supabase.from('mentions')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brand.id)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),

    supabase.from('nps_records')
      .select('score')
      .eq('brand_id', brand.id)
      .not('score', 'is', null)
      .gte('created_at', ninetyDaysAgo),

    supabase.from('sentiment_daily')
      .select('social_score, day')
      .eq('brand_id', brand.id)
      .gte('day', thirtyDaysAgo)
      .order('day', { ascending: true }),

    supabase.from('competitors')
      .select('name')
      .eq('brand_id', brand.id)
      .limit(5),
  ])

  // Derived metrics
  const currentBhi       = liveBhi.score
  const firstBhi         = bhiTrend && bhiTrend.length > 1 ? Number(bhiTrend[0].bhi) : null
  const bhiChange        = currentBhi != null && firstBhi != null ? currentBhi - firstBhi : null

  const sov              = latestSov?.social_sov != null ? Number(latestSov.social_sov) : null
  const marketShare      = brand.market_share_pct ? Number(brand.market_share_pct) : null
  const esov             = sov != null && marketShare != null ? sov - marketShare : null

  const totalBudget      = (campaigns ?? []).reduce((s, c) => s + (c.total_budget ?? 0), 0)
  const totalSpend       = totalBudget
  const activeCampaigns  = (campaigns ?? []).filter(c => c.status === 'active').length

  const npsScores        = (npsData ?? []).map(r => r.score ?? 0)
  const avgNps           = npsScores.length > 0
    ? npsScores.reduce((a, b) => a + b, 0) / npsScores.length
    : null

  const avgSentiment     = sentimentTrend && sentimentTrend.length > 0
    ? sentimentTrend.reduce((s, r) => s + r.social_score, 0) / sentimentTrend.length
    : null

  const spendEfficiency  = totalSpend > 0 && currentBhi != null ? currentBhi / (totalSpend / 1_000_000) : null

  // Channel spend breakdown — use budget_allocation from campaign_channels as proxy
  const channelSpend: Record<string, number> = {}
  for (const c of campaigns ?? []) {
    const channels = (c as { campaign_channels?: { channel: string; budget_allocation: number | null }[] }).campaign_channels ?? []
    for (const ch of channels) {
      if (ch.channel && ch.budget_allocation) {
        channelSpend[ch.channel] = (channelSpend[ch.channel] ?? 0) + ch.budget_allocation
      }
    }
  }

  // Only cite commercial metrics that are structurally relevant to this
  // brand type and that actually have a value this period.
  const commercialIds = visibleCommercialMetrics(brandType)
  const commercialLines: string[] = []
  if (commercialIds.includes('revenue')   && commercial.revenue.value   != null) commercialLines.push(`- Revenue (this month): ₦${commercial.revenue.value.toLocaleString()}`)
  if (commercialIds.includes('spend')     && commercial.spend.value     != null) commercialLines.push(`- Marketing spend (this month): ₦${commercial.spend.value.toLocaleString()}`)
  if (commercialIds.includes('roiPct')    && commercial.roiPct.value    != null) commercialLines.push(`- Marketing ROI: ${commercial.roiPct.value >= 0 ? '+' : ''}${commercial.roiPct.value.toFixed(0)}%`)
  if (commercialIds.includes('roas')      && commercial.roas.value      != null) commercialLines.push(`- ROAS: ${commercial.roas.value.toFixed(1)}x`)
  if (commercialIds.includes('cac')       && commercial.cac.value       != null) commercialLines.push(`- CAC (cost to acquire a customer): ₦${commercial.cac.value.toLocaleString()}`)
  if (commercialIds.includes('cpl')       && commercial.cpl.value       != null) commercialLines.push(`- CPL (cost per marketing-qualified lead): ₦${commercial.cpl.value.toLocaleString()}`)
  if (commercialIds.includes('mql')       && commercial.mql.value       != null) commercialLines.push(`- MQLs generated (this month): ${commercial.mql.value.toLocaleString()}`)
  if (commercialIds.includes('churnRate') && commercial.churnRate.value != null) commercialLines.push(`- Churn rate: ${(commercial.churnRate.value * 100).toFixed(1)}%`)
  if (commercialIds.includes('ltvToCac')  && commercial.ltvToCac.value  != null) commercialLines.push(`- LTV to CAC ratio: ${commercial.ltvToCac.value.toFixed(1)}x`)

  return (
    <BusinessCaseClient
      brand={{ name: brand.name, category: brand.category }}
      currentBhi={currentBhi}
      bhiChange={bhiChange}
      bhiTrend={(bhiTrend ?? []).map(r => ({ date: r.snapshot_date, bhi: Number(r.bhi) }))}
      sov={sov}
      marketShare={marketShare}
      esov={esov}
      totalSpend={totalSpend}
      totalBudget={totalBudget}
      activeCampaigns={activeCampaigns}
      campaigns={campaigns ?? []}
      channelSpend={channelSpend}
      avgNps={avgNps}
      npsCount={npsScores.length}
      avgSentiment={avgSentiment}
      mentions30d={mentions30d ?? 0}
      spendEfficiency={spendEfficiency}
      competitors={(competitors ?? []).map(c => c.name)}
      commercial={commercial}
      brandType={brandType}
    >
      <Suspense fallback={<Skeleton className="h-52 rounded-2xl" />}>
        <AiExecutiveBrief
          brandName={brand.name}
          brandCategory={brand.category}
          currentBhi={currentBhi}
          bhiChange={bhiChange}
          sov={sov}
          marketShare={marketShare}
          esov={esov}
          avgSentiment={avgSentiment}
          avgNps={avgNps}
          npsCount={npsScores.length}
          mentions30d={mentions30d ?? 0}
          totalSpend={totalSpend}
          totalBudget={totalBudget}
          activeCampaigns={activeCampaigns}
          competitors={(competitors ?? []).map(c => c.name)}
          commercialLines={commercialLines}
        />
      </Suspense>
    </BusinessCaseClient>
  )
}
