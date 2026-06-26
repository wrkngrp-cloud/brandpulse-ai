import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { getActiveBrand } from '@/lib/active-brand'
import { callAi }       from '@/lib/ai/client'
import { BusinessCaseClient } from './business-case-client'

export const dynamic = 'force-dynamic'

export default async function BusinessCasePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const brand = await getActiveBrand<{ id: string; name: string; category: string | null; market_share_pct: number | null; brand_voice: Record<string, unknown> }>(
    supabase, 'id, name, category, market_share_pct, brand_voice'
  )
  if (!brand) redirect('/onboarding')

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [
    { data: latestBhi },
    { data: bhiTrend },
    { data: latestSov },
    { data: campaigns },
    { count: mentions30d },
    { data: npsData },
    { data: sentimentTrend },
    { data: competitors },
  ] = await Promise.all([
    supabase.from('brand_health_snapshots')
      .select('bhi, snapshot_date')
      .eq('brand_id', brand.id)
      .order('snapshot_date', { ascending: false })
      .limit(1).maybeSingle(),

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
  const currentBhi       = latestBhi?.bhi != null ? Number(latestBhi.bhi) : null
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

  const spendEfficiency  = totalSpend > 0 && currentBhi != null ? currentBhi / (totalSpend / 100_000_000) : null

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

  // AI-generated business case
  let aiBusinessCase: {
    headline:    string
    case:        string
    roi_argument: string
    risks:       string[]
    asks:        { amount: string; channel: string; rationale: string }[]
    proof_points: string[]
  } | null = null

  try {
    const bhiTrendStr = bhiChange != null
      ? `${bhiChange > 0 ? '+' : ''}${bhiChange.toFixed(1)} pts over 90 days`
      : 'trend data unavailable'

    const prompt = `You are a seasoned Chief Marketing Officer preparing a business case to justify and expand the marketing budget.

Brand: ${brand.name} (${brand.category ?? 'Consumer brand'}, Nigeria)
Period: Last 90 days

PERFORMANCE DATA:
- Brand Health Index: ${currentBhi != null ? `${currentBhi.toFixed(1)}/100` : 'N/A'} (${bhiTrendStr})
- Share of Voice: ${sov != null ? `${sov.toFixed(1)}%` : 'N/A'}
- Market Share: ${marketShare != null ? `${marketShare}%` : 'N/A'}
- ESOV (SOV minus market share): ${esov != null ? (esov > 0 ? '+' : '') + esov.toFixed(1) + '%' : 'N/A'}
- Avg Sentiment: ${avgSentiment != null ? avgSentiment.toFixed(1) : 'N/A'}/100
- NPS: ${avgNps != null ? avgNps.toFixed(1) : 'N/A'} (${npsScores.length} responses)
- Brand mentions (30d): ${mentions30d ?? 0}
- Total media spend (90d): ₦${(totalSpend / 100).toLocaleString()}
- Total budget (90d): ₦${(totalBudget / 100).toLocaleString()}
- Active campaigns: ${activeCampaigns}
- Tracked competitors: ${(competitors ?? []).map(c => c.name).join(', ') || 'none yet'}

Use the Les Binet & Peter Field ESOV model (positive ESOV predicts market share growth), Aaker's brand equity framework, and hard numbers from the data above.

Respond ONLY with valid JSON (no markdown, no code fences):
{
  "headline": "one-sentence business case headline (under 15 words)",
  "case": "2-3 sentence executive summary making the investment case. Plain English, no jargon.",
  "roi_argument": "1-2 sentences on why this spend generates return, using the data above. Cite specific numbers.",
  "risks": ["risk 1 if budget NOT approved", "risk 2", "risk 3"],
  "asks": [
    {"amount": "₦X", "channel": "channel name", "rationale": "one sentence why this channel"},
    {"amount": "₦X", "channel": "channel name", "rationale": "..."},
    {"amount": "₦X", "channel": "channel name", "rationale": "..."}
  ],
  "proof_points": ["data point 1", "data point 2", "data point 3"]
}

Budget ask amounts should be directional, based on the existing spend pattern. Keep all items under 20 words each.`

    const raw = await callAi({
      tier:      'boardGrade',
      system:    'You produce board-grade marketing investment cases backed by real data. JSON only, no commentary.',
      messages:  [{ role: 'user', content: prompt }],
      maxTokens: 600,
    })
    aiBusinessCase = JSON.parse(raw.trim())
  } catch {
    // Non-fatal — page still renders with data
  }

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
      aiBusinessCase={aiBusinessCase}
    />
  )
}
