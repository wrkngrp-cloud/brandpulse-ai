import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'

/* ─────────────────────────────────────────────────────────────────────────────
   Demo account: Pinnacle Media Group — full-service Lagos marketing agency
   Story arc: solid mid-tier → lost a major client → won two FMCG retainers
              → Abuja expansion → strong position June 2026
───────────────────────────────────────────────────────────────────────────── */

const DEMO_EMAIL    = 'demo@pinnaclemedia.brandpulse.ai'
const DEMO_PASSWORD = 'Demo@Pinnacle2026!'
const SEED_SECRET   = 'seed-pinnacle-demo-2026'
const BASE          = new Date()

function dAgo(n: number): string {
  const d = new Date(BASE)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().split('T')[0]
}

function tsAgo(daysBack: number, hour = 10): string {
  const d = new Date(BASE)
  d.setUTCDate(d.getUTCDate() - daysBack)
  d.setUTCHours(hour, 0, 0, 0)
  return d.toISOString()
}

function sentScore(d: number): number {
  let base: number
  if      (d >= 280) base = 64
  else if (d >= 240) base = 64 - (d - 240) / 40 * 9
  else if (d >= 160) base = 55 + (240 - d) / 80 * 17
  else if (d >= 60)  base = 72 + (160 - d) / 100 * 4
  else               base = 76 + (60 - d) * 0.03
  const noise = Math.sin(d * 1.5) * 2.8 + Math.cos(d * 1.1) * 1.9
  return +(Math.min(95, Math.max(18, base + noise)).toFixed(1))
}

