import { createServiceClient } from '@/lib/supabase/server'
import { buildBrandContext, formatBrandContextBlock } from './brand-context'
import { computeBHI, ZONE_META } from '@/lib/bhi'

export interface AskSource {
  label: string
  detail: string
}

function ago(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(ms / 3_600_000)
  if (h < 1)  return 'less than 1 hour ago'
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export async function buildAskSystemPrompt(brandId: string): Promise<{
  systemPrompt: string
  availableSources: AskSource[]
}> {
  const [brandCtx, supabase] = await Promise.all([
    buildBrandContext(brandId),
    createServiceClient(),
  ])

  const today = new Date().toISOString().slice(0, 10)

  // Pull all live data in parallel
  const [
    { data: sentimentRows },
    { data: recentMentions },
    { data: sovRow },
    { data: surveyNPS },
    { data: connections },
  ] = await Promise.all([
    supabase
      .from('sentiment_daily')
      .select('day, social_score, positive_pct, neutral_pct, negative_pct, emotion_distribution, platform_breakdown')
      .eq('brand_id', brandId)
      .order('day', { ascending: false })
      .limit(7),
    supabase
      .from('mentions')
      .select('content, author_handle, platform, sentiment_label, emotion_tags, created_at')
      .eq('brand_id', brandId)
      .not('sentiment_label', 'is', null)
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('sov_snapshots')
      .select('snapshot_date, social_sov, blended_sov, competitor_data')
      .eq('brand_id', brandId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('survey_responses')
      .select('nps_score')
      .eq('brand_id', brandId)
      .not('nps_score', 'is', null)
      .gte('created_at', new Date(Date.now() - 30 * 86_400_000).toISOString()),
    supabase
      .from('social_connections')
      .select('platform, account_name, sync_status, last_synced_at')
      .eq('brand_id', brandId),
  ])

  const latestSentiment = sentimentRows?.[0]
  const platformBreakdown = (latestSentiment?.platform_breakdown ?? {}) as Record<string, {
    volume: number; score: number; positive_pct: number; neutral_pct: number; negative_pct: number
  }>

  // Compute NPS
  const npsScores = (surveyNPS ?? []).map(r => r.nps_score as number)
  const avgNPS = npsScores.length
    ? Number((npsScores.reduce((a, b) => a + b, 0) / npsScores.length).toFixed(1))
    : null
  const surveyScore = avgNPS !== null ? Math.min(100, Math.max(0, (avgNPS + 100) / 2)) : null

  // Compute BHI
  const bhi = computeBHI({
    sentimentScore: latestSentiment?.social_score ?? null,
    sovScore: sovRow?.social_sov ?? null,
    surveyScore,
  })

  // ── Build data snapshot string ────────────────────────────────────────────
  const parts: string[] = []
  const availableSources: AskSource[] = []

  // BHI
  if (bhi.score !== null) {
    const zone = bhi.zone ? ZONE_META[bhi.zone].label : '—'
    parts.push(`BHI: ${bhi.score}/100 (${zone} zone, ${bhi.coverage}% data coverage — ${
      [
        bhi.components.sentiment !== null ? 'Sentiment' : null,
        bhi.components.sov       !== null ? 'SOV'       : null,
        bhi.components.survey    !== null ? 'Survey NPS' : null,
      ].filter(Boolean).join(' + ')
    } feeding it)`)
    availableSources.push({ label: 'Brand Health Index', detail: `${bhi.score}/100, ${zone}` })
  }

  // Sentiment
  if (latestSentiment) {
    const platformLines = Object.entries(platformBreakdown)
      .map(([p, s]) => `  • ${p === 'twitter' ? 'X' : 'Instagram'}: ${Math.round(s.score)}/100 (${s.volume} mentions)`)
      .join('\n')

    const emotionDist = (latestSentiment.emotion_distribution ?? {}) as Record<string, number>
    const topEmotions = Object.entries(emotionDist)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([e, n]) => `${e} (${n})`)
      .join(', ')

    parts.push(
      `Sentiment (${latestSentiment.day}):\n` +
      `  Blended score: ${Math.round(latestSentiment.social_score)}/100\n` +
      `  Mix: ${Math.round(latestSentiment.positive_pct)}% positive / ${Math.round(latestSentiment.neutral_pct)}% neutral / ${Math.round(latestSentiment.negative_pct)}% negative\n` +
      (platformLines ? `  By platform:\n${platformLines}\n` : '') +
      (topEmotions ? `  Top emotions: ${topEmotions}` : '')
    )

    if (sentimentRows && sentimentRows.length > 1) {
      const trend = [...sentimentRows].reverse().map(d => `${d.day}: ${Math.round(d.social_score)}`).join(', ')
      parts.push(`Sentiment trend (7 days): ${trend}`)
    }

    availableSources.push({
      label: 'Sentiment data',
      detail: `Score ${Math.round(latestSentiment.social_score)}/100 from ${Object.values(platformBreakdown).reduce((s, p) => s + p.volume, 0)} mentions on ${latestSentiment.day}`,
    })
  } else {
    parts.push('Sentiment: no data collected yet — crawl has not run or no mentions found')
  }

  // Recent mentions
  if (recentMentions && recentMentions.length > 0) {
    const mentionLines = recentMentions.map(m =>
      `  [${m.platform === 'twitter' ? 'X' : 'IG'} · ${m.sentiment_label ?? 'unclassified'}] "${m.content?.slice(0, 120)}${(m.content?.length ?? 0) > 120 ? '…' : ''}" — @${m.author_handle || 'unknown'}, ${ago(m.created_at)}`
    ).join('\n')
    parts.push(`Recent classified mentions:\n${mentionLines}`)
    availableSources.push({ label: 'Recent mentions', detail: `${recentMentions.length} recent classified mentions` })
  }

  // SOV
  if (sovRow) {
    parts.push(`Share of Voice (${sovRow.snapshot_date}): Social SOV ${sovRow.social_sov ?? '—'}%, Blended SOV ${sovRow.blended_sov ?? '—'}%`)
    availableSources.push({ label: 'Share of Voice', detail: `Social ${sovRow.social_sov}%, updated ${sovRow.snapshot_date}` })
  } else {
    parts.push('Share of Voice: no data yet — SOV snapshot not yet generated')
  }

  // Survey NPS
  if (avgNPS !== null) {
    parts.push(`Survey NPS (last 30 days): average ${avgNPS} from ${npsScores.length} responses`)
    availableSources.push({ label: 'Survey NPS', detail: `Avg NPS ${avgNPS} (${npsScores.length} responses)` })
  } else {
    parts.push('Survey NPS: no survey responses yet')
  }

  // Connected platforms
  const connectedPlatforms = (connections ?? [])
    .map(c => `${c.platform} (${c.sync_status}${c.last_synced_at ? ', last synced ' + ago(c.last_synced_at) : ''})`)
    .join(', ')
  if (connectedPlatforms) {
    parts.push(`Connected social accounts: ${connectedPlatforms}`)
  }

  const dataSnapshot = parts.join('\n\n')

  const voice = brandCtx.brandVoice as { adjectives?: string[]; tone?: string }
  const segments = (brandCtx.targetSegments as Array<{ name?: string }> | null)?.map(s => s?.name ?? '').filter(Boolean).join(', ')

  const systemPrompt = `You are BrandPulse, the brand intelligence assistant for ${brandCtx.brandName}. You answer any brand question by reasoning over the connected data provided to you, and you always cite which data you used. You serve marketers, not analysts, so you explain plainly and lead with the answer.

Context for this brand:
- Identity & values: ${formatBrandContextBlock(brandCtx)}
- Brand voice: ${voice.adjectives?.join(', ') ?? 'not set'}${voice.tone ? `, tone: ${voice.tone}` : ''}
- Target audience: ${segments || 'not specified'}
- Cultural context: Today is ${today} (West Africa / Nigeria market)
- Available data snapshot:
${dataSnapshot}

Rules:
1. Answer first, evidence second. No throat-clearing or preamble.
2. Cite the source of every factual claim (e.g. "Sentiment data, updated today").
3. State confidence: High (strong fresh data), Medium (partial or older data), Low (thin or no data).
4. Interpret all local-language signals culturally, never literally.
5. If you cannot answer due to missing data, say so directly and recommend which tool or data source would fill the gap.
6. When asked for a business case, activation brief, or report, produce the full structured document, not a summary.

You MUST return ONLY valid JSON in this exact shape — no markdown fences, no preamble:
{
  "answer": "string — your full response in plain English",
  "sources": [{ "label": "string", "detail": "string" }],
  "confidence": "High" | "Medium" | "Low",
  "collectionRecommendation": "string describing what to collect, or null if data is sufficient"
}`

  return { systemPrompt, availableSources }
}
