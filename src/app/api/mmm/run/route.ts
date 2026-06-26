import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getActiveBrand } from '@/lib/active-brand'
import { callAi } from '@/lib/ai/client'
import { z } from 'zod'

const Body = z.object({
  days:      z.number().int().min(30).max(365).default(90),
  brandName: z.string(),
})

// Effectiveness multipliers: accounts for channel's typical conversion quality
const EFFECTIVENESS: Record<string, number> = {
  events:  2.0,
  email:   1.8,
  digital: 1.5,
  social:  1.3,
  radio:   1.2,
  tv:      1.1,
  ooh:     1.0,
  print:   0.9,
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = Body.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { days, brandName } = parsed.data

  const brand = await getActiveBrand<{ id: string; category: string | null }>(supabase, 'id, category')
  if (!brand) return NextResponse.json({ error: 'No active brand' }, { status: 404 })

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffDate = cutoff.toISOString().slice(0, 10)
  const cutoffISO  = cutoff.toISOString()

  // ── Collect channel data ────────────────────────────────────────────────────
  const [
    { data: radioData },
    { data: tvData },
    { data: printData },
    { data: oohData },
    { data: socialData },
    { data: eventLeadData },
    { data: sdkData },
    { data: emailConnectors },
  ] = await Promise.all([
    supabase.from('radio_schedules')
      .select('spots_aired, net_cost')
      .eq('brand_id', brand.id)
      .gte('spot_date', cutoffDate),
    supabase.from('tv_spots')
      .select('spots_aired, net_cost')
      .eq('brand_id', brand.id)
      .gte('spot_date', cutoffDate),
    supabase.from('print_placements')
      .select('net_cost, readership')
      .eq('brand_id', brand.id)
      .gte('edition_date', cutoffDate),
    supabase.from('ooh_sites')
      .select('id, vanity_visits, total_spend')
      .eq('brand_id', brand.id),
    supabase.from('social_posts')
      .select('impressions, reach, likes, comments, shares')
      .eq('brand_id', brand.id)
      .gte('posted_at', cutoffISO),
    supabase.from('events')
      .select('id')
      .eq('brand_id', brand.id),
    supabase.from('sdk_events')
      .select('event_type, value')
      .eq('brand_id', brand.id)
      .gte('occurred_at', cutoffISO),
    supabase.from('email_connectors')
      .select('id')
      .eq('brand_id', brand.id),
  ])

  // Email snapshots (via connector)
  const connectorIds = (emailConnectors ?? []).map(c => c.id)
  const { data: emailData } = connectorIds.length > 0
    ? await supabase.from('email_campaign_snapshots')
        .select('open_rate, click_rate, recipient_count')
        .in('connector_id', connectorIds)
        .gte('sent_at', cutoffISO)
    : { data: [] }

  // Event leads (count leads captured across all events for this brand)
  const eventIds = (eventLeadData ?? []).map(e => e.id)
  const { data: leadsData } = eventIds.length > 0
    ? await supabase.from('event_leads').select('id').in('event_id', eventIds)
    : { data: [] }

  // ── Aggregate raw activity units per channel ───────────────────────────────
  const radio  = { spend: 0, activity: 0 }
  const tv     = { spend: 0, activity: 0 }
  const print  = { spend: 0, activity: 0 }
  const ooh    = { spend: 0, activity: 0 }
  const social = { spend: 0, activity: 0 }
  const events = { spend: 0, activity: 0 }
  const digital = { spend: 0, activity: 0 }
  const email  = { spend: 0, activity: 0 }

  for (const r of (radioData ?? [])) {
    radio.spend    += r.net_cost ?? 0
    radio.activity += r.spots_aired ?? 0
  }
  for (const r of (tvData ?? [])) {
    tv.spend    += r.net_cost ?? 0
    tv.activity += r.spots_aired ?? 0
  }
  for (const r of (printData ?? [])) {
    print.spend    += r.net_cost ?? 0
    print.activity += r.readership ?? 0
  }
  for (const r of (oohData ?? [])) {
    ooh.spend    += r.total_spend ?? 0
    ooh.activity += r.vanity_visits ?? 0
  }
  for (const r of (socialData ?? [])) {
    social.activity += (r.impressions ?? 0) + (r.reach ?? 0) + (r.likes ?? 0) + (r.comments ?? 0) + (r.shares ?? 0)
  }
  events.activity = (leadsData ?? []).length

  // SDK events: purchases + leads
  for (const e of (sdkData ?? [])) {
    if (['purchase', 'lead', 'signup', 'conversion'].includes(e.event_type)) {
      digital.activity += 1
      digital.spend += e.value ?? 0
    }
  }
  // Email: opens + clicks weighted
  for (const e of (emailData ?? [])) {
    const recipients = e.recipient_count ?? 0
    email.activity += Math.round(recipients * ((e.open_rate ?? 0) + (e.click_rate ?? 0)))
  }

  // ── Normalise to contribution % with effectiveness weighting ───────────────
  const channelRaw: Record<string, { activity: number; spend: number }> = {
    radio, tv, print, ooh, social, events, digital, email,
  }

  // Weighted activity = raw activity × effectiveness multiplier
  const weighted: Record<string, number> = {}
  for (const [ch, data] of Object.entries(channelRaw)) {
    weighted[ch] = data.activity * (EFFECTIVENESS[ch] ?? 1.0)
  }

  const totalWeighted = Object.values(weighted).reduce((s, v) => s + v, 0)

  const contributions: Record<string, number> = {}
  const channelSpend: Record<string, number>   = {}
  const channelRoi: Record<string, number>     = {}

  if (totalWeighted > 0) {
    for (const [ch, w] of Object.entries(weighted)) {
      contributions[ch] = Math.round((w / totalWeighted) * 1000) / 10 // 1 dp %
      channelSpend[ch]  = channelRaw[ch].spend
    }
  }

  // Total estimated outcomes (leads + digital conversions + small OOH conversion proxy)
  const totalOutcomes = events.activity + digital.activity + Math.round(ooh.activity * 0.02)

  // ROI per channel: if we have spend data
  const totalSpend = Object.values(channelSpend).reduce((s, v) => s + v, 0)
  for (const [ch, pct] of Object.entries(contributions)) {
    const chOutcomes = (pct / 100) * totalOutcomes
    const chSpend    = channelSpend[ch] ?? 0
    if (chSpend > 0 && chOutcomes > 0) {
      // Assume NGN 5,000 average lead value
      const chRevProxy = chOutcomes * 5000
      channelRoi[ch] = Math.round(((chRevProxy - chSpend) / chSpend) * 100) / 100
    }
  }

  // ── Build context for Claude ───────────────────────────────────────────────
  const hasData = totalWeighted > 0
  const channelSummary = Object.entries(contributions)
    .filter(([, pct]) => pct > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([ch, pct]) => {
      const spend = channelSpend[ch] > 0 ? ` (₦${(channelSpend[ch] / 1000).toFixed(0)}k spend)` : ''
      const roi   = channelRoi[ch]     ? ` ROI: ${channelRoi[ch] > 0 ? '+' : ''}${channelRoi[ch]}x` : ''
      return `${ch}: ${pct}%${spend}${roi}`
    })
    .join('\n')

  const prompt = hasData
    ? `You are a media mix strategist for Nigerian brands.

Brand: ${brandName} (${brand.category ?? 'unspecified category'})
Analysis window: ${days} days
Total estimated consumer outcomes: ${totalOutcomes}
Total media spend tracked: ₦${(totalSpend / 1_000_000).toFixed(2)}M

Channel contribution breakdown (weighted by channel effectiveness):
${channelSummary}

Provide:
1. A 2-sentence executive summary of what the media mix tells us
2. Top 3 optimisation recommendations — specific, actionable, costed where possible, grounded in Nigerian market realities (e.g., Ramadan, peak retail seasons, Lagos vs other markets)
3. One channel to increase investment in and one to reduce — with rationale

Format your response as JSON:
{
  "summary": "...",
  "recommendations": [
    { "channel": "...", "action": "...", "rationale": "..." }
  ],
  "increase": { "channel": "...", "rationale": "..." },
  "reduce": { "channel": "...", "rationale": "..." }
}`
    : `Brand ${brandName} has no media activity data in the last ${days} days. Return JSON: { "summary": "No media activity data found for this period. Add radio schedules, TV spots, print placements, OOH sites, or connect digital channels to see your media mix.", "recommendations": [], "increase": null, "reduce": null }`

  const aiText = await callAi({
    tier: 'structural',
    system: 'You are a media mix strategist specialising in Nigerian and West African brand campaigns.',
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 1500,
  })

  let aiResult: {
    summary: string
    recommendations: { channel: string; action: string; rationale: string }[]
    increase: { channel: string; rationale: string } | null
    reduce:   { channel: string; rationale: string } | null
  }
  try {
    const jsonMatch = aiText.match(/\{[\s\S]*\}/)
    aiResult = jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: aiText, recommendations: [], increase: null, reduce: null }
  } catch {
    aiResult = { summary: aiText, recommendations: [], increase: null, reduce: null }
  }

  // ── Save run ───────────────────────────────────────────────────────────────
  const serviceClient = await createServiceClient()
  const { data: workspaceMember } = await supabase.from('workspace_members')
    .select('workspace_id').eq('user_id', user.id).limit(1).single()

  await serviceClient.from('mmm_runs').insert({
    brand_id:              brand.id,
    workspace_id:          workspaceMember?.workspace_id,
    window_days:           days,
    channel_contributions: contributions,
    channel_spend:         channelSpend,
    channel_roi:           channelRoi,
    total_estimated_outcomes: totalOutcomes,
    ai_summary:            aiResult.summary,
    recommendations:       aiResult.recommendations,
  })

  return NextResponse.json({
    contributions,
    channelSpend,
    channelRoi,
    totalOutcomes,
    totalSpend,
    hasData,
    ...aiResult,
  })
}
