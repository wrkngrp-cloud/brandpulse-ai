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
  const brandRow = {
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
  }
  let { data: brand, error: brandErr } = await sb.from('brands').insert(brandRow).select('id').single()
  if (brandErr?.message.includes('industry')) {
    // PostgREST schema cache can lag a migration — retry without the
    // column rather than failing the whole seed; back-fillable later.
    const { industry: _industry, ...withoutIndustry } = brandRow
    const retry = await sb.from('brands').insert(withoutIndustry).select('id').single()
    brand = retry.data; brandErr = retry.error
  }
  if (brandErr || !brand) return NextResponse.json({ error: brandErr?.message ?? 'Brand creation failed' }, { status: 500 })
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

  /* ── 16. Funnel snapshots — monthly, 12 months ────────────────────────── */
  const pmFunnelRows = []
  for (let m = 11; m >= 0; m--) {
    const d  = m * 30
    const ss = sentScore(d)
    const t  = ss / 100
    pmFunnelRows.push({
      brand_id: brandId, snapshot_date: dAgo(d), segment: 'all',
      awareness:     +(48 + t * 38).toFixed(1),
      consideration: +(38 + t * 40).toFixed(1),
      preference:    +(30 + t * 42).toFixed(1),
      action:        +(20 + t * 30).toFixed(1),
      loyalty:       +(24 + t * 36).toFixed(1),
      advocacy:      +(15 + t * 26).toFixed(1),
      dropoffs: {
        awareness_to_consideration:  +(32 - t * 12).toFixed(1),
        consideration_to_preference: +(26 - t * 10).toFixed(1),
        preference_to_action:        +(38 - t * 10).toFixed(1),
      },
    })
  }
  await sb.from('funnel_snapshots').insert(pmFunnelRows)

  /* ── 17. Competitor sightings ──────────────────────────────────────────── */
  await sb.from('competitor_sightings').insert([
    { brand_id: brandId, competitor_name: "Noah's Ark Communications", lat: 6.4550, lng: 3.3841, sighting_type: 'billboard',  city: 'Lagos', state: 'Lagos', spotted_at: dAgo(16), description: "Noah's Ark billboard credit line spotted on a new bank retainer's Lekki campaign — first visible proof of the rumoured bank account win." },
    { brand_id: brandId, competitor_name: 'X3M Ideas',                 lat: 9.0765, lng: 7.3986, sighting_type: 'activation', city: 'Abuja', state: 'FCT',   spotted_at: dAgo(24), description: 'X3M Ideas ran a telco activation at Wuse Market — aggressive footprint as they pitch for the fintech account currently on our roster.' },
    { brand_id: brandId, competitor_name: 'DDB Lagos',                 lat: 6.4281, lng: 3.4219, sighting_type: 'activation', city: 'Lagos', state: 'Lagos', spotted_at: dAgo(35), description: 'DDB Lagos credentials deck circulating among our FMCG client contacts ahead of the Q3 renewal conversation — worth a pre-emptive check-in.' },
    { brand_id: brandId, competitor_name: 'Insight BBDO',              lat: 6.6018, lng: 3.3515, sighting_type: 'billboard',  city: 'Lagos', state: 'Lagos', spotted_at: dAgo(9),  description: 'Insight BBDO OOH creative for a new beverage client at Oshodi — strong production value but generic "premium" positioning, no cultural anchor.' },
  ])

  /* ── 18. Press mentions (PR tracking) ─────────────────────────────────── */
  const pmPress = [
    { headline: 'Pinnacle Media Group Opens Abuja Office, Signals National Ambitions',       publication: 'BusinessDay',  url: 'https://businessday.ng/pinnacle-abuja-office',        pub_date: dAgo(60),  sent_score: 0.82, sent_label: 'positive', reach: 110_000, emv:   605_000, is_comp: false, comp: null,        snippet: 'Lagos agency Pinnacle Media Group has opened a permanent Abuja office, part of a broader push to serve government-adjacent and northern FMCG clients.' },
    { headline: 'Pinnacle Media Wins Two New FMCG Retainers in Q1',                          publication: 'Marketing Edge', url: 'https://marketingedge.com.ng/pinnacle-fmcg-retainers', pub_date: dAgo(75),  sent_score: 0.88, sent_label: 'positive', reach: 40_000,  emv:   220_000, is_comp: false, comp: null,        snippet: 'Pinnacle Media Group has added two FMCG retainer accounts to its roster this quarter, continuing a run of new business wins into 2026.' },
    { headline: "Noah's Ark Communications Rumoured to Have Won Major Bank Retainer",         publication: 'Marketing Edge', url: 'https://marketingedge.com.ng/noahs-ark-bank-retainer',  pub_date: dAgo(18),  sent_score: 0.10, sent_label: 'neutral',  reach: 35_000,  emv:   -17_500, is_comp: true,  comp: "Noah's Ark", snippet: "Industry sources suggest Noah's Ark Communications has secured a major banking client retainer, a segment where Pinnacle Media has been actively pitching." },
    { headline: 'Pinnacle Media Delivers Bridger CRM Launch Campaign',                        publication: 'Techpoint Africa', url: 'https://techpoint.africa/pinnacle-bridger-launch',    pub_date: dAgo(128), sent_score: 0.75, sent_label: 'positive', reach: 60_000,  emv:   330_000, is_comp: false, comp: null,        snippet: "Pinnacle Media's PR and content strategy for Bridger CRM's launch placed the B2B SaaS brand in TechCabal, Techpoint, and Nairametrics within its first month." },
    { headline: 'X3M Ideas Pitching Aggressively for Fintech Accounts, Sources Say',           publication: 'Marketing Edge', url: 'https://marketingedge.com.ng/x3m-fintech-pitching',    pub_date: dAgo(10),  sent_score: 0.02, sent_label: 'neutral',  reach: 30_000,  emv:    -6_000, is_comp: true,  comp: 'X3M Ideas', snippet: 'X3M Ideas has reportedly intensified pitching activity in the fintech category, an account type where Pinnacle Media currently holds a key retainer.' },
    { headline: 'Pinnacle Media Group Named Among Nigeria\'s Fastest-Growing Agencies',        publication: 'The Guardian',  url: 'https://guardian.ng/pinnacle-fastest-growing-agencies', pub_date: dAgo(45),  sent_score: 0.90, sent_label: 'positive', reach: 95_000,  emv:   522_500, is_comp: false, comp: null,        snippet: "An industry ranking placed Pinnacle Media Group among Nigeria's fastest-growing marketing agencies by client roster growth over the past 18 months." },
  ]
  await sb.from('press_mentions').insert(pmPress.map(m => ({
    brand_id: brandId, headline: m.headline, publication: m.publication, url: m.url,
    published_at: m.pub_date, sentiment_score: m.sent_score, sentiment_label: m.sent_label,
    estimated_reach: m.reach, emv: m.emv, mention_type: 'press' as const,
    is_competitor: m.is_comp, competitor_name: m.comp, raw_snippet: m.snippet, crawl_source: 'manual',
  })))

  /* ── 19. Creative analyses ────────────────────────────────────────────── */
  await sb.from('creative_analyses').insert([
    {
      brand_id: brandId, analysis_type: 'compare',
      input_data: { platform: 'instagram', creativeA: 'Surulere sampling activation recap reel', creativeB: 'Q2 FMCG Sprint static product ad' },
      result: {
        winner: 'A',
        why_winner: 'The activation recap scores well ahead on engagement and cultural resonance (89 vs 70) — real crowd footage and ambassador energy sell "proof of execution" far better than a polished static ad, which is the exact thing prospective clients want to see in Pinnacle\'s own feed.',
        creative_a: { engagement: 89, cultural_resonance: 86, brand_fit: 84, tone: 88, clarity: 80, risk: 10, summary: 'Strong social proof asset for new-business pitches. Trim the intro by 3 seconds — the crowd shot should hit within the first 2 seconds, not the fifth.' },
        creative_b: { engagement: 66, cultural_resonance: 60, brand_fit: 72, tone: 65, clarity: 88, risk: 18, summary: 'Fine as client-facing deliverable proof but weak for Pinnacle\'s own channel — no agency personality visible in a client product ad.' },
      },
      created_at: tsAgo(50, 11),
    },
    {
      brand_id: brandId, analysis_type: 'identity',
      input_data: { captions: ['Pinnacle just delivered the best integrated campaign this quarter — and we are not done yet.', 'Creativity plus cultural intelligence plus results. That is the Pinnacle formula.', 'We do not just brief influencers. We build relationships that outlast the campaign.', 'Abuja, we are here. New office, same standard.'], brandValues: ['Creativity', 'Results', 'Cultural Intelligence', 'Transparency'] },
      result: {
        consistency_score: 82,
        strengths: ['Confident, declarative tone holds consistently across all four captions', '"Cultural intelligence" language appears verbatim, reinforcing the differentiator rather than diluting it', 'Short punchy sentence structure matches the "confident, creative, results-focused" voice'],
        drift_warnings: ['"Transparency" as a stated brand value is not represented in any of the four captions — a gap worth addressing in the next content batch', 'Caption 3 shifts to a warmer, relationship-led register that is a slight departure from the results-first tone of the others'],
        adjustments: ['Add one transparency-themed post per month — e.g. sharing a real campaign metric, including one that did not hit target', 'Keep the "formula" framing from caption 2 as a recurring content template — it performs the strongest identity signal of the four'],
      },
      created_at: tsAgo(20, 14),
    },
    {
      brand_id: brandId, analysis_type: 'competitor',
      input_data: { competitorName: 'Insight BBDO', content: 'Insight BBDO. Global network. Local expertise. Award-winning creative for Nigeria\'s biggest brands.' },
      result: {
        tone: 'Institutional / Credential-led',
        cultural_fit: 58,
        engagement_potential: 50,
        strategic_insights: ['"Global network, local expertise" is a credentials claim, not a proof point — no specific campaign or result is referenced', '"Award-winning" is asserted without naming the award, which undercuts credibility with a sophisticated marketing audience', 'The messaging speaks to procurement committees, not to the creative energy that wins pitches with founder-led brands'],
        counter_positions: ['Pinnacle should keep leading with named results and specific numbers rather than institutional credentials — this is where Pinnacle already differentiates', 'Target founder-led and challenger brands where "global network" reads as slow rather than credible', 'Use real campaign case studies as the primary new-business content format instead of positioning statements'],
      },
      created_at: tsAgo(8, 9),
    },
  ])

  /* ── 20. Pre-post analyses ────────────────────────────────────────────── */
  await sb.from('pre_post_analyses').insert([
    {
      brand_id: brandId, created_by: userId,
      content_text: 'New business alert: Pinnacle Media is now managing 7 active client retainers across FMCG, fintech, and B2B SaaS. Growth mode activated.',
      platform: 'linkedin', target_segment: 'FMCG Brands', funnel_goal: 'preference',
      engagement_score: 80, cultural_score: 74, tone_score: 82, clarity_score: 88, risk_score: 10,
      risk_flags: [],
      verdict: 'Approve',
      improvements: ['Name at least one client win by category if permitted, for concreteness', 'Pair with a short client testimonial quote for added credibility'],
      suggested_rewrite: null,
    },
    {
      brand_id: brandId, created_by: userId,
      content_text: "Noah's Ark and X3M can keep chasing us. We are already three campaigns ahead. 😏",
      platform: 'twitter', target_segment: 'Fintech Clients', funnel_goal: 'preference',
      engagement_score: 52, cultural_score: 40, tone_score: 24, clarity_score: 70, risk_score: 74,
      risk_flags: [{ type: 'brand_risk', detail: 'Naming competitor agencies directly and mocking them is unprofessional and risks alienating shared client relationships in a small industry' }, { type: 'tone_risk', detail: 'Dismissive tone contradicts the "confident, creative, results-focused" voice — confidence should come from proof, not put-downs' }],
      verdict: 'Reject — do not publish',
      improvements: ['Never name competitor agencies in public posts — the Lagos and Abuja ad industry is small and this creates unnecessary friction', 'Replace with a specific result: a campaign metric or client win'],
      suggested_rewrite: 'Three integrated campaigns delivered this quarter, two new retainers signed. That is what results-first creative looks like.',
    },
    {
      brand_id: brandId, created_by: userId,
      content_text: 'From Lagos to Abuja: Pinnacle Media is now serving clients nationally. Same team, same standard, bigger reach.',
      platform: 'instagram', target_segment: 'Telco Accounts', funnel_goal: 'awareness',
      engagement_score: 78, cultural_score: 80, tone_score: 84, clarity_score: 86, risk_score: 8,
      risk_flags: [],
      verdict: 'Approve — strong cultural fit',
      improvements: ['Add a photo from the Abuja office opening for visual proof', 'Tag the Abuja team members for organic reach into their networks'],
      suggested_rewrite: null,
    },
  ])

  /* ── 21. Crawl runs ────────────────────────────────────────────────────── */
  await sb.from('crawl_runs').insert(
    Array.from({ length: 10 }, (_, i) => ({
      brand_id:       brandId,
      trigger_type:   i % 3 === 0 ? 'manual' : 'cron',
      status:         'done',
      mentions_found: 17 + Math.round(Math.abs(Math.sin(i * 1.35)) * 19),
      classified:     15 + Math.round(Math.abs(Math.sin(i * 1.35)) * 16),
      started_at:     tsAgo(i * 3, 6),
      completed_at:   tsAgo(i * 3, 6),
    }))
  )

  /* ── 22. AI conversation sample ────────────────────────────────────────── */
  await sb.from('ai_conversations').insert({
    brand_id: brandId, user_id: userId,
    messages: [
      { role: 'user', content: "Why is X3M pitching so aggressively for our fintech account?", timestamp: tsAgo(9) },
      { role: 'assistant', content: "Two signals point to timing, not just opportunism:\n\n**1. Renewal window visibility.** Your fintech retainer is roughly 6 weeks from its natural renewal conversation. Agencies typically intensify pitching 4-8 weeks ahead of a known or estimated renewal date, and X3M's activity started right at that window.\n\n**2. Category momentum.** X3M has no fintech logo on its public roster right now. Winning a fintech account, even a smaller one, gives them a credential they currently lack entirely — the strategic value to them is higher than the account's fee alone would suggest.\n\nThe defensible move is to start the renewal conversation now rather than waiting for the client to raise it, and to bring a credentials refresh that leads with the fintech-specific results you already have.", timestamp: tsAgo(9) },
      { role: 'user', content: 'Should we be worried about losing the FMCG client to DDB Lagos?', timestamp: tsAgo(30) },
      { role: 'assistant', content: 'Moderate risk, manageable with the right move. DDB\'s credentials deck circulating among your client contacts is a classic pre-renewal signal, but it is a deck, not a signed deal — no visible campaign work has appeared yet, which usually takes 6-10 weeks to materialise after a pitch win.\n\nThe highest-leverage response is proactive, not reactive: schedule a mid-quarter results review with the client before DDB gets a formal pitch slot. Clients rarely switch agencies mid-flight when the current agency is visibly ahead of schedule on results — use the Q2 FMCG Sprint numbers to make that case now.', timestamp: tsAgo(30) },
    ],
    sources_cited: [
      { type: 'competitor_sightings', period: 'Last 60 days', rows: 4 },
      { type: 'press_mentions',       keyword: 'X3M Ideas fintech', count: 1 },
    ],
  })

  /* ── 23. Budget plan + line items + actuals (Q2 FMCG Sprint) ──────────── */
  const { data: pmBudget } = await sb.from('budget_plans').insert({
    brand_id: brandId, name: 'Q2 FMCG Sprint — Client Budget',
    period_start: dAgo(30), period_end: dAgo(-60),
    total_budget: 22_000_000, currency: 'NGN',
    status: 'active', notes: 'Managed on behalf of two FMCG retainer clients. OOH + digital weighted toward Lagos.',
    created_by: userId,
  }).select('id').single()

  if (pmBudget?.id) {
    const { data: pmLi1 } = await sb.from('budget_line_items').insert({ brand_id: brandId, plan_id: pmBudget.id, channel: 'digital', label: 'Meta + Google — client media buy', planned_amount: 12_000_000, actual_amount: 7_940_000, currency: 'NGN', campaign_id: camp1Id }).select('id').single()
    const { data: pmLi2 } = await sb.from('budget_line_items').insert({ brand_id: brandId, plan_id: pmBudget.id, channel: 'ooh',     label: 'Lagos billboards — 3 sites',     planned_amount: 10_000_000, actual_amount: 6_200_000, currency: 'NGN', campaign_id: camp1Id }).select('id').single()

    const pmActuals = [
      { li: pmLi1?.id, amount: 3_970_000, desc: 'Meta media buy — Month 1', ref: 'META-PM-101', spent_on: dAgo(24) },
      { li: pmLi1?.id, amount: 3_970_000, desc: 'Google Display — Month 1', ref: 'GGL-PM-102',  spent_on: dAgo(10) },
      { li: pmLi2?.id, amount: 6_200_000, desc: 'Lagos billboard bookings — Lekki, Ikeja, Surulere', ref: 'OOH-PM-201', spent_on: dAgo(28) },
    ]
    for (const a of pmActuals) {
      if (!a.li) continue
      await sb.from('budget_actuals').insert({ brand_id: brandId, line_item_id: a.li, amount: a.amount, currency: 'NGN', description: a.desc, reference: a.ref, spent_on: a.spent_on, created_by: userId })
    }
  }

  /* ── 24. Geo-Lift study (Q2 FMCG Sprint OOH) ───────────────────────────── */
  const pmMakeWeekly = (weeks: number, baseT: number, baseC: number, liftPct: number) =>
    Array.from({ length: weeks }, (_, i) => ({
      week: dAgo((weeks - i) * 7),
      treatment_index: Math.round(baseT + (liftPct * i / weeks) * baseT * 0.01 + Math.sin(i * 0.9) * 2),
      control_index:   Math.round(baseC + Math.sin(i * 1.1) * 1.5),
    }))
  await sb.from('geo_lift_studies').insert({
    brand_id: brandId, campaign_id: camp1Id,
    treatment_city: 'Lagos', control_city: 'Ibadan', keyword: 'FMCG client brand name',
    study_start: dAgo(30), study_end: dAgo(-60),
    lift_pct: 9.6, confidence: 79.8, correlation: 0.7610, status: 'running',
    weekly_data: pmMakeWeekly(4, 48, 40, 9.6),
    ai_interpretation: 'Early signal from the Q2 FMCG Sprint OOH placements: +9.6% branded search uplift in Lagos versus the Ibadan control after four weeks. Confidence still building toward the 90% threshold — recommend reporting this alongside the digital media results in the next client review.',
  })

  /* ── 25. A/B Experiments ───────────────────────────────────────────────── */
  const { data: pmExp1 } = await sb.from('ab_experiments').insert({
    brand_id: brandId, name: 'New Business Pitch Email Subject Line',
    hypothesis: 'A subject line referencing a specific result ("22% sales uplift in 6 weeks") will out-perform a generic capability statement for cold outreach to prospective clients',
    experiment_type: 'email', metric_primary: 'open_rate', metrics_secondary: ['reply_rate'],
    status: 'concluded', confidence_target: 90, min_sample_size: 150,
    started_at: tsAgo(50), concluded_at: tsAgo(30),
  }).select('id').single()

  const { data: pmExp2 } = await sb.from('ab_experiments').insert({
    brand_id: brandId, name: 'Agency LinkedIn Post Format',
    hypothesis: 'Case-study carousels will drive more profile visits from prospective clients than single-image announcement posts',
    experiment_type: 'creative', metric_primary: 'click_through_rate',
    status: 'running', confidence_target: 90, min_sample_size: 100,
    started_at: tsAgo(15),
  }).select('id').single()

  if (pmExp1?.id) {
    await sb.from('ab_variants').insert({ brand_id: brandId, experiment_id: pmExp1.id, name: 'Control — Capability Statement', is_control: true, impressions: 320, conversions: 42, revenue: 0, sort_order: 1, content: { subject: 'Full-service marketing partnership for your brand' } })
    const { data: pmV1v } = await sb.from('ab_variants').insert({ brand_id: brandId, experiment_id: pmExp1.id, name: 'Variant — Named Result', is_control: false, impressions: 315, conversions: 71, revenue: 0, sort_order: 2, content: { subject: 'How we drove a 22% sales uplift in 6 weeks' } }).select('id').single()
    if (pmV1v?.id) await sb.from('ab_experiments').update({ winner_variant_id: pmV1v.id }).eq('id', pmExp1.id)
  }
  if (pmExp2?.id) {
    await sb.from('ab_variants').insert({ brand_id: brandId, experiment_id: pmExp2.id, name: 'Control — Single Image Announcement', is_control: true, impressions: 4_200, conversions: 88, revenue: 0, sort_order: 1, content: { format: 'single_image' } })
    await sb.from('ab_variants').insert({ brand_id: brandId, experiment_id: pmExp2.id, name: 'Variant — Case Study Carousel',       is_control: false, impressions: 4_150, conversions: 146, revenue: 0, sort_order: 2, content: { format: 'carousel' } })
  }

  /* ── 26. Advocacy scores (weekly for 12 weeks) ────────────────────────── */
  const pmAdvocacyRows = Array.from({ length: 12 }, (_, i) => {
    const w = 11 - i
    const ss = sentScore(w * 7)
    const vol = Math.round(14 + i * 2.0 + Math.sin(i * 0.7) * 2.5)
    const posVol = Math.round(vol * (0.58 + (ss / 100) * 0.20))
    const negVol = Math.round(vol * (0.10 - (ss / 100) * 0.03))
    const neuVol = vol - posVol - negVol
    const reach = Math.round(vol * (1800 + i * 110))
    const engagement = Math.round(reach * 0.05)
    const sentRatio = posVol / vol
    const volScore = Math.min(100, (vol / 36) * 100)
    const reachScore = Math.min(100, (reach / 65_000) * 100)
    const engmtScore = Math.min(100, (engagement / 3_200) * 100)
    const score = (sentRatio * 40) + ((volScore * 0.5 + reachScore * 0.5) * 0.4) + (engmtScore * 0.2)
    return {
      brand_id: brandId, week_start: dAgo(w * 7 + 6),
      ugc_mentions: vol, positive_mentions: posVol, neutral_mentions: neuVol, negative_mentions: negVol,
      avg_sentiment: +ss.toFixed(2), total_reach: reach, total_engagement: engagement,
      top_platforms: { twitter: Math.round(vol * 0.55), instagram: Math.round(vol * 0.30), linkedin: Math.round(vol * 0.15) },
      top_themes: ss > 65 ? ['campaign results', 'award wins', 'new retainers'] : ['agency competition', 'fee pressure', 'client retention'],
      advocacy_score: +Math.min(100, score).toFixed(2),
      score_delta: i > 0 ? +(Math.sin(i * 0.5) * 2.4).toFixed(2) : 0,
      score_factors: { sentiment_contribution: +(sentRatio * 40).toFixed(1), volume_contribution: +((volScore * 0.5 + reachScore * 0.5) * 0.4).toFixed(1), engagement_contribution: +(engmtScore * 0.2).toFixed(1) },
    }
  })
  await sb.from('advocacy_scores').insert(pmAdvocacyRows)

  /* ── 27. Promoters + referral codes (client referral network) ─────────── */
  const pmPromoterData = [
    { name: 'Yemi Okoro',     email: 'yemi.okoro@client.example',     phone: '+2348012345101', nps: 10, city: 'Lagos', code: 'BP-PIN01', clicks: 21, conversions: 5 },
    { name: 'Grace Eze',      email: 'grace.eze@client.example',      phone: '+2348023456102', nps: 9,  city: 'Abuja', code: 'BP-PIN02', clicks: 14, conversions: 3 },
    { name: 'Suleiman Bello', email: 'suleiman.bello@client.example', phone: '+2348034567103', nps: 9,  city: 'Lagos', code: 'BP-PIN03', clicks: 11, conversions: 2 },
  ]
  for (const p of pmPromoterData) {
    const { data: pmProm } = await sb.from('promoters').insert({
      brand_id: brandId, name: p.name, email: p.email, phone: p.phone,
      nps_score: p.nps, source: 'nps', status: 'active',
    }).select('id').single()
    if (pmProm?.id) {
      await sb.from('referral_codes').insert({
        brand_id: brandId, promoter_id: pmProm.id, code: p.code,
        destination_url: 'https://pinnaclemedia.ng/credentials',
        clicks: p.clicks, conversions: p.conversions, is_active: true,
      })
    }
  }

  /* ── 28. Creative assets (Creative Library vault) ─────────────────────── */
  const pmCreativeAssets = [
    { title: 'Pinnacle Credentials Deck — 2026', description: '18-page agency credentials deck: case studies, client logos, team bios, and results by category. Primary new-business tool.', asset_type: 'copy', format: 'Pitch Deck', platform: 'PDF', status: 'vetted', fit_for_ads: false, performance: { impressions: 4_200 }, replication_elements: ['Lead with results, not agency history', 'Named client results only — no vague claims', 'Keep under 20 pages — prospects skim, they do not read'], tags: ['pitch', 'credentials', 'new-business'] },
    { title: 'Surulere Sampling Activation Recap Reel', description: '45-second recap of the FMCG client Easter sampling activation: crowd energy, ambassador interactions, product handoffs.', asset_type: 'video', format: 'Reel', platform: 'Instagram', status: 'vetted', fit_for_ads: false, performance: { impressions: 89_000, clicks: 3_200 }, replication_elements: ['Crowd shot in the first 2 seconds, not the fifth', 'Real ambassador voices over polished narration', 'Use as proof-of-execution content for future pitches'], tags: ['activation', 'recap', 'proof-of-work'] },
    { title: 'PocketPay Influencer Brief Template', description: 'Standardised creator brief format used across the PocketPay Refer & Earn influencer drive: messaging pillars, do/dont list, deliverables.', asset_type: 'copy', format: 'Brief', platform: 'Instagram', status: 'active', fit_for_ads: false, performance: { impressions: 18_400 }, replication_elements: ['One page maximum — creators skip long briefs', 'Let creators keep their natural voice', 'Clear deliverable count and deadline up front'], tags: ['influencer', 'brief', 'template'] },
    { title: 'Q2 FMCG Sprint — Client Results One-Pager', description: 'Single-page client report: campaign reach, spend efficiency, and sentiment lift, formatted for a board-level audience.', asset_type: 'copy', format: 'One-Pager', platform: 'PDF', status: 'vetted', fit_for_ads: false, performance: { impressions: 6 }, replication_elements: ['Three numbers maximum on the page', 'Lead with the number the client cares about most, not the one that flatters the agency', 'One-pager format forces prioritisation — resist the urge to add a second page'], tags: ['reporting', 'client-facing', 'template'] },
  ]
  for (const asset of pmCreativeAssets) {
    await sb.from('creative_assets').insert({ brand_id: brandId, ...asset })
  }

  return NextResponse.json({
    success: true,
    credentials: { email: DEMO_EMAIL, password: DEMO_PASSWORD, note: 'Login at /auth/login' },
    brand: 'Pinnacle Media Group', workspace: 'Pinnacle Media (Pro plan)',
    seeded: {
      sentimentDays: 365, bhiSnapshots: 180, sovSnapshots: 26, campaigns: 5, events: 3, influencers: 8,
      mentions: 80, socialPosts: 30, npsRecords: 50, metricManual: 4, funnelSnapshots: 12,
      competitorSightings: 4, pressMentions: pmPress.length, creativeAnalyses: 3, prePostAnalyses: 3,
      crawlRuns: 10, geoLiftStudies: 1, abExperiments: 2, advocacyWeeks: 12, promoters: 3,
      creativeAssets: pmCreativeAssets.length,
    },
  })
}
