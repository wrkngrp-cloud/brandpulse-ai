import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { callAi } from '@/lib/ai/client'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const range = (request.nextUrl.searchParams.get('range') ?? '30d') as '7d' | '30d' | '90d' | '6m'

  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const supabase = await createServiceClient()

  const { data: portalToken } = await supabase
    .from('portal_tokens')
    .select('id, brand_id, workspace_id, sections, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (!portalToken) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  if (portalToken.expires_at && new Date(portalToken.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This portal link has expired' }, { status: 410 })
  }

  await supabase.from('portal_tokens').update({ last_accessed: new Date().toISOString() }).eq('id', portalToken.id)

  const brandId = portalToken.brand_id
  const sections = portalToken.sections as string[]

  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 180
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const [
    brandRes,
    bhiRes,
    sentimentRes,
    sovRes,
    sovTrendRes,
    campaignsRes,
    npsRes,
    mentionsRes,
    competitorsRes,
    sovCompetitorsRes,
  ] = await Promise.all([
    supabase.from('brands')
      .select('name, category, logo_url, market_share_pct, brand_voice')
      .eq('id', brandId).single(),

    sections.includes('bhi')
      ? supabase.from('brand_health_snapshots')
          .select('bhi, snapshot_date')
          .eq('brand_id', brandId)
          .gte('snapshot_date', since)
          .order('snapshot_date', { ascending: true })
      : { data: null },

    sections.includes('sentiment')
      ? supabase.from('sentiment_daily')
          .select('social_score, day, positive_pct, negative_pct, platform_breakdown')
          .eq('brand_id', brandId)
          .gte('day', since)
          .order('day', { ascending: true })
      : { data: null },

    supabase.from('sov_snapshots')
      .select('social_sov, snapshot_date')
      .eq('brand_id', brandId)
      .order('snapshot_date', { ascending: false })
      .limit(1).maybeSingle(),

    sections.includes('sov')
      ? supabase.from('sov_snapshots')
          .select('social_sov, snapshot_date')
          .eq('brand_id', brandId)
          .gte('snapshot_date', since)
          .order('snapshot_date', { ascending: true })
      : { data: null },

    sections.includes('campaigns')
      ? supabase.from('campaigns')
          .select('id, name, channel, status, budget, spend, start_date, end_date')
          .eq('brand_id', brandId)
          .gte('start_date', since)
          .order('start_date', { ascending: false })
          .limit(10)
      : { data: null },

    sections.includes('nps')
      ? supabase.from('survey_responses')
          .select('nps_score, created_at')
          .eq('brand_id', brandId)
          .not('nps_score', 'is', null)
          .gte('created_at', since)
          .order('created_at', { ascending: true })
      : { data: null },

    supabase.from('mentions')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brandId)
      .gte('created_at', since),

    supabase.from('competitors')
      .select('name, type')
      .eq('brand_id', brandId)
      .limit(5),

    sections.includes('sov')
      ? supabase.from('sov_snapshots')
          .select('competitor_data, snapshot_date')
          .eq('brand_id', brandId)
          .order('snapshot_date', { ascending: false })
          .limit(1).maybeSingle()
      : { data: null },
  ])

  const brand = brandRes.data
  const bhiHistory = bhiRes.data ?? []
  const sentimentData = sentimentRes.data ?? []
  const latestSov = sovRes.data
  const sovTrend = sovTrendRes.data ?? []
  const campaigns = campaignsRes.data ?? []
  const npsResponses = npsRes.data ?? []
  const mentionCount = mentionsRes.count ?? 0
  const competitors = competitorsRes.data ?? []
  const sovCompetitor = sovCompetitorsRes.data

  // Compute derived metrics
  const latestBhi = bhiHistory.length > 0 ? bhiHistory[bhiHistory.length - 1].bhi : null
  const firstBhi  = bhiHistory.length > 1 ? bhiHistory[0].bhi : null
  const bhiDelta  = latestBhi != null && firstBhi != null ? Number(latestBhi) - Number(firstBhi) : null

  const avgSentiment = sentimentData.length > 0
    ? sentimentData.reduce((s, r) => s + r.social_score, 0) / sentimentData.length
    : null
  const latestSentiment = sentimentData.length > 0 ? sentimentData[sentimentData.length - 1].social_score : null
  const firstSentiment  = sentimentData.length > 1 ? sentimentData[0].social_score : null
  const sentimentDelta  = latestSentiment != null && firstSentiment != null ? latestSentiment - firstSentiment : null

  const avgNps = npsResponses.length > 0
    ? npsResponses.reduce((s, r) => s + (r.nps_score ?? 0), 0) / npsResponses.length
    : null

  const totalBudget  = campaigns.reduce((s, c) => s + (c.budget ?? 0), 0)
  const totalSpend   = campaigns.reduce((s, c) => s + (c.spend ?? 0), 0)
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length

  // AI executive summary (structural tier, board-grade framing)
  let executiveSummary: string | null = null
  if (sections.includes('executive_summary') && brand) {
    try {
      const prompt = `You are a Fractional CMO preparing a concise executive summary for a board presentation.

Brand: ${brand.name} (${brand.category ?? 'Consumer brand'})
Period: Last ${days} days

Key metrics:
- Brand Health Index: ${latestBhi != null ? `${Number(latestBhi).toFixed(1)}/100` : 'N/A'} (change: ${bhiDelta != null ? (bhiDelta > 0 ? '+' : '') + bhiDelta.toFixed(1) : 'N/A'})
- Sentiment score: ${latestSentiment != null ? latestSentiment.toFixed(1) : 'N/A'} (change: ${sentimentDelta != null ? (sentimentDelta > 0 ? '+' : '') + sentimentDelta.toFixed(1) : 'N/A'})
- Share of Voice: ${latestSov?.social_sov ?? 'N/A'}%
- Total mentions: ${mentionCount}
- Active campaigns: ${activeCampaigns} / ${campaigns.length} total
- Total media spend tracked: ₦${(totalSpend / 100).toLocaleString()}
- NPS score: ${avgNps != null ? avgNps.toFixed(1) : 'N/A'} (${npsResponses.length} responses)
- Market share: ${brand.market_share_pct ?? 'N/A'}%

Write a 3-sentence executive summary in plain English. State what the numbers mean for the brand's market position, what is working, and one key watch item. Do not use bullet points. No em dashes. Be direct and confident.`

      const aiRes = await callAi({
        tier: 'structural',
        system: 'You produce concise, board-grade marketing intelligence summaries for senior executives. Warm, confident, plain English.',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 200,
      })
      executiveSummary = aiRes.trim()
    } catch {
      // Non-fatal — portal still renders without summary
    }
  }

  // Key wins and concerns (AI)
  let winsAndConcerns: { wins: string[]; concerns: string[]; priorities: string[] } | null = null
  if (sections.includes('insights') && brand) {
    try {
      const prompt = `You are a Fractional CMO.

Brand: ${brand.name}, ${days}-day review.
BHI: ${latestBhi != null ? Number(latestBhi).toFixed(1) : 'N/A'} (delta: ${bhiDelta != null ? (bhiDelta > 0 ? '+' : '') + bhiDelta.toFixed(1) : 'N/A'})
Sentiment: ${latestSentiment != null ? latestSentiment.toFixed(1) : 'N/A'} (delta: ${sentimentDelta != null ? (sentimentDelta > 0 ? '+' : '') + sentimentDelta.toFixed(1) : 'N/A'})
SOV: ${latestSov?.social_sov ?? 'N/A'}%
NPS: ${avgNps != null ? avgNps.toFixed(1) : 'N/A'}
Active campaigns: ${activeCampaigns}
Spend: ₦${(totalSpend / 100).toLocaleString()}
Mentions: ${mentionCount}

Respond with ONLY valid JSON (no markdown, no code fences):
{"wins":["win 1","win 2","win 3"],"concerns":["concern 1","concern 2","concern 3"],"priorities":["priority 1","priority 2","priority 3"]}

Keep each item under 12 words. Be specific and actionable.`

      const aiRes = await callAi({
        tier: 'structural',
        system: 'You produce concise board-ready marketing intelligence. Respond only with the JSON requested.',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 300,
      })
      winsAndConcerns = JSON.parse(aiRes.trim())
    } catch {
      // Non-fatal
    }
  }

  return NextResponse.json({
    brand,
    sections,
    range,
    days,
    bhiHistory,
    bhiDelta,
    sentimentData,
    sentimentDelta,
    latestSentiment,
    avgSentiment,
    latestSov,
    sovTrend,
    campaigns,
    totalBudget,
    totalSpend,
    activeCampaigns,
    npsResponses,
    avgNps,
    mentionCount,
    competitors,
    sovCompetitor,
    executiveSummary,
    winsAndConcerns,
    asOf: new Date().toISOString(),
  })
}
