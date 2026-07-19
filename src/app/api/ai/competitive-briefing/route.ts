import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { callAi } from '@/lib/ai/client'
import { buildBrandContext, formatBrandContextBlock } from '@/lib/ai/brand-context'
import { getActiveBrand } from '@/lib/active-brand'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string; market_share_pct: number | null }>(supabase, 'id, market_share_pct')
  if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 })

  const service = await createServiceClient()

  const [
    { data: sovSnap },
    { data: competitors },
    { data: sightings },
    { data: sentimentRows },
    { data: mentions },
    { data: bhiSnap },
    brandCtx,
  ] = await Promise.all([
    service
      .from('sov_snapshots')
      .select('snapshot_date, social_sov, blended_sov, competitor_data')
      .eq('brand_id', brand.id)
      .order('snapshot_date', { ascending: false })
      .limit(1).maybeSingle(),
    service
      .from('competitors')
      .select('id, name, website_url')
      .eq('brand_id', brand.id),
    service
      .from('competitor_sightings')
      .select('competitor_name, sighting_type, description, spotted_at')
      .eq('brand_id', brand.id)
      .order('spotted_at', { ascending: false })
      .limit(10),
    service
      .from('sentiment_daily')
      .select('day, social_score, positive_pct, neutral_pct, negative_pct')
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
    service
      .from('brand_health_snapshots')
      .select('bhi, components, snapshot_date')
      .eq('brand_id', brand.id)
      .order('snapshot_date', { ascending: false })
      .limit(1).maybeSingle(),
    buildBrandContext(brand.id),
  ])

  // Without any social signal there is nothing to compare — say what is
  // missing and point at the fix instead of generating an empty briefing.
  if (!sovSnap && (mentions ?? []).length === 0 && (sentimentRows ?? []).length === 0) {
    return NextResponse.json({
      error: 'We need social data before we can write a competitive briefing. Connect X or Instagram, then run a crawl from the Sentiment page. Once mentions and share of voice arrive, this briefing writes itself.',
      cta: { label: 'Connect a social account', href: '/dashboard/connectors' },
    }, { status: 422 })
  }

  // ── SOV & ESOV ─────────────────────────────────────────────────────────────
  const competitorData = sovSnap?.competitor_data as {
    brand_volume?: number
    competitor_volumes?: Record<string, number>
  } | null

  const brandVolume = competitorData?.brand_volume ?? 0
  const competitorVolumes = competitorData?.competitor_volumes ?? {}
  const totalVolume = brandVolume + Object.values(competitorVolumes).reduce((a, b) => a + b, 0)

  const brandSov = totalVolume > 0 ? Math.round((brandVolume / totalVolume) * 100) : null
  const marketSharePct = brand.market_share_pct ? Number(brand.market_share_pct) : null
  const esov = brandSov != null && marketSharePct != null ? brandSov - marketSharePct : null

  const sovLines = totalVolume > 0
    ? [
        `${brandCtx.brandName}: ${brandVolume} mentions (${brandSov}% SOV)`,
        ...Object.entries(competitorVolumes)
          .sort((a, b) => b[1] - a[1])
          .map(([name, vol]) => `${name}: ${vol} mentions (${Math.round((vol / totalVolume) * 100)}% SOV)`),
      ].join('\n')
    : 'No SOV data yet'

  const esovLine = esov != null
    ? `ESOV (SOV − Market Share): ${esov > 0 ? '+' : ''}${esov}% → ${esov >= 5 ? 'Growth posture — outinvesting market share weight' : esov >= 0 ? 'Mild growth posture' : esov >= -5 ? 'Parity — market share growth unlikely without investment increase' : 'Underinvestment risk — competitors with positive ESOV will take share'}`
    : 'ESOV: insufficient data (market share % not configured)'

  // ── Sentiment ──────────────────────────────────────────────────────────────
  const latest = sentimentRows?.[0]
  const sentimentBlock = latest
    ? `Score: ${Math.round(latest.social_score)}/100\nPositive: ${Math.round(latest.positive_pct)}% | Neutral: ${Math.round(latest.neutral_pct)}% | Negative: ${Math.round(latest.negative_pct)}%`
    : 'No sentiment data yet'

  const trendLine = sentimentRows && sentimentRows.length > 1
    ? [...sentimentRows].reverse().map(d => `${d.day}: ${Math.round(d.social_score)}`).join(', ')
    : null

  // ── Mentions ───────────────────────────────────────────────────────────────
  const negativeMentions = (mentions ?? []).filter(m => m.sentiment_label === 'negative').slice(0, 5)
  const positiveMentions = (mentions ?? []).filter(m => m.sentiment_label === 'positive').slice(0, 5)

  const mentionsBlock = [
    positiveMentions.length ? `Positive signals:\n${positiveMentions.map(m => `  • "${m.content?.slice(0, 100)}"${m.author_handle ? ` — @${m.author_handle}` : ''}`).join('\n')}` : null,
    negativeMentions.length ? `Negative signals:\n${negativeMentions.map(m => `  • "${m.content?.slice(0, 100)}"${m.author_handle ? ` — @${m.author_handle}` : ''}`).join('\n')}` : null,
  ].filter(Boolean).join('\n\n')

  // ── Competitor sightings ────────────────────────────────────────────────────
  const sightingsBlock = (sightings ?? []).length > 0
    ? (sightings ?? []).map(s => `  • [${s.sighting_type?.toUpperCase() ?? 'UNKNOWN'}] ${s.competitor_name ?? 'unknown'}: ${s.description ?? ''} (${s.spotted_at?.slice(0, 10) ?? 'unknown date'})`).join('\n')
    : 'No competitor sightings recorded yet'

  const competitorNames = (competitors ?? []).map(c => c.name).join(', ') || 'none registered'
  const bhiScore = bhiSnap?.bhi != null ? `${Number(bhiSnap.bhi).toFixed(1)}/100` : 'N/A'

  const dataBlock = `
BRAND: ${brandCtx.brandName}
Category: ${brandCtx.category ?? 'not set'}
BHI (latest): ${bhiScore}
Market Share: ${marketSharePct != null ? `${marketSharePct}%` : 'not configured'}
${formatBrandContextBlock(brandCtx)}

SHARE OF VOICE (as of ${sovSnap?.snapshot_date ?? 'no data'}):
${sovLines}

${esovLine}

TRACKED COMPETITORS: ${competitorNames}

RECENT COMPETITOR SIGHTINGS (price moves, launches, campaigns):
${sightingsBlock}

SENTIMENT (latest: ${latest?.day ?? 'no data'}):
${sentimentBlock}
${trendLine ? `7-day trend: ${trendLine}` : ''}

SOCIAL SIGNALS (recent classified mentions):
${mentionsBlock || 'No classified mentions yet'}
`.trim()

  const systemPrompt = `You are a senior brand strategist producing a competitive intelligence briefing for a Nigerian / West African marketing team. You apply Porter's Five Forces framework as a structuring lens, grounded in real data. Write in plain English — no jargon, no em dashes. Active voice only. Be specific and actionable.

You MUST return ONLY valid JSON in this exact shape — no markdown fences, no preamble:
{
  "title": "string — e.g. 'Competitive Intelligence Briefing: [Brand] vs [Top Competitor]'",
  "executive_summary": "string — 2-3 sentences covering the key competitive position including ESOV signal",
  "sov_analysis": "string — what the SOV and ESOV numbers reveal about market presence and future market share trajectory (cite Binet & Field if ESOV is positive or negative)",
  "sentiment_vs_market": "string — how brand sentiment compares to what you would expect given the competitive set",
  "porter_forces": {
    "competitive_rivalry": "string — intensity of rivalry with named competitors, based on SOV data and sightings",
    "threat_of_new_entrants": "string — signals of new entrants from sightings or SOV shifts",
    "bargaining_power_buyers": "string — consumer switching ease, loyalty signals from sentiment and NPS data",
    "threat_of_substitutes": "string — adjacent category moves visible in mentions or sightings",
    "overall_intensity": "High | Medium | Low — and why"
  },
  "brand_strengths": ["string"],
  "brand_vulnerabilities": ["string"],
  "competitor_threats": ["string — specific named competitors and what they are doing"],
  "opportunities": ["string — white-space or under-exploited angles given the competitive landscape"],
  "recommendations": [
    { "action": "string", "rationale": "string", "priority": "High" | "Medium" | "Low" }
  ],
  "data_gaps": ["string — what data would make this briefing more accurate"],
  "confidence": "High" | "Medium" | "Low"
}`

  const userMessage = `Generate a competitive intelligence briefing using this live brand data:\n\n${dataBlock}\n\nApply Porter's Five Forces as the structuring lens. Use the ESOV signal to frame the competitive investment posture. Be direct — lead with findings, not process.`

  try {
    const raw = await callAi({
      tier: 'structural',
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 2200,
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
