import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'

/* ─────────────────────────────────────────────────────────────────────────────
   Demo account: PocketPay — Nigerian fintech (payments + savings app)
   Story arc: solid start → Oct 2025 PR crisis (viral support tweet) →
              Nov 2025 PocketPay Cares recovery → Q1 2026 referral viral growth
              → Apr 2026 Series A announcement peak → settled growth
───────────────────────────────────────────────────────────────────────────── */

const DEMO_EMAIL    = 'demo@pocketpay.brandpulse.ai'
const DEMO_PASSWORD = 'Demo@PocketPay2026!'
const SEED_SECRET   = 'seed-pocketpay-demo-2026'
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
  if      (d >= 270) base = 71
  else if (d >= 230) base = 71 - (d - 230) / 40 * 29
  else if (d >= 180) base = 42 + (230 - d) / 50 * 27
  else if (d >= 100) base = 69 + (180 - d) / 80 * 10
  else if (d >= 40)  base = 79 + (100 - d) / 60 * 2
  else               base = 81 - (40 - d) * 0.07
  const noise = Math.sin(d * 1.9) * 2.3 + Math.cos(d * 0.8) * 1.6
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
      user_metadata: { name: 'Chioma Adeyemi', role: 'Growth Lead' },
    })
    if (authErr || !created?.user) return NextResponse.json({ error: authErr?.message ?? 'User creation failed' }, { status: 500 })
    userId = created.user.id
  }

  /* ── 2. Workspace ─────────────────────────────────────────────────────── */
  const { data: ws, error: wsErr } = await sb.from('workspaces').insert({
    name: 'PocketPay', plan: 'pro', type: 'brand', industry: 'Fintech', base_currency: 'NGN',
  }).select('id').single()
  if (wsErr) return NextResponse.json({ error: wsErr.message }, { status: 500 })
  const wsId = ws.id
  await sb.from('workspace_members').insert({ workspace_id: wsId, user_id: userId, role: 'owner' })

  /* ── 3. Brand ─────────────────────────────────────────────────────────── */
  const { data: brand, error: brandErr } = await sb.from('brands').insert({
    workspace_id:    wsId,
    name:            'PocketPay',
    category:        'Fintech',
    industry:        'fintech',
    primary_color:   '#6C3FE8',
    secondary_color: '#F0A500',
    market_share_pct: 8.4,
    brand_values:    ['Financial Inclusion', 'Speed', 'Trust', 'Simplicity'],
    cultural_profile: { community_corporate: 35, traditional_modern: 70, religious_secular: 40, mass_premium: 55, local_global: 60 },
    target_segments: [
      { name: 'Lagos Gen Z',    age_range: '18-28', income: 'low-middle', location: 'Lagos'    },
      { name: 'SME Owners',     age_range: '25-45', income: 'middle',     location: 'National' },
      { name: 'Students',       age_range: '16-24', income: 'low',        location: 'National' },
    ],
    brand_voice: { tone: 'energetic, trustworthy, plain-speaking', personality: 'The savvy friend who always knows how to move money faster', language_mix: { english: 55, pidgin: 35, yoruba: 5, igbo: 5 } },
    bhi_weights:  { awareness: 0.20, consideration: 0.15, preference: 0.20, advocacy: 0.15, nps: 0.15, sentiment: 0.10, sov: 0.05 },
  }).select('id').single()
  if (brandErr) return NextResponse.json({ error: brandErr.message }, { status: 500 })
  const brandId = brand.id

  /* ── 4. Competitors ───────────────────────────────────────────────────── */
  await sb.from('competitors').insert([
    { brand_id: brandId, name: 'OPay',        social_handles: { instagram: '@opay_ng', twitter: '@OPay_NG'    }, website_url: 'https://opay.com' },
    { brand_id: brandId, name: 'PalmPay',     social_handles: { instagram: '@palmpay',  twitter: '@PalmPayNG'  }, website_url: 'https://palmpay.com' },
    { brand_id: brandId, name: 'Kuda Bank',   social_handles: { instagram: '@kudabank',  twitter: '@KudaBank'  }, website_url: 'https://kuda.com' },
    { brand_id: brandId, name: 'Moniepoint',  social_handles: { twitter: '@Moniepoint'  }, website_url: 'https://moniepoint.com' },
    { brand_id: brandId, name: 'Carbon',      social_handles: { twitter: '@getcarbon_co' }, website_url: 'https://getcarbon.co' },
  ])

  /* ── 5. Campaigns ─────────────────────────────────────────────────────── */
  const { data: camp1 } = await sb.from('campaigns').insert({
    brand_id: brandId, name: 'PocketPay Cares',
    description: 'Brand trust recovery campaign after Oct 2025 support crisis. Influencer + digital.',
    objective: 'brand_awareness', status: 'completed',
    start_date: dAgo(210), end_date: dAgo(160), total_budget: 12_000_000, currency: 'NGN',
    ai_summary: 'PocketPay Cares reversed the Oct crisis within 6 weeks. Sentiment recovered from 42 to 69. Customer service influencer content drove 4.2M impressions. Trust score +18pts.',
  }).select('id').single()

  const { data: camp2 } = await sb.from('campaigns').insert({
    brand_id: brandId, name: 'Refer & Earn',
    description: 'Viral referral programme driving app downloads and first transactions.',
    objective: 'acquisition', status: 'active',
    start_date: dAgo(45), end_date: dAgo(-45), total_budget: 18_000_000, currency: 'NGN',
    ai_summary: null,
  }).select('id').single()

  const { data: camp3 } = await sb.from('campaigns').insert({
    brand_id: brandId, name: 'Series A Announcement',
    description: 'PR and digital push around $8M Series A close. TechCabal + influencer amplification.',
    objective: 'brand_awareness', status: 'completed',
    start_date: dAgo(55), end_date: dAgo(35), total_budget: 35_000_000, currency: 'NGN',
    ai_summary: 'Series A announcement generated 9.2M impressions. BrandPulse tracked 340 earned media mentions in 72 hours. Organic social overtook paid 2:1.',
  }).select('id').single()

  await sb.from('campaigns').insert({
    brand_id: brandId, name: 'Campus Banking Tour',
    description: 'On-ground events at Lagos, Ibadan and Abuja universities.',
    objective: 'acquisition', status: 'planned',
    start_date: dAgo(-14), end_date: dAgo(-74), total_budget: 9_000_000, currency: 'NGN',
  })

  const camp1Id = camp1?.id
  const camp2Id = camp2?.id
  const camp3Id = camp3?.id

  if (camp1Id) await sb.from('campaign_channels').insert([
    { campaign_id: camp1Id, channel: 'digital',    budget_allocation: 8_000_000, notes: 'Meta + YouTube pre-rolls' },
    { campaign_id: camp1Id, channel: 'influencer', budget_allocation: 4_000_000, notes: '12 micro-influencers' },
  ])
  if (camp2Id) await sb.from('campaign_channels').insert([
    { campaign_id: camp2Id, channel: 'digital', budget_allocation: 14_000_000, notes: 'Meta + Google UAC' },
    { campaign_id: camp2Id, channel: 'influencer', budget_allocation: 4_000_000 },
  ])
  if (camp3Id) await sb.from('campaign_channels').insert([
    { campaign_id: camp3Id, channel: 'digital', budget_allocation: 25_000_000 },
    { campaign_id: camp3Id, channel: 'pr',      budget_allocation: 10_000_000, notes: 'TechCabal + Nairametrics' },
  ])

  /* ── 6. Sentiment daily — 365 days ───────────────────────────────────── */
  const sentRows = []
  for (let d = 364; d >= 0; d--) {
    const score = sentScore(d)
    const pos   = +(Math.min(94, score * 0.83 + 5 + Math.sin(d * 0.7) * 3)).toFixed(1)
    const neg   = +(Math.max(2, 100 - pos - (16 + Math.cos(d * 0.5) * 4))).toFixed(1)
    const neu   = +(Math.max(1, 100 - pos - neg)).toFixed(1)
    const themes = d >= 230 && d <= 200
      ? ['slow support', 'failed transactions', 'account freeze', 'customer service']
      : score > 72
      ? ['fast transfers', 'interest rates', 'referral bonus', 'app design', 'financial freedom']
      : ['app speed', 'transaction limits', 'savings features', 'OPay comparison']
    sentRows.push({
      brand_id: brandId, day: dAgo(d),
      social_score: score, offline_score: +(score * 0.90 + Math.sin(d) * 2).toFixed(1),
      blended_score: score,
      positive_pct: pos, neutral_pct: neu, negative_pct: neg,
      top_themes: themes,
      emotion_distribution: { joy: +(pos * 0.58).toFixed(1), trust: +(pos * 0.30).toFixed(1), anticipation: +(pos * 0.12).toFixed(1), sadness: +(neg * 0.40).toFixed(1), anger: +(neg * 0.38).toFixed(1), fear: +(neg * 0.22).toFixed(1) },
    })
  }
  await sb.from('sentiment_daily').insert(sentRows)

  /* ── 7. BHI snapshots — 180 days ─────────────────────────────────────── */
  const bhiRows = []
  for (let d = 179; d >= 0; d--) {
    const ss = sentScore(d); const t = ss / 100
    const comps = {
      awareness: +(50 + t * 38).toFixed(1), consideration: +(40 + t * 40).toFixed(1),
      preference: +(32 + t * 44).toFixed(1), advocacy: +(28 + t * 48).toFixed(1),
      nps: +(30 + t * 46).toFixed(1), sentiment: ss, sov: +(22 + t * 22).toFixed(1),
    }
    const bhiVal = +(comps.awareness*0.20 + comps.consideration*0.15 + comps.preference*0.20 + comps.advocacy*0.15 + comps.nps*0.15 + comps.sentiment*0.10 + comps.sov*0.05).toFixed(1)
    bhiRows.push({ brand_id: brandId, snapshot_date: dAgo(d), bhi: bhiVal, components: comps, data_coverage_pct: +(80 + Math.sin(d * 0.3) * 8).toFixed(1) })
  }
  await sb.from('brand_health_snapshots').insert(bhiRows)

  /* ── 8. SOV snapshots ─────────────────────────────────────────────────── */
  const sovRows = []
  for (let d = 175; d >= 0; d -= 7) {
    const ss = sentScore(d); const t = ss / 100
    sovRows.push({
      brand_id: brandId, snapshot_date: dAgo(d),
      social_sov: +(9 + t * 9 + Math.sin(d * 0.2) * 1.2).toFixed(1),
      paid_sov:   +(8 + t * 8).toFixed(1),
      blended_sov: +(10 + t * 8).toFixed(1),
      esov: +((10 + t * 8) - 8.4).toFixed(2),
      competitor_data: { brand_volume: Math.round(5000 + t * 3000), competitor_volumes: { 'OPay': Math.round(12000 - t * 1000), 'PalmPay': Math.round(8000 - t * 500) } },
    })
  }
  await sb.from('sov_snapshots').insert(sovRows)

  /* ── 9. Events ────────────────────────────────────────────────────────── */
  const { data: evt1 } = await sb.from('events').insert({
    brand_id: brandId, name: 'PocketPay Lagos Social Mixer',
    city: 'Lagos', status: 'closed', activation_type: 'brand_activation', day: dAgo(30),
    target_interactions: 80, campaign_id: camp2Id ?? null,
  }).select('id').single()

  const { data: evt2 } = await sb.from('events').insert({
    brand_id: brandId, name: 'PocketPay x TechCabal Demo Day',
    city: 'Lagos', status: 'closed', activation_type: 'brand_activation', day: dAgo(10),
    target_interactions: 60, campaign_id: camp3Id ?? null,
  }).select('id').single()

  const evt1Id = evt1?.id
  const evt2Id = evt2?.id

  /* Event 1 ambassadors */
  const ambNames1 = ['Chidi Eze', 'Amina Bello', 'Tunde Okonkwo']
  const amb1Ids: string[] = []
  for (const n of ambNames1) {
    const { data: a } = await sb.from('ambassadors').insert({ brand_id: brandId, event_id: evt1Id, name: n, status: 'active', phone: '+234801000' + Math.floor(Math.random()*9000+1000) }).select('id').single()
    if (a) amb1Ids.push(a.id)
  }

  const types1 = ['new_lead','engaged','new_customer','photo','new_lead','engaged','new_lead','new_customer','engaged','photo']
  if (evt1Id) {
    const ints1 = []
    for (const aId of amb1Ids) {
      for (let i = 0; i < 25; i++) {
        ints1.push({ event_id: evt1Id, ambassador_id: aId, brand_id: brandId, interaction_type: types1[i % types1.length], occurred_at: tsAgo(30, 10 + (i % 8)) })
      }
    }
    await sb.from('event_interactions').insert(ints1)
    await sb.from('event_roi_reports').insert({ event_id: evt1Id, brand_id: brandId, narrative: 'The Lagos Social Mixer generated 75 qualified leads and 18 new customer activations. Average CPA was ₦4,200 against a ₦6,500 benchmark. Photo activations drove 340 organic shares.', ambassador_breakdown: ambNames1.map((n, i) => ({ name: n, leads: 8, customers: 6, interactions: 25 })) })
  }

  /* Event 2 ambassadors */
  const ambNames2 = ['Blessing Okafor', 'Emeka Nwosu', 'Fatima Sule']
  const amb2Ids: string[] = []
  for (const n of ambNames2) {
    const { data: a } = await sb.from('ambassadors').insert({ brand_id: brandId, event_id: evt2Id, name: n, status: 'active', phone: '+234802000' + Math.floor(Math.random()*9000+1000) }).select('id').single()
    if (a) amb2Ids.push(a.id)
  }

  if (evt2Id) {
    const ints2 = []
    for (const aId of amb2Ids) {
      for (let i = 0; i < 20; i++) {
        ints2.push({ event_id: evt2Id, ambassador_id: aId, brand_id: brandId, interaction_type: types1[i % types1.length], occurred_at: tsAgo(10, 9 + (i % 9)) })
      }
    }
    await sb.from('event_interactions').insert(ints2)
    await sb.from('event_roi_reports').insert({ event_id: evt2Id, brand_id: brandId, narrative: 'TechCabal Demo Day attracted 60 senior tech professionals. 22 signed up for the enterprise API tier on the spot. Coverage in TechCabal and Techpoint generated 1.2M impressions.', ambassador_breakdown: ambNames2.map(n => ({ name: n, leads: 7, customers: 5, interactions: 20 })) })
  }

  /* ── 10. Influencers ──────────────────────────────────────────────────── */
  const influencerData = [
    { name: 'Kemi Adeleke',   handle: '@kemi.fintech',    platform: 'instagram', followers: 2800000, engagement_rate: 0.042, niche: 'personal finance' },
    { name: 'Dara Balogun',   handle: '@darabalogun',     platform: 'tiktok',    followers: 1500000, engagement_rate: 0.071, niche: 'lifestyle and money' },
    { name: 'Emeka Okafor',   handle: '@EmekaMoneyNG',    platform: 'twitter',   followers: 890000,  engagement_rate: 0.038, niche: 'fintech commentary' },
    { name: 'Ngozi Adekunle', handle: '@ngozi.ng',        platform: 'instagram', followers: 420000,  engagement_rate: 0.055, niche: 'women in finance' },
    { name: 'Seun Adesanya',  handle: '@SeunStartup',     platform: 'twitter',   followers: 180000,  engagement_rate: 0.048, niche: 'startup and tech' },
    { name: 'Blessing Eze',   handle: '@blessingstyle',   platform: 'instagram', followers: 95000,   engagement_rate: 0.082, niche: 'student lifestyle' },
    { name: 'Tunde Fashola',  handle: '@tundefash',       platform: 'twitter',   followers: 42000,   engagement_rate: 0.065, niche: 'SME owner' },
    { name: 'Chidinma Okeke', handle: '@chidinma.saves',  platform: 'tiktok',    followers: 28000,   engagement_rate: 0.095, niche: 'savings tips' },
  ]

  for (const inf of influencerData) {
    const { data: infRow } = await sb.from('influencers').insert({
      brand_id: brandId, name: inf.name, handle: inf.handle, platform: inf.platform,
      followers: inf.followers, engagement_rate: inf.engagement_rate, niche: inf.niche,
      status: 'active', location: 'Lagos, Nigeria',
    }).select('id').single()
    if (!infRow) continue
    const cId = inf.followers > 500000 ? camp1Id : camp2Id
    await sb.from('influencer_campaigns').insert([
      { brand_id: brandId, influencer_id: infRow.id, campaign_id: cId, platform: inf.platform, content_type: 'post', agreed_rate: Math.round(inf.followers * 0.015), actual_reach: Math.round(inf.followers * 0.45), engagement_rate: inf.engagement_rate, status: 'completed', started_at: tsAgo(150), ended_at: tsAgo(120) },
      { brand_id: brandId, influencer_id: infRow.id, campaign_id: camp2Id ?? null, platform: inf.platform, content_type: 'reel', agreed_rate: Math.round(inf.followers * 0.022), actual_reach: Math.round(inf.followers * 0.52), engagement_rate: inf.engagement_rate * 1.3, status: 'active', started_at: tsAgo(40), ended_at: null },
    ])
  }

  /* ── 11. Social mentions ──────────────────────────────────────────────── */
  const mentionTemplates = [
    { c: 'Finally sent money in 3 seconds with PocketPay. OPay who?', s: 'positive', p: 'twitter' },
    { c: 'PocketPay referral just hit 7 friends. Stack that bonus!', s: 'positive', p: 'twitter' },
    { c: 'Series A confirmed! PocketPay is about to go crazy', s: 'positive', p: 'twitter' },
    { c: 'PocketPay savings rate just dropped again. Starting to compare options', s: 'negative', p: 'twitter' },
    { c: 'Customer service has been on point since the Cares campaign ngl', s: 'positive', p: 'instagram' },
    { c: 'PocketPay or Kuda? Drop your verdict below', s: 'neutral', p: 'twitter' },
    { c: 'My PocketPay account got frozen for no reason, been 3 days now', s: 'negative', p: 'twitter' },
    { c: '5% interest on savings via PocketPay. Not bad for a wallet app', s: 'positive', p: 'instagram' },
    { c: 'PocketPay UI is genuinely the cleanest fintech app in Nigeria', s: 'positive', p: 'twitter' },
    { c: 'Transaction failed but money already left. Support ghosting me', s: 'negative', p: 'twitter' },
    { c: 'PocketPay referral programme is printing for real', s: 'positive', p: 'twitter' },
    { c: 'Just downloaded PocketPay after the TechCabal piece. Legit impressed', s: 'positive', p: 'instagram' },
    { c: 'PocketPay for bills, Kuda for savings, Moniepoint for POS. My fintech stack', s: 'neutral', p: 'twitter' },
    { c: 'The new PocketPay app update is so smooth', s: 'positive', p: 'instagram' },
    { c: 'PocketPay customer care response time has actually improved a lot', s: 'positive', p: 'twitter' },
  ]

  const handles = ['@adaeze_ng','@kunle_fintech','@temi_saves','@ify_wealthng','@chidex','@mosunola','@dayo_tech','@nnamdi_biz','@sola_vc','@aisha_invests','@biodun_ng','@obinna_startup','@ngozi_money','@jide_hustle','@funmi_growth']
  const mentionInserts = []
  for (let i = 0; i < 75; i++) {
    const t = mentionTemplates[i % mentionTemplates.length]
    const daysBack = i < 15 ? 220 + Math.floor(Math.random() * 20) : Math.floor(Math.random() * 180)
    mentionInserts.push({
      brand_id: brandId, content: t.c, author_handle: handles[i % handles.length],
      platform: t.p, sentiment_label: t.s,
      reach: Math.round(500 + Math.random() * 8000),
      created_at: tsAgo(daysBack, 8 + Math.floor(Math.random() * 12)),
    })
  }
  await sb.from('mentions').insert(mentionInserts)

  /* ── 12. Social posts ─────────────────────────────────────────────────── */
  const postInserts = []
  for (let i = 0; i < 30; i++) {
    const d = Math.floor(i * 5.5)
    const imp = Math.round(80000 + Math.random() * 1120000)
    postInserts.push({
      brand_id: brandId, platform: ['instagram','twitter','tiktok'][i % 3],
      post_type: ['image','video','story'][i % 3],
      impressions: imp, reach: Math.round(imp * 0.65), likes: Math.round(imp * 0.04),
      comments: Math.round(imp * 0.005), shares: Math.round(imp * 0.008),
      posted_at: tsAgo(d, 9 + (i % 6)),
    })
  }
  await sb.from('social_posts').insert(postInserts)

  /* ── 13. NPS survey + records ─────────────────────────────────────────── */
  const { data: npsS } = await sb.from('surveys').insert({
    brand_id: brandId, name: 'PocketPay NPS Q2 2026', type: 'nps_basic', status: 'active',
    questions: [{ id: 'q1', text: 'How likely are you to recommend PocketPay to a friend?', type: 'nps' }],
  }).select('id').single()

  if (npsS) {
    const npsScores = []
    // Distribution for NPS ~68: promoters heavy
    const dist = [10,10,10,10,9,9,9,9,8,8,8,8,8,7,7,7,7,7,7,6,5,5,4,3,2,1,0,0,0,0,
                  10,10,10,10,9,9,9,8,8,8,7,7,7,7,6,5,5,4,3,2,1,0,0,0,0,0,0,0,0,0]
    for (let i = 0; i < 60; i++) {
      npsScores.push({
        brand_id: brandId, survey_id: npsS.id,
        score: dist[i] ?? 7, respondent_type: 'customer',
        channel: ['in_app','email'][i % 2],
        submitted_at: tsAgo(Math.floor(i * 2.5), 11),
      })
    }
    await sb.from('nps_records').insert(npsScores)
    await sb.from('survey_responses').insert(npsScores.map((n,i) => ({
      survey_id: npsS.id, quality_flag: 'ok',
      answers: { q1: n.score },
      submitted_at: n.submitted_at,
    })))
  }

  /* ── 14. Cultural resonance scores ───────────────────────────────────── */
  const crsInserts = []
  for (let w = 0; w < 10; w++) {
    crsInserts.push({
      brand_id: brandId, week_start: dAgo(w * 7 + 7), week_end: dAgo(w * 7),
      overall_score: +(60 + (10 - w) * 1.5 + Math.sin(w * 0.8) * 3).toFixed(1),
      trend_alignment: +(55 + w * 1.2).toFixed(1),
      language_score:  +(70 + Math.sin(w * 1.1) * 5).toFixed(1),
      moment_relevance: +(58 + w * 0.9).toFixed(1),
      notes: w === 0 ? 'Series A hype boosting cultural relevance across Gen Z segments' : null,
    })
  }
  await sb.from('cultural_resonance_scores').insert(crsInserts)

  /* ── 15. Competitive briefings ────────────────────────────────────────── */
  for (let w = 0; w < 4; w++) {
    await sb.from('competitive_briefings').insert({
      brand_id: brandId, week_start: dAgo(w * 7 + 7), week_end: dAgo(w * 7),
      summary: `OPay ran heavy bus-stop OOH in Lagos this week. PalmPay launched a 0% fee promo targeting PocketPay's referral users. PocketPay's engagement rate remains 1.4x category average.`,
      competitor_moves: [
        { competitor: 'OPay',    action: 'Billboard takeover in Lagos bus stops', impact: 'medium' },
        { competitor: 'PalmPay', action: '0% transfer fee promotion (7 days)',   impact: 'high'   },
      ],
      recommendations: ['Accelerate Refer & Earn push to counter PalmPay promo', 'Match OPay OOH with digital geo-targeting in same locations'],
    })
  }

  /* ── 16. Manual metrics ───────────────────────────────────────────────── */
  const today = new Date()
  const mStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  const mEnd   = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]
  try {
    await sb.from('metric_manual').upsert([
      { brand_id: brandId, metric_key: 'mau',           value: 650000, currency: 'NGN', period_start: mStart, period_end: mEnd, entered_by: userId, updated_at: new Date().toISOString() },
      { brand_id: brandId, metric_key: 'dau',           value: 210000, currency: 'NGN', period_start: mStart, period_end: mEnd, entered_by: userId, updated_at: new Date().toISOString() },
      { brand_id: brandId, metric_key: 'downloads_mtd', value: 45000,  currency: 'NGN', period_start: mStart, period_end: mEnd, entered_by: userId, updated_at: new Date().toISOString() },
      { brand_id: brandId, metric_key: 'cac',           value: 2800,   currency: 'NGN', period_start: mStart, period_end: mEnd, entered_by: userId, updated_at: new Date().toISOString() },
      { brand_id: brandId, metric_key: 'arpu',          value: 1450,   currency: 'NGN', period_start: mStart, period_end: mEnd, entered_by: userId, updated_at: new Date().toISOString() },
      { brand_id: brandId, metric_key: 'churn_rate',    value: 0.042,  currency: 'NGN', period_start: mStart, period_end: mEnd, entered_by: userId, updated_at: new Date().toISOString() },
      { brand_id: brandId, metric_key: 'referral_rate', value: 0.18,   currency: 'NGN', period_start: mStart, period_end: mEnd, entered_by: userId, updated_at: new Date().toISOString() },
      { brand_id: brandId, metric_key: 'nps_score',     value: 68,     currency: 'NGN', period_start: mStart, period_end: mEnd, entered_by: userId, updated_at: new Date().toISOString() },
    ], { onConflict: 'brand_id,metric_key,period_start' })
  } catch (_) { /* metric_manual may not exist in all environments */ }

  return NextResponse.json({
    success: true,
    credentials: { email: DEMO_EMAIL, password: DEMO_PASSWORD, note: 'Login at /auth/login' },
    brand: 'PocketPay', workspace: 'PocketPay (Pro plan)',
    seeded: { sentimentDays: 365, bhiSnapshots: 180, sovSnapshots: 26, campaigns: 4, events: 2, influencers: 8, mentions: 75, socialPosts: 30, npsRecords: 60, metricManual: 8 },
  })
}