export async function POST(req: NextRequest) {
  if (req.headers.get('x-seed-secret') !== SEED_SECRET)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  /* ── 1. Auth user ─────────────────────────────────────────────────────── */
  let userId: string
  const { data: users } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 })
  const existing = users?.users?.find(u => u.email === DEMO_EMAIL)
  if (existing) {
    userId = existing.id
    const { data: mems } = await sb.from('workspace_members').select('workspace_id').eq('user_id', userId)
    for (const m of mems ?? []) await sb.from('workspaces').delete().eq('id', m.workspace_id)
  } else {
    const { data: created, error: authErr } = await sb.auth.admin.createUser({
      email: DEMO_EMAIL, password: DEMO_PASSWORD, email_confirm: true,
      user_metadata: { name: 'Bayo Adeyemi', role: 'Managing Director' },
    })
    if (authErr || !created?.user) return NextResponse.json({ error: authErr?.message ?? 'User creation failed' }, { status: 500 })
    userId = created.user.id
  }

  /* ── 2. Workspace ─────────────────────────────────────────────────────── */
  const { data: ws, error: wsErr } = await sb.from('workspaces').insert({
    name: 'Pinnacle Media', plan: 'pro', type: 'brand', industry: 'Agency', base_currency: 'NGN',
  }).select('id').single()
  if (wsErr) return NextResponse.json({ error: wsErr.message }, { status: 500 })
  const wsId = ws.id
  await sb.from('workspace_members').insert({ workspace_id: wsId, user_id: userId, role: 'owner' })

  /* ── 3. Brand ─────────────────────────────────────────────────────────── */
  const { data: brand, error: brandErr } = await sb.from('brands').insert({
    workspace_id:    wsId,
    name:            'Pinnacle Media Group',
    category:        'Agency',
    industry:        'agency',
    primary_color:   '#1A1A2E',
    secondary_color: '#E94560',
    brand_values:    ['Creativity', 'Results', 'Cultural Intelligence', 'Transparency'],
    cultural_profile: { community_corporate: 60, traditional_modern: 55, religious_secular: 50, mass_premium: 65, local_global: 50 },
    target_segments: [
      { name: 'FMCG Brands',   age_range: '30-50', income: 'high',   location: 'Lagos/Abuja' },
      { name: 'Fintech Clients',age_range: '25-45', income: 'high',   location: 'Lagos'       },
      { name: 'Telco Accounts', age_range: '35-55', income: 'high',   location: 'National'    },
    ],
    brand_voice: { tone: 'confident, creative, results-focused', personality: 'The strategic partner who delivers and talks straight', language_mix: { english: 80, pidgin: 15, yoruba: 5, igbo: 0 } },
    bhi_weights:  { awareness: 0.20, consideration: 0.15, preference: 0.20, advocacy: 0.15, nps: 0.15, sentiment: 0.10, sov: 0.05 },
  }).select('id').single()
  if (brandErr) return NextResponse.json({ error: brandErr.message }, { status: 500 })
  const brandId = brand.id

  /* ── 4. Competitors ───────────────────────────────────────────────────── */
  await sb.from('competitors').insert([
    { brand_id: brandId, name: "Noah's Ark Communications", social_handles: { twitter: '@NoahsArkNigeria' }, website_url: 'https://noahsarkcommunications.com' },
    { brand_id: brandId, name: 'X3M Ideas',     social_handles: { twitter: '@X3MIdeas'    }, website_url: 'https://x3mideas.com' },
    { brand_id: brandId, name: 'DDB Lagos',     social_handles: { twitter: '@DDBLagos'    }, website_url: 'https://ddblagos.com' },
    { brand_id: brandId, name: 'Insight BBDO',  social_handles: { twitter: '@InsightBBDO' }, website_url: 'https://insightbbdo.com' },
    { brand_id: brandId, name: 'Chain Reactions Africa', social_handles: { twitter: '@ChainReactionsAfrica' }, website_url: 'https://chainreactionsafrica.com' },
  ])

  /* ── 5. Campaigns ─────────────────────────────────────────────────────── */
  const { data: camp1 } = await sb.from('campaigns').insert({
    brand_id: brandId, name: 'Q2 FMCG Sprint',
    description: 'Integrated FMCG campaign for two retainer clients. OOH + digital + activations.',
    objective: 'brand_awareness', status: 'active',
    start_date: dAgo(30), end_date: dAgo(-60), total_budget: 22_000_000, currency: 'NGN',
  }).select('id').single()

  const { data: camp2 } = await sb.from('campaigns').insert({
    brand_id: brandId, name: 'PocketPay Influencer Drive',
    description: 'Influencer strategy and execution for PocketPay Refer and Earn campaign.',
    objective: 'acquisition', status: 'completed',
    start_date: dAgo(120), end_date: dAgo(75), total_budget: 8_500_000, currency: 'NGN',
    ai_summary: 'Delivered 22 influencer activations across Instagram and TikTok. Total reach 18.4M. Cost per install ₦1,850 against ₦3,200 benchmark. Three creators became long-term brand ambassadors.',
  }).select('id').single()

  const { data: camp3 } = await sb.from('campaigns').insert({
    brand_id: brandId, name: 'Easter Brand Activation Lagos',
    description: 'Field activations and sampling events for FMCG client across Lagos.',
    objective: 'brand_awareness', status: 'completed',
    start_date: dAgo(90), end_date: dAgo(60), total_budget: 6_000_000, currency: 'NGN',
    ai_summary: 'Three activation days across Ikeja, Surulere and VI generated 4,200 product samples distributed. Ambassador net promoter score 74. Social amplification added ₦2.1M in earned media value.',
  }).select('id').single()

  const { data: camp4 } = await sb.from('campaigns').insert({
    brand_id: brandId, name: 'Bridger CRM Launch',
    description: 'Brand launch and PR strategy for Bridger B2B CRM tool.',
    objective: 'brand_awareness', status: 'completed',
    start_date: dAgo(180), end_date: dAgo(130), total_budget: 11_000_000, currency: 'NGN',
    ai_summary: 'Launch campaign placed Bridger in TechCabal, Techpoint and Nairametrics. LinkedIn paid campaign drove 840 demo sign-ups at ₦8,500 CPA. Brand search volume up 340% in first month.',
  }).select('id').single()

  await sb.from('campaigns').insert({
    brand_id: brandId, name: 'Q3 Kano Expansion',
    description: 'OOH and radio push for FMCG client entering northern Nigeria.',
    objective: 'brand_awareness', status: 'planned',
    start_date: dAgo(-14), end_date: dAgo(-74), total_budget: 15_000_000, currency: 'NGN',
  })

  const camp1Id = camp1?.id; const camp2Id = camp2?.id; const camp3Id = camp3?.id

  if (camp1Id) await sb.from('campaign_channels').insert([
    { campaign_id: camp1Id, channel: 'digital', budget_allocation: 12_000_000 },
    { campaign_id: camp1Id, channel: 'ooh',     budget_allocation: 10_000_000 },
  ])
  if (camp2Id) await sb.from('campaign_channels').insert([
    { campaign_id: camp2Id, channel: 'influencer', budget_allocation: 6_500_000 },
    { campaign_id: camp2Id, channel: 'digital',    budget_allocation: 2_000_000 },
  ])
  if (camp3Id) await sb.from('campaign_channels').insert([
    { campaign_id: camp3Id, channel: 'events', budget_allocation: 4_000_000 },
    { campaign_id: camp3Id, channel: 'digital', budget_allocation: 2_000_000 },
  ])

  /* ── 6. Sentiment 365 days ────────────────────────────────────────────── */
  const sentRows = []
  for (let d = 364; d >= 0; d--) {
    const score = sentScore(d)
    const pos = +(Math.min(94, score * 0.84 + 5 + Math.sin(d * 0.7) * 3)).toFixed(1)
    const neg = +(Math.max(2, 100 - pos - (15 + Math.cos(d * 0.5) * 4))).toFixed(1)
    const neu = +(Math.max(1, 100 - pos - neg)).toFixed(1)
    const themes = score < 60
      ? ['agency competition', 'client retention', 'talent market', 'fee pressure']
      : ['award wins', 'campaign results', 'new retainers', 'creative excellence', 'influencer ROI']
    sentRows.push({
      brand_id: brandId, day: dAgo(d),
      social_score: score, offline_score: +(score * 0.93 + Math.sin(d) * 2).toFixed(1),
      blended_score: score, positive_pct: pos, neutral_pct: neu, negative_pct: neg,
      top_themes: themes,
      emotion_distribution: { joy: +(pos*0.60).toFixed(1), trust: +(pos*0.28).toFixed(1), anticipation: +(pos*0.12).toFixed(1), sadness: +(neg*0.42).toFixed(1), anger: +(neg*0.32).toFixed(1), fear: +(neg*0.26).toFixed(1) },
    })
  }
  await sb.from('sentiment_daily').insert(sentRows)

  /* ── 7. BHI 180 days ─────────────────────────────────────────────────── */
  const bhiRows = []
  for (let d = 179; d >= 0; d--) {
    const ss = sentScore(d); const t = ss / 100
    const comps = {
      awareness: +(52+t*36).toFixed(1), consideration: +(42+t*38).toFixed(1),
      preference: +(34+t*42).toFixed(1), advocacy: +(30+t*44).toFixed(1),
      nps: +(28+t*46).toFixed(1), sentiment: ss, sov: +(28+t*24).toFixed(1),
    }
    const bhiVal = +(comps.awareness*0.20+comps.consideration*0.15+comps.preference*0.20+comps.advocacy*0.15+comps.nps*0.15+comps.sentiment*0.10+comps.sov*0.05).toFixed(1)
    bhiRows.push({ brand_id: brandId, snapshot_date: dAgo(d), bhi: bhiVal, components: comps, data_coverage_pct: +(82+Math.sin(d*0.3)*7).toFixed(1) })
  }
  await sb.from('brand_health_snapshots').insert(bhiRows)

  /* ── 8. SOV snapshots ─────────────────────────────────────────────────── */
  const sovRows = []
  for (let d = 175; d >= 0; d -= 7) {
    const ss = sentScore(d); const t = ss / 100
    sovRows.push({
      brand_id: brandId, snapshot_date: dAgo(d),
      social_sov: +(12+t*10+Math.sin(d*0.3)*1.5).toFixed(1),
      paid_sov: +(10+t*8).toFixed(1), blended_sov: +(13+t*9).toFixed(1),
      esov: 0,
      competitor_data: { brand_volume: Math.round(3000+t*2000), competitor_volumes: { "Noah's Ark": Math.round(4000-t*500), "X3M Ideas": Math.round(3500+Math.sin(d*0.1)*300) } },
    })
  }
  await sb.from('sov_snapshots').insert(sovRows)

  /* ── 9. Events ────────────────────────────────────────────────────────── */
  const eventsData = [
    { name: 'FMCG Sampling — Surulere', status: 'closed', city: 'Lagos', type: 'sampling', day: dAgo(60), campId: camp3Id },
    { name: 'PocketPay Campus Tour — UNILAG', status: 'closed', city: 'Lagos', type: 'brand_activation', day: dAgo(45), campId: camp2Id },
    { name: 'Bridger SME Bootcamp — VI', status: 'live', city: 'Lagos', type: 'brand_activation', day: dAgo(0), campId: camp4?.id },
  ]

  const ambassadorSets = [
    ['Adaeze Nwosu', 'Kayode Martins', 'Funmi Adeola', 'Ibrahim Musa'],
    ['Chiamaka Eze', 'Rotimi Bello', 'Grace Obi', 'Suleiman Dankwambo'],
    ['Tosin Adeyemi', 'Bimbo Ola', 'Chukwu Ugo'],
  ]
  const interactionTypes = ['new_lead','engaged','sample','photo','new_customer','engaged','new_lead','engaged']

  for (let ei = 0; ei < eventsData.length; ei++) {
    const ev = eventsData[ei]
    const { data: evRow } = await sb.from('events').insert({
      brand_id: brandId, name: ev.name, city: ev.city, status: ev.status,
      activation_type: ev.type, day: ev.day, campaign_id: ev.campId ?? null,
      target_interactions: 100,
    }).select('id').single()
    if (!evRow) continue

    const ambNames = ambassadorSets[ei]
    const ambIds: string[] = []
    for (const n of ambNames) {
      const { data: a } = await sb.from('ambassadors').insert({ brand_id: brandId, event_id: evRow.id, name: n, status: 'active', phone: '+234803' + Math.floor(Math.random()*9000000+1000000) }).select('id').single()
      if (a) ambIds.push(a.id)
    }

    const interactions = []
    const count = ei === 2 ? 20 : ei === 1 ? 28 : 30
    for (const aId of ambIds) {
      for (let i = 0; i < count; i++) {
        interactions.push({ event_id: evRow.id, ambassador_id: aId, brand_id: brandId, interaction_type: interactionTypes[i % interactionTypes.length], occurred_at: tsAgo(ev.status === 'live' ? 0 : (ei === 0 ? 60 : 45), 9+(i%8)) })
      }
    }
    await sb.from('event_interactions').insert(interactions)

    if (ev.status !== 'live') {
      await sb.from('event_roi_reports').insert({
        event_id: evRow.id, brand_id: brandId,
        narrative: ei === 0
          ? 'Surulere sampling generated 4,200 product samples distributed across 3 zones. Ambassador NPS 74. Social amplification added 2.1M EMV.'
          : 'UNILAG campus tour activated 840 new PocketPay accounts in 6 hours. Cost per activation ₦2,200 vs ₦3,800 digital benchmark.',
        ambassador_breakdown: ambNames.map(n => ({ name: n, leads: 8, customers: 5, interactions: count })),
      })
    }
  }

  /* ── 10. Influencers ──────────────────────────────────────────────────── */
  const influencerData = [
    { name: 'Tolu Ogundimu',   handle: '@toluogundimu',   platform: 'instagram', followers: 1800000, engagement_rate: 0.038 },
    { name: 'Gbenga Sesan',    handle: '@gbengasesan',    platform: 'twitter',   followers: 950000,  engagement_rate: 0.045 },
    { name: 'Yemi Orimoloye',  handle: '@yemiorimoloye',  platform: 'instagram', followers: 720000,  engagement_rate: 0.052 },
    { name: 'Amara Eze',       handle: '@amaraeze',       platform: 'tiktok',    followers: 480000,  engagement_rate: 0.068 },
    { name: 'Fola Adeleke',    handle: '@folaadeleke',    platform: 'twitter',   followers: 195000,  engagement_rate: 0.058 },
    { name: 'Nkechi Obi',      handle: '@nkechiobi',      platform: 'instagram', followers: 87000,   engagement_rate: 0.075 },
    { name: 'Emeka Nwachukwu', handle: '@emekaNW',        platform: 'twitter',   followers: 52000,   engagement_rate: 0.062 },
    { name: 'Bukola Afolabi',  handle: '@bukolaafolabi',  platform: 'instagram', followers: 31000,   engagement_rate: 0.088 },
  ]

  for (const inf of influencerData) {
    const { data: infRow } = await sb.from('influencers').insert({
      brand_id: brandId, name: inf.name, handle: inf.handle, platform: inf.platform,
      followers: inf.followers, engagement_rate: inf.engagement_rate, status: 'active', location: 'Lagos, Nigeria',
    }).select('id').single()
    if (!infRow) continue
    await sb.from('influencer_campaigns').insert([
      { brand_id: brandId, influencer_id: infRow.id, campaign_id: camp2Id ?? null, platform: inf.platform, content_type: 'post', agreed_rate: Math.round(inf.followers*0.012), actual_reach: Math.round(inf.followers*0.42), engagement_rate: inf.engagement_rate, status: 'completed', started_at: tsAgo(110), ended_at: tsAgo(80) },
      { brand_id: brandId, influencer_id: infRow.id, campaign_id: camp1Id ?? null, platform: inf.platform, content_type: 'reel', agreed_rate: Math.round(inf.followers*0.018), actual_reach: Math.round(inf.followers*0.50), engagement_rate: inf.engagement_rate*1.4, status: 'active',    started_at: tsAgo(28), ended_at: null },
      { brand_id: brandId, influencer_id: infRow.id, campaign_id: camp3Id ?? null, platform: inf.platform, content_type: 'story', agreed_rate: Math.round(inf.followers*0.008), actual_reach: Math.round(inf.followers*0.35), engagement_rate: inf.engagement_rate*0.8, status: 'completed', started_at: tsAgo(85), ended_at: tsAgo(60) },
    ])
  }

  /* ── 11. Mentions ─────────────────────────────────────────────────────── */
  const mentionTemplates = [
    { c: 'Pinnacle just delivered the best integrated campaign I have seen this quarter', s: 'positive', p: 'twitter' },
    { c: 'That PocketPay influencer brief from Pinnacle was genuinely smart', s: 'positive', p: 'instagram' },
    { c: 'Pinnacle Media winning those FMCG retainers was a big deal for Lagos agencies', s: 'positive', p: 'twitter' },
    { c: 'Agency NPS is a thing now and Pinnacle is eating well on it', s: 'positive', p: 'twitter' },
    { c: 'Lost a solid client to Pinnacle last quarter. Their pitching has levelled up', s: 'neutral', p: 'twitter' },
    { c: 'Pinnacle Media or X3M for our next brand brief? Torn honestly', s: 'neutral', p: 'twitter' },
    { c: 'Campaign timelines slipped twice this year. Frustrating from a top agency', s: 'negative', p: 'twitter' },
    { c: 'Pinnacle Abuja opening is a real signal. They are serious about national reach', s: 'positive', p: 'instagram' },
    { c: 'The Surulere sampling activation was flawlessly executed by Pinnacle', s: 'positive', p: 'instagram' },
    { c: 'Best creative agency in Lagos right now? Pinnacle is in that conversation', s: 'positive', p: 'twitter' },
    { c: 'Pinnacle did a great job on the Bridger launch. Really solid PR work', s: 'positive', p: 'twitter' },
    { c: 'Fee negotiations with Pinnacle were tough. Worth it in the end though', s: 'neutral', p: 'twitter' },
    { c: 'The cultural intelligence angle Pinnacle brings is genuinely different', s: 'positive', p: 'instagram' },
    { c: 'Hoping Pinnacle does not get too big and lose the boutique feel', s: 'neutral', p: 'twitter' },
    { c: 'Pinnacle delivered under budget on our Q1 campaign. Rare in this industry', s: 'positive', p: 'twitter' },
  ]
  const handles = ['@adaeze_ng','@kunle_mktg','@temi_brand','@ify_agency','@chidex_ng','@mosun_pr','@dayo_media','@nnamdi_pr','@sola_comms','@aisha_brand']
  const mentionInserts = []
  for (let i = 0; i < 80; i++) {
    const t = mentionTemplates[i % mentionTemplates.length]
    mentionInserts.push({
      brand_id: brandId, content: t.c, author_handle: handles[i % handles.length],
      platform: t.p, sentiment_label: t.s,
      reach: Math.round(400 + Math.random() * 6000),
      created_at: tsAgo(Math.floor(Math.random() * 180), 8+Math.floor(Math.random()*12)),
    })
  }
  await sb.from('mentions').insert(mentionInserts)

  /* ── 12. Social posts ─────────────────────────────────────────────────── */
  const postInserts = []
  for (let i = 0; i < 30; i++) {
    const imp = Math.round(50000 + Math.random() * 350000)
    postInserts.push({
      brand_id: brandId, platform: ['instagram','twitter','linkedin'][i % 3],
      post_type: ['image','video','carousel'][i % 3],
      impressions: imp, reach: Math.round(imp*0.70), likes: Math.round(imp*0.045),
      comments: Math.round(imp*0.006), shares: Math.round(imp*0.010),
      posted_at: tsAgo(Math.floor(i*5.5), 9+(i%6)),
    })
  }
  await sb.from('social_posts').insert(postInserts)

  /* ── 13. NPS survey + records ─────────────────────────────────────────── */
  const { data: npsS } = await sb.from('surveys').insert({
    brand_id: brandId, name: 'Pinnacle Client NPS Q2 2026', type: 'nps_basic', status: 'active',
    questions: [{ id: 'q1', text: 'How likely are you to recommend Pinnacle Media to a peer?', type: 'nps' }],
  }).select('id').single()
  if (npsS) {
    const dist = [10,10,9,9,9,9,8,8,8,8,8,7,7,7,7,6,6,5,4,3,2,1,1,0,0,
                  10,9,9,9,8,8,8,8,7,7,7,6,6,5,4,3,3,2,1,0,0,0,0,0,0]
    const recs = dist.map((score, i) => ({ brand_id: brandId, survey_id: npsS.id, score, respondent_type: 'client', channel: 'email', submitted_at: tsAgo(i*3, 11) }))
    await sb.from('nps_records').insert(recs)
    await sb.from('survey_responses').insert(recs.map(n => ({ survey_id: npsS.id, quality_flag: 'ok', answers: { q1: n.score }, submitted_at: n.submitted_at })))
  }

  /* ── 14. Cultural resonance + competitive briefings ───────────────────── */
  const crsInserts = []
  for (let w = 0; w < 12; w++) {
    crsInserts.push({
      brand_id: brandId, week_start: dAgo(w*7+7), week_end: dAgo(w*7),
      overall_score: +(62+(12-w)*1.2+Math.sin(w*0.8)*3).toFixed(1),
      trend_alignment: +(58+w*0.9).toFixed(1), language_score: +(72+Math.sin(w*1.1)*5).toFixed(1),
      moment_relevance: +(60+w*0.8).toFixed(1), notes: null,
    })
  }
  await sb.from('cultural_resonance_scores').insert(crsInserts)

  for (let w = 0; w < 4; w++) {
    await sb.from('competitive_briefings').insert({
      brand_id: brandId, week_start: dAgo(w*7+7), week_end: dAgo(w*7),
      summary: `Noah's Ark won a new bank retainer this week. X3M is pitching aggressively on the fintech brief Pinnacle currently holds. Pinnacle's creative output and influencer ROI remain above category average.`,
      competitor_moves: [
        { competitor: "Noah's Ark", action: 'Won new bank retainer (rumoured)', impact: 'medium' },
        { competitor: 'X3M Ideas',  action: 'Aggressive pitching on fintech account', impact: 'high' },
      ],
      recommendations: ['Brief renewal for fintech client in 6 weeks — start conversation now', 'Showcase Pinnacle Abuja expansion in next credentials deck'],
    })
  }

  /* ── 15. Manual metrics ───────────────────────────────────────────────── */
  const today = new Date()
  const mStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  const mEnd   = new Date(today.getFullYear(), today.getMonth()+1, 0).toISOString().split('T')[0]
  try {
    await sb.from('metric_manual').upsert([
      { brand_id: brandId, metric_key: 'monthly_revenue', value: 18500000, currency: 'NGN', period_start: mStart, period_end: mEnd, entered_by: userId, updated_at: new Date().toISOString() },
      { brand_id: brandId, metric_key: 'active_clients',  value: 7,        currency: 'NGN', period_start: mStart, period_end: mEnd, entered_by: userId, updated_at: new Date().toISOString() },
      { brand_id: brandId, metric_key: 'campaign_count',  value: 5,        currency: 'NGN', period_start: mStart, period_end: mEnd, entered_by: userId, updated_at: new Date().toISOString() },
      { brand_id: brandId, metric_key: 'total_ad_spend',  value: 62000000, currency: 'NGN', period_start: mStart, period_end: mEnd, entered_by: userId, updated_at: new Date().toISOString() },
    ], { onConflict: 'brand_id,metric_key,period_start' })
  } catch (_) { /* metric_manual may not exist in all environments */ }

  return NextResponse.json({
    success: true,
    credentials: { email: DEMO_EMAIL, password: DEMO_PASSWORD, note: 'Login at /auth/login' },
    brand: 'Pinnacle Media Group', workspace: 'Pinnacle Media (Pro plan)',
    seeded: { sentimentDays: 365, bhiSnapshots: 180, sovSnapshots: 26, campaigns: 5, events: 3, influencers: 8, mentions: 80, socialPosts: 30, npsRecords: 50, metricManual: 4 },
  })
}
