import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAi } from '@/lib/ai/client'
import { z } from 'zod'

export const runtime = 'nodejs'
export const maxDuration = 30

const bodySchema = z.object({
  stage:     z.enum(['awareness', 'consideration', 'preference', 'action', 'loyalty', 'advocacy']),
  score:     z.number().nullable(),
  brandName: z.string(),
  industry:  z.string().nullable(),
})

type StageKey = z.infer<typeof bodySchema>['stage']

const STAGE_DEFS: Record<StageKey, string> = {
  awareness:     'Brand Awareness — share of the target market who know the brand exists. Powered by reach: OOH, digital impressions, social SOV, and PR.',
  consideration: 'Consideration — people actively engaging with the brand\'s content. Powered by social engagement rate and paid digital clicks.',
  preference:    'Preference — positive sentiment toward the brand. Powered by sentiment analysis of social mentions and press coverage.',
  action:        'Action — people taking a tangible step: attending an event, clicking a vanity OOH link, or converting via a digital ad.',
  loyalty:       'Loyalty — satisfied customers measured by NPS. Promoters score 9–10, passives 7–8, detractors 0–6.',
  advocacy:      'Advocacy — customers actively sharing and promoting the brand organically. Measured by organic share rate across social content.',
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { stage, score, brandName, industry } = parsed.data

  const { data: brand } = await supabase.from('brands').select('id').limit(1).single()
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const now = new Date()
  const d30 = new Date(now); d30.setDate(now.getDate() - 30)
  const d14 = new Date(now); d14.setDate(now.getDate() - 14)
  const cut30 = d30.toISOString().split('T')[0]
  const cut14 = d14.toISOString().split('T')[0]

  const channels: string[] = []
  const initiatives: string[] = []
  let signals: Record<string, unknown> = {}

  // ── fetch stage-specific signals ─────────────────────────────────────────

  if (stage === 'awareness') {
    const [{ data: sovSnap }, { data: oohSites }, { data: perf }, { data: campaigns }, { data: influencers }, { data: press }] = await Promise.all([
      supabase.from('sov_snapshots').select('social_sov').order('snapshot_date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('ooh_sites').select('name, visits, campaign_id').eq('brand_id', brand.id).eq('status', 'active'),
      supabase.from('digital_performance_daily').select('platform, impressions, spend').eq('brand_id', brand.id).gte('date', cut30),
      supabase.from('campaigns').select('id, name, objective').eq('brand_id', brand.id).eq('status', 'active'),
      supabase.from('influencers').select('name, followers, campaign_id').eq('brand_id', brand.id).not('campaign_id', 'is', null),
      supabase.from('press_mentions').select('id').eq('brand_id', brand.id).gte('published_at', d30.toISOString()),
    ])

    const oohVisits   = (oohSites ?? []).reduce((s, x) => s + (x.visits ?? 0), 0)
    const impressions = (perf ?? []).reduce((s, x) => s + (x.impressions ?? 0), 0)
    const adSpend     = (perf ?? []).reduce((s, x) => s + (x.spend ?? 0), 0)
    const infReach    = (influencers ?? []).reduce((s, x) => s + (x.followers ?? 0), 0)

    if (oohVisits > 0)                    channels.push('OOH / Outdoor')
    if (impressions > 0)                  channels.push('Digital Paid Media')
    if ((sovSnap?.social_sov ?? 0) > 0)   channels.push('Organic Social')
    if ((press?.length ?? 0) > 0)         channels.push('PR / Press Coverage')
    if (infReach > 0)                     channels.push('Influencer Marketing')

    const awareCampaigns = (campaigns ?? []).filter(c => c.objective === 'awareness')
    for (const c of awareCampaigns) initiatives.push(c.name)
    for (const i of (influencers ?? [])) initiatives.push(`${i.name} (influencer)`)

    signals = {
      sov_pct: sovSnap?.social_sov ?? null,
      ooh_active_sites: (oohSites ?? []).length,
      ooh_total_visits: oohVisits,
      digital_impressions_30d: impressions,
      digital_ad_spend_30d_ngn: adSpend,
      influencer_potential_reach: infReach,
      press_mentions_30d: press?.length ?? 0,
      active_awareness_campaigns: awareCampaigns.map(c => c.name),
    }

  } else if (stage === 'consideration') {
    const [{ data: posts }, { data: perf }, { data: campaigns }] = await Promise.all([
      supabase.from('social_posts').select('engagement_rate, likes, comments, shares, platform').gte('posted_at', d30.toISOString()),
      supabase.from('digital_performance_daily').select('platform, clicks, ctr').eq('brand_id', brand.id).gte('date', cut30),
      supabase.from('campaigns').select('id, name, objective').eq('brand_id', brand.id).eq('status', 'active'),
    ])

    const postCount  = (posts ?? []).length
    const engPosts   = (posts ?? []).filter(p => p.engagement_rate != null)
    const avgEng     = engPosts.length > 0 ? engPosts.reduce((s, p) => s + (p.engagement_rate ?? 0), 0) / engPosts.length : 0
    const totalClicks = (perf ?? []).reduce((s, r) => s + (r.clicks ?? 0), 0)
    const platforms  = [...new Set((posts ?? []).map(p => p.platform).filter(Boolean))]

    if (postCount > 0)   channels.push('Organic Social Content')
    if (totalClicks > 0) channels.push('Digital Paid Media')

    const consCampaigns = (campaigns ?? []).filter(c => c.objective === 'consideration')
    for (const c of consCampaigns) initiatives.push(c.name)

    signals = {
      post_count_30d: postCount,
      avg_engagement_rate_pct: Math.round(avgEng * 100) / 100,
      active_platforms: platforms,
      digital_clicks_30d: totalClicks,
      consideration_campaigns: consCampaigns.map(c => c.name),
    }

  } else if (stage === 'preference') {
    const [{ data: sentDays }, { data: press }] = await Promise.all([
      supabase.from('sentiment_daily').select('social_score, day').gte('day', cut14).order('day', { ascending: true }),
      supabase.from('press_mentions').select('sentiment_score, headline').eq('brand_id', brand.id).gte('published_at', d30.toISOString()).order('published_at', { ascending: false }).limit(10),
    ])

    const sentWithData = (sentDays ?? []).filter(d => d.social_score != null)
    const avgSent = sentWithData.length > 0
      ? sentWithData.reduce((s, d) => s + (d.social_score ?? 0), 0) / sentWithData.length
      : null

    const pressWithScore = (press ?? []).filter(p => p.sentiment_score != null)
    const avgPress = pressWithScore.length > 0
      ? pressWithScore.reduce((s, p) => s + (p.sentiment_score ?? 0), 0) / pressWithScore.length
      : null

    if (sentWithData.length > 0)    channels.push('Social Media Sentiment')
    if ((press?.length ?? 0) > 0)   channels.push('Press Coverage')

    signals = {
      avg_sentiment_score_14d: avgSent != null ? Math.round(avgSent) : null,
      sentiment_days_with_data: sentWithData.length,
      press_mentions_30d: press?.length ?? 0,
      avg_press_sentiment: avgPress != null ? Math.round(avgPress) : null,
      recent_headlines: (press ?? []).slice(0, 3).map(p => p.headline).filter(Boolean),
    }

  } else if (stage === 'action') {
    const [{ data: interactions }, { data: oohSites }, { data: perf }, { data: events }, { data: purchases }, { data: sdkConversions }] = await Promise.all([
      supabase.from('event_interactions').select('interaction_type').gte('created_at', d30.toISOString()),
      supabase.from('ooh_sites').select('name, visits').eq('brand_id', brand.id).eq('status', 'active'),
      supabase.from('digital_performance_daily').select('conversions, platform').eq('brand_id', brand.id).gte('date', cut30),
      supabase.from('events').select('name, status').eq('brand_id', brand.id).in('status', ['live', 'upcoming', 'completed']).gte('date_end', d30.toISOString()),
      supabase.from('purchase_events').select('amount').eq('brand_id', brand.id).gte('occurred_at', d30.toISOString()),
      supabase.from('sdk_events').select('value').eq('brand_id', brand.id).eq('event_type', 'purchase').gte('occurred_at', d30.toISOString()),
    ])

    const leads       = (interactions ?? []).filter(i => ['new_lead', 'new_customer'].includes(i.interaction_type)).length
    const oohVisits   = (oohSites ?? []).reduce((s, x) => s + (x.visits ?? 0), 0)
    const adConvs     = (perf ?? []).reduce((s, r) => s + (r.conversions ?? 0), 0)
    const purchaseRev = (purchases ?? []).reduce((s, p) => s + (p.amount ?? 0), 0)

    if (leads > 0 || (events?.length ?? 0) > 0) channels.push('Events & Activations')
    if (oohVisits > 0)                           channels.push('OOH Attribution (Vanity Links)')
    if (adConvs > 0)                             channels.push('Digital Paid Media')
    if ((purchases?.length ?? 0) > 0)            channels.push('Payment Gateway (Paystack/Flutterwave)')
    if ((sdkConversions?.length ?? 0) > 0)       channels.push('Website Pixel')

    for (const e of (events ?? [])) initiatives.push(e.name)

    signals = {
      event_leads_30d: leads,
      ooh_visits_total: oohVisits,
      digital_conversions_30d: adConvs,
      purchase_transactions_30d: purchases?.length ?? 0,
      purchase_revenue_ngn: purchaseRev,
      active_events: (events ?? []).map(e => e.name),
    }

  } else if (stage === 'loyalty') {
    const [{ data: surveyResponses }, { data: purchases }, { data: campaigns }] = await Promise.all([
      supabase.from('survey_responses').select('answers').eq('quality_flag', 'ok'),
      supabase.from('purchase_events').select('customer_email').eq('brand_id', brand.id).gte('occurred_at', d30.toISOString()),
      supabase.from('campaigns').select('id, name, objective').eq('brand_id', brand.id).eq('status', 'active'),
    ])

    const npsScores: number[] = []
    for (const r of surveyResponses ?? []) {
      const answers = r.answers as Record<string, unknown>
      for (const val of Object.values(answers)) {
        if (typeof val === 'number' && Number.isInteger(val) && val >= 0 && val <= 10) {
          npsScores.push(val); break
        }
      }
    }
    const promoters  = npsScores.filter(s => s >= 9).length
    const passives   = npsScores.filter(s => s >= 7 && s <= 8).length
    const detractors = npsScores.filter(s => s <= 6).length
    const nps = npsScores.length >= 3
      ? Math.round(((promoters - detractors) / npsScores.length) * 100)
      : null

    // Count repeat purchasers (same email appears 2+ times)
    const emailCounts: Record<string, number> = {}
    for (const p of purchases ?? []) {
      if (p.customer_email) emailCounts[p.customer_email] = (emailCounts[p.customer_email] ?? 0) + 1
    }
    const repeatBuyers = Object.values(emailCounts).filter(c => c >= 2).length

    if (npsScores.length > 0) channels.push('Customer Surveys (NPS)')
    if (repeatBuyers > 0)     channels.push('Payment Gateway (repeat purchases)')

    const retCampaigns = (campaigns ?? []).filter(c => c.objective === 'retention')
    for (const c of retCampaigns) initiatives.push(c.name)

    signals = {
      nps_score: nps,
      total_respondents: npsScores.length,
      promoters, passives, detractors,
      repeat_buyers_30d: repeatBuyers,
      retention_campaigns: retCampaigns.map(c => c.name),
    }

  } else {
    // advocacy
    const [{ data: posts }, { data: influencers }] = await Promise.all([
      supabase.from('social_posts').select('likes, comments, shares').gte('posted_at', d30.toISOString()),
      supabase.from('influencers').select('name, followers').eq('brand_id', brand.id).eq('status', 'active').not('campaign_id', 'is', null),
    ])

    const totalShares = (posts ?? []).reduce((s, p) => s + (p.shares ?? 0), 0)
    const totalEngs   = (posts ?? []).reduce((s, p) => s + (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0), 0)
    const shareRate   = totalEngs > 0 ? (totalShares / totalEngs) * 100 : 0

    if (totalShares > 0)               channels.push('Organic Social Sharing')
    if ((influencers?.length ?? 0) > 0) channels.push('Influencer Marketing')

    for (const i of influencers ?? []) initiatives.push(`${i.name} (influencer)`)

    signals = {
      organic_share_rate_pct: Math.round(shareRate * 10) / 10,
      total_shares_30d: totalShares,
      total_engagements_30d: totalEngs,
      post_count_30d: (posts ?? []).length,
      active_campaign_influencers: influencers?.length ?? 0,
    }
  }

  // ── build prompt ─────────────────────────────────────────────────────────

  const systemPrompt = `You are a senior brand strategist for Nigerian and West African consumer brands.
You analyse funnel stage data and explain, in plain English, why a score is where it is.
You know Nigerian market channels: OOH boards, social media, radio, events, WhatsApp, influencers, PR.
Respond with valid JSON only. No markdown. No preamble.`

  const userPrompt = `Brand: ${brandName}
Industry: ${industry ?? 'not specified'}
Funnel stage: ${stage} — ${STAGE_DEFS[stage]}
Current score: ${score != null ? `${score}/100` : 'no data yet'}

Active channels detected: ${channels.length > 0 ? channels.join(', ') : 'none yet'}
Active initiatives: ${initiatives.length > 0 ? initiatives.join(', ') : 'none yet'}

Signal data:
${JSON.stringify(signals, null, 2)}

Write:
1. A 3–4 sentence explanation of why this score is at this level. Be specific: name the actual signals, quote data points, say what is working and what is holding the score back. Write in second person ("Your awareness score reflects…").
2. Two concrete actions to improve this score in the next 30 days. Each action should name a specific channel or tactic, not vague advice.

Reply with JSON only:
{
  "explanation": "...",
  "topActions": ["...", "..."]
}`

  try {
    const text = await callAi({
      tier:        'structural',
      system:      systemPrompt,
      messages:    [{ role: 'user', content: userPrompt }],
      maxTokens:   700,
      temperature: 0.3,
    })

    const result = JSON.parse(
      text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
    ) as { explanation: string; topActions: string[] }

    return NextResponse.json({
      channels:   channels.length > 0 ? channels : ['No channel data yet'],
      initiatives,
      explanation: result.explanation,
      topActions:  result.topActions ?? [],
    })
  } catch {
    return NextResponse.json({ error: 'Analysis failed — please try again.' }, { status: 500 })
  }
}
