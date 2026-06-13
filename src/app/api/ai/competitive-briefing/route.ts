import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { callAi } from '@/lib/ai/client'
import { buildBrandContext, formatBrandContextBlock } from '@/lib/ai/brand-context'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: brand } = await supabase.from('brands').select('id').limit(1).single()
  if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 })

  const service = await createServiceClient()

  const [
    { data: sovSnap },
    { data: competitors },
    { data: sentimentRows },
    { data: mentions },
    brandCtx,
  ] = await Promise.all([
    service
      .from('sov_snapshots')
      .select('snapshot_date, social_sov, blended_sov, competitor_data')
      .eq('brand_id', brand.id)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    service
      .from('competitors')
      .select('id, name, website')
      .eq('brand_id', brand.id),
    service
      .from('sentiment_daily')
      .select('day, social_score, positive_pct, neutral_pct, negative_pct, emotion_distribution')
      .eq('brand_id', brand.id)
      .order('day', { ascending: false })
      .limit(7),
    service
      .from('mentions')
      .select('content, author_handle, platform, sentiment_label, created_at')
      .eq('brand_id', brand.id)
      .not('sentiment_label', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20),
    buildBrandContext(brand.id),
  ])

  // Build competitor SOV block
  const competitorData = sovSnap?.competitor_data as {
    brand_volume?: number
    competitor_volumes?: Record<string, number>
  } | null

  const brandVolume = competitorData?.brand_volume ?? 0
  const competitorVolumes = competitorData?.competitor_volumes ?? {}
  const totalVolume = brandVolume + Object.values(competitorVolumes).reduce((a, b) => a + b, 0)

  const sovLines = totalVolume > 0
    ? [
        `${brandCtx.brandName}: ${brandVolume} mentions (${Math.round((brandVolume / totalVolume) * 100)}% SOV)`,
        ...Object.entries(competitorVolumes)
          .sort((a, b) => b[1] - a[1])
          .map(([name, vol]) => `${name}: ${vol} mentions (${Math.round((vol / totalVolume) * 100)}% SOV)`),
      ].join('\n')
    : 'No SOV data yet'

  // Latest sentiment
  const latest = sentimentRows?.[0]
  const sentimentBlock = latest
    ? `Score: ${Math.round(latest.social_score)}/100\nPositive: ${Math.round(latest.positive_pct)}% | Neutral: ${Math.round(latest.neutral_pct)}% | Negative: ${Math.round(latest.negative_pct)}%`
    : 'No sentiment data yet'

  // Trend
  const trendLine = sentimentRows && sentimentRows.length > 1
    ? [...sentimentRows].reverse().map(d => `${d.day}: ${Math.round(d.social_score)}`).join(', ')
    : null

  // Sample mentions (negative + positive)
  const negativeMentions = (mentions ?? []).filter(m => m.sentiment_label === 'negative').slice(0, 5)
  const positiveMentions = (mentions ?? []).filter(m => m.sentiment_label === 'positive').slice(0, 5)

  const mentionsBlock = [
    positiveMentions.length ? `Positive signals:\n${positiveMentions.map(m => `  • "${m.content?.slice(0, 100)}"${m.author_handle ? ` — @${m.author_handle}` : ''}`).join('\n')}` : null,
    negativeMentions.length ? `Negative signals:\n${negativeMentions.map(m => `  • "${m.content?.slice(0, 100)}"${m.author_handle ? ` — @${m.author_handle}` : ''}`).join('\n')}` : null,
  ].filter(Boolean).join('\n\n')

  const competitorNames = (competitors ?? []).map(c => c.name).join(', ') || 'none registered'

  const dataBlock = `
BRAND: ${brandCtx.brandName}
Category: ${brandCtx.category ?? 'not set'}
${formatBrandContextBlock(brandCtx)}

SHARE OF VOICE (as of ${sovSnap?.snapshot_date ?? 'no data'}):
${sovLines}

TRACKED COMPETITORS: ${competitorNames}

SENTIMENT (latest: ${latest?.day ?? 'no data'}):
${sentimentBlock}
${trendLine ? `7-day trend: ${trendLine}` : ''}

SOCIAL SIGNALS (sample of recent classified mentions):
${mentionsBlock || 'No classified mentions yet'}
`.trim()

  const systemPrompt = `You are a senior brand strategist producing a competitive intelligence briefing for a Nigerian / West African marketing team. You write in plain English — no jargon, no em dashes. Active voice only. Be specific and actionable.

You MUST return ONLY valid JSON in this exact shape — no markdown fences, no preamble:
{
  "title": "string — e.g. 'Competitive Intelligence Briefing: [Brand] vs [Top Competitor]'",
  "executive_summary": "string — 2-3 sentences covering the key competitive position",
  "sov_analysis": "string — what the share-of-voice numbers reveal about market presence",
  "sentiment_vs_market": "string — how brand sentiment compares to what you'd expect given the competitive set",
  "brand_strengths": ["string"],
  "brand_vulnerabilities": ["string"],
  "competitor_threats": ["string — specific named competitors and what they're doing"],
  "opportunities": ["string — white-space or under-exploited angles"],
  "recommendations": [
    { "action": "string", "rationale": "string", "priority": "High" | "Medium" | "Low" }
  ],
  "data_gaps": ["string — what data would make this briefing more accurate"],
  "confidence": "High" | "Medium" | "Low"
}`

  const userMessage = `Generate a competitive intelligence briefing using this live brand data:\n\n${dataBlock}\n\nFocus on actionable insights for a Nigerian marketing team. Be direct — lead with findings, not process.`

  try {
    const raw = await callAi({
      tier: 'structural',
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 2000,
      temperature: 0.3,
    })
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    const result = JSON.parse(cleaned)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[competitive-briefing] error:', err)
    return NextResponse.json({ error: 'Briefing generation failed. Try again.' }, { status: 500 })
  }
}
