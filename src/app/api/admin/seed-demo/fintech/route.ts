import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'

/* ─────────────────────────────────────────────────────────────────────────────
   Demo account: PocketPay — Nigerian fintech (payments + savings app)
   Story arc: solid start → Oct 2025 PR crisis (viral support tweet) →
              Nov 2025 PocketPay Cares recovery → Q1 2026 referral viral growth
              → Apr 2026 Series A announcement peak → settled growth
───────────────────────────────────────────────────────────────────────────── */

const DEMO_EMAIL    = 'demo@pocketpay.brandgauge.app'
const DEMO_PASSWORD = 'Demo@PocketPay2026!'
// Gated by the shared ADMIN_SECRET env var (fail closed if unset).
const SEED_SECRET   = process.env.ADMIN_SECRET
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
  if (!SEED_SECRET || req.headers.get('x-seed-secret') !== SEED_SECRET)
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
  const brandRow = {
    workspace_id:    wsId,
    name:            'PocketPay',
    category:        'Fintech',
    industry:        'fintech',
    brand_type:      'fintech',
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
    objective: 'awareness', status: 'completed',
    start_date: dAgo(210), end_date: dAgo(160), total_budget: 12_000_000, currency: 'NGN',
    ai_summary: 'PocketPay Cares reversed the Oct crisis within 6 weeks. Sentiment recovered from 42 to 69. Customer service influencer content drove 4.2M impressions. Trust score +18pts.',
  }).select('id').single()

  const { data: camp2 } = await sb.from('campaigns').insert({
    brand_id: brandId, name: 'Refer & Earn',
    description: 'Viral referral programme driving app downloads and first transactions.',
    objective: 'conversion', status: 'active',
    start_date: dAgo(45), end_date: dAgo(-45), total_budget: 18_000_000, currency: 'NGN',
    ai_summary: null,
  }).select('id').single()

  const { data: camp3 } = await sb.from('campaigns').insert({
    brand_id: brandId, name: 'Series A Announcement',
    description: 'PR and digital push around $8M Series A close. TechCabal + influencer amplification.',
    objective: 'awareness', status: 'completed',
    start_date: dAgo(55), end_date: dAgo(35), total_budget: 35_000_000, currency: 'NGN',
    ai_summary: 'Series A announcement generated 9.2M impressions. BrandGauge tracked 340 earned media mentions in 72 hours. Organic social overtook paid 2:1.',
  }).select('id').single()

  await sb.from('campaigns').insert({
    brand_id: brandId, name: 'Campus Banking Tour',
    description: 'On-ground events at Lagos, Ibadan and Abuja universities.',
    objective: 'conversion', status: 'planned',
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

  /* ── 16. Manual metrics — 6 months of history, oldest first ───────────── */
  // Canonical commercial keys: total_spend, new_customers, cac (explicit
  // override), arpu, churn_rate. Series follow the PocketPay arc: referral
  // viral growth through Q1 2026 → Series A peak → settled growth. The last
  // value in each series is the current month.
  const today = new Date()
  const monthBounds = (monthsAgo: number) => ({
    start: new Date(today.getFullYear(), today.getMonth() - monthsAgo, 1).toISOString().split('T')[0],
    end:   new Date(today.getFullYear(), today.getMonth() - monthsAgo + 1, 0).toISOString().split('T')[0],
  })

  const pocketPaySeries: Record<string, number[]> = {
    mau:             [480000, 515000, 555000, 600000, 630000, 650000],
    dau:             [150000, 163000, 178000, 194000, 203000, 210000],
    downloads_mtd:   [30000, 34000, 39000, 47000, 44000, 45000],
    total_spend:     [22_000_000, 26_000_000, 30_000_000, 36_000_000, 40_000_000, 38_000_000],
    revenue_monthly: [88_000_000, 98_000_000, 112_000_000, 128_000_000, 148_000_000, 152_000_000],
    new_customers:   [8200, 10400, 12800, 15200, 14000, 14500],
    mql_count:       [11500, 14500, 18000, 21000, 19500, 20000],
    cac:             [2680, 2500, 2340, 2370, 2860, 2800],
    arpu:            [1300, 1340, 1380, 1400, 1430, 1450],
    churn_rate:      [0.058, 0.054, 0.049, 0.046, 0.044, 0.042],
    referral_rate:   [0.11, 0.13, 0.15, 0.17, 0.175, 0.18],
    nps_score:       [61, 62, 64, 66, 67, 68],
  }

  try {
    const metricRows = []
    for (const [key, series] of Object.entries(pocketPaySeries)) {
      for (let i = 0; i < series.length; i++) {
        const { start, end } = monthBounds(series.length - 1 - i)
        metricRows.push({
          brand_id: brandId, metric_key: key, value: series[i], currency: 'NGN',
          period_start: start, period_end: end, entered_by: userId, updated_at: new Date().toISOString(),
        })
      }
    }
    await sb.from('metric_manual').upsert(metricRows, { onConflict: 'brand_id,metric_key,period_start' })
  } catch (_) { /* metric_manual may not exist in all environments */ }

  /* ── 17. Funnel snapshots — monthly, 12 months ────────────────────────── */
  const funnelRows = []
  for (let m = 11; m >= 0; m--) {
    const d  = m * 30
    const ss = sentScore(d)
    const t  = ss / 100
    funnelRows.push({
      brand_id: brandId, snapshot_date: dAgo(d), segment: 'all',
      awareness:     +(55 + t * 30).toFixed(1),
      consideration: +(40 + t * 32).toFixed(1),
      preference:    +(28 + t * 34).toFixed(1),
      action:        +(20 + t * 30).toFixed(1),
      loyalty:       +(22 + t * 28).toFixed(1),
      advocacy:      +(16 + t * 24).toFixed(1),
      dropoffs: {
        awareness_to_consideration:  +(34 - t * 14).toFixed(1),
        consideration_to_preference: +(28 - t * 10).toFixed(1),
        preference_to_action:        +(40 - t * 12).toFixed(1),
      },
    })
  }
  await sb.from('funnel_snapshots').insert(funnelRows)

  /* ── 18. Competitor sightings ──────────────────────────────────────────── */
  await sb.from('competitor_sightings').insert([
    { brand_id: brandId, competitor_name: 'OPay',       lat: 6.4698, lng: 3.5852, sighting_type: 'billboard',  city: 'Lagos', state: 'Lagos', spotted_at: dAgo(14), description: 'OPay bus-stop takeover at Lekki Toll Gate. "Everyone Loves OPay" creative, orange branding at four consecutive stops.' },
    { brand_id: brandId, competitor_name: 'PalmPay',     lat: 6.5244, lng: 3.3792, sighting_type: 'activation', city: 'Lagos', state: 'Lagos', spotted_at: dAgo(9),  description: 'PalmPay agent recruitment drive at Computer Village, offering signing bonuses above market rate to build POS agent density.' },
    { brand_id: brandId, competitor_name: 'Moniepoint',  lat: 9.0579, lng: 7.4898, sighting_type: 'billboard',  city: 'Abuja', state: 'FCT',   spotted_at: dAgo(21), description: 'Moniepoint highway billboard on Airport Road targeting SME owners with a "Your Business Deserves Better Banking" message.' },
    { brand_id: brandId, competitor_name: 'Kuda Bank',   lat: 6.4281, lng: 3.4219, sighting_type: 'activation', city: 'Lagos', state: 'Lagos', spotted_at: dAgo(5),  description: 'Kuda-sponsored Twitter Spaces series targeting Gen Z creators, three back-to-back sessions on money moves with 8k+ live listeners each.' },
    { brand_id: brandId, competitor_name: 'OPay',        lat: 6.6018, lng: 3.3515, sighting_type: 'activation', city: 'Lagos', state: 'Lagos', spotted_at: dAgo(2),  description: 'OPay campus activation at UNILAG offering free data bundles for new sign-ups, directly overlapping with our Campus Banking Tour target window.' },
  ])

  /* ── 19. Press mentions (PR tracking) ─────────────────────────────────── */
  const ppPress = [
    { headline: 'PocketPay Users Report Delayed Transfers, Frozen Accounts',                       publication: 'The Punch',        url: 'https://punchng.com/pocketpay-transfer-delays',        pub_date: dAgo(230), sent_score: -0.58, sent_label: 'negative', reach: 210_000, emv:  -840_000, is_comp: false, comp: null,      snippet: 'Multiple PocketPay users have taken to Twitter to complain of delayed transfers and unexplained account freezes over the past week, with some reporting locked funds for over 72 hours.' },
    { headline: 'PocketPay Launches "PocketPay Cares" After Social Media Backlash',                 publication: 'Nairametrics',     url: 'https://nairametrics.com/pocketpay-cares-launch',       pub_date: dAgo(205), sent_score: 0.35,  sent_label: 'neutral',  reach: 140_000, emv:   210_000, is_comp: false, comp: null,      snippet: 'PocketPay has announced a dedicated customer support initiative and public apology following a wave of complaints about transaction failures and support response times.' },
    { headline: 'PocketPay Sentiment Rebounds as Cares Campaign Lands with Users',                  publication: 'TechCabal',        url: 'https://techcabal.com/pocketpay-cares-recovery',        pub_date: dAgo(165), sent_score: 0.78,  sent_label: 'positive', reach: 180_000, emv:   990_000, is_comp: false, comp: null,      snippet: 'PocketPay appears to have turned a corner after its October crisis, with independent brand tracking showing sentiment recovering from the low 40s back into the high 60s within six weeks.' },
    { headline: 'Nigerian Fintechs Race for Series A as Investor Appetite Returns',                 publication: 'BusinessDay',      url: 'https://businessday.ng/fintech-series-a-2026',          pub_date: dAgo(48),  sent_score: 0.05,  sent_label: 'neutral',  reach: 95_000,  emv:    47_500, is_comp: false, comp: null,      snippet: 'A wave of Nigerian payment startups including PocketPay are closing fresh funding rounds as investor confidence in the sector recovers after a slow 2025.' },
    { headline: 'PocketPay Closes $8M Series A Led by Pan-African Fund',                            publication: 'TechCabal',        url: 'https://techcabal.com/pocketpay-series-a-close',        pub_date: dAgo(50),  sent_score: 0.91,  sent_label: 'positive', reach: 260_000, emv: 1_430_000, is_comp: false, comp: null,      snippet: 'PocketPay has closed an $8M Series A round to expand its savings and payments product, with plans to double its Lagos engineering team and launch a merchant offering.' },
    { headline: 'OPay Reports Record Transaction Volumes in Q1',                                    publication: 'TechCabal',        url: 'https://techcabal.com/opay-q1-transaction-volumes',     pub_date: dAgo(60),  sent_score: 0.40,  sent_label: 'neutral',  reach: 220_000, emv:   -88_000, is_comp: true,  comp: 'OPay',    snippet: 'OPay says it processed a record volume of transactions in the first quarter, citing continued growth in its agent banking network across Nigeria.' },
    { headline: 'PocketPay Refer & Earn Programme Drives Viral Download Growth',                    publication: 'Techpoint Africa', url: 'https://techpoint.africa/pocketpay-refer-earn-growth',  pub_date: dAgo(35),  sent_score: 0.86,  sent_label: 'positive', reach: 110_000, emv:   605_000, is_comp: false, comp: null,      snippet: 'PocketPay\'s referral incentive scheme has become one of the most-shared fintech promotions on Nigerian Twitter this quarter, driving a sharp uptick in app downloads.' },
    { headline: 'Moniepoint Raises Fresh Funding at Unicorn Valuation',                              publication: 'TechCabal',        url: 'https://techcabal.com/moniepoint-unicorn-round',        pub_date: dAgo(40),  sent_score: 0.55,  sent_label: 'neutral',  reach: 240_000, emv:  -120_000, is_comp: true,  comp: 'Moniepoint', snippet: 'Moniepoint has confirmed a new funding round that values the payments infrastructure company above $1 billion, cementing its position among Africa\'s best-funded fintechs.' },
    { headline: 'Regulators Tighten KYC Rules for Nigerian Payment Apps',                            publication: 'BusinessDay',      url: 'https://businessday.ng/cbn-kyc-payment-apps',           pub_date: dAgo(80),  sent_score: 0.02,  sent_label: 'neutral',  reach: 130_000, emv:     2_600, is_comp: false, comp: null,      snippet: 'The Central Bank of Nigeria has issued updated know-your-customer requirements for licensed payment service providers, with a 90-day compliance window.' },
    { headline: 'How PocketPay Used Real-Time Brand Tracking to Navigate Its PR Crisis',             publication: 'Techpoint Africa', url: 'https://techpoint.africa/pocketpay-brand-tracking-crisis', pub_date: dAgo(140), sent_score: 0.83, sent_label: 'positive', reach: 90_000,  emv:   495_000, is_comp: false, comp: null,      snippet: 'PocketPay\'s growth lead shared how daily sentiment and share-of-voice tracking shaped the messaging and channel choices behind the PocketPay Cares recovery campaign.' },
    { headline: 'PalmPay Launches Zero-Fee Transfer Promo Targeting Rival Users',                    publication: 'Nairametrics',     url: 'https://nairametrics.com/palmpay-zero-fee-promo',        pub_date: dAgo(20),  sent_score: 0.15,  sent_label: 'neutral',  reach: 150_000, emv:   -45_000, is_comp: true,  comp: 'PalmPay', snippet: 'PalmPay has introduced a week-long zero-fee transfer promotion explicitly aimed at users of competing wallet apps, including PocketPay and Kuda.' },
    { headline: 'PocketPay Campus Banking Tour to Visit 12 Nigerian Universities',                   publication: 'Vanguard',         url: 'https://vanguardngr.com/pocketpay-campus-tour',          pub_date: dAgo(6),   sent_score: 0.72,  sent_label: 'positive', reach: 100_000, emv:   550_000, is_comp: false, comp: null,      snippet: 'PocketPay has announced a nationwide campus tour to onboard student users, offering on-the-spot account opening and referral bonuses at each stop.' },
  ]
  await sb.from('press_mentions').insert(ppPress.map(m => ({
    brand_id: brandId, headline: m.headline, publication: m.publication, url: m.url,
    published_at: m.pub_date, sentiment_score: m.sent_score, sentiment_label: m.sent_label,
    estimated_reach: m.reach, emv: m.emv, mention_type: 'press' as const,
    is_competitor: m.is_comp, competitor_name: m.comp, raw_snippet: m.snippet, crawl_source: 'manual',
  })))

  /* ── 20. Creative analyses ────────────────────────────────────────────── */
  await sb.from('creative_analyses').insert([
    {
      brand_id: brandId, analysis_type: 'compare',
      input_data: { platform: 'instagram', creativeA: 'PocketPay Cares support-team testimonial video — 30s', creativeB: 'Refer & Earn static banner — feed image' },
      result: {
        winner: 'A',
        why_winner: 'The testimonial video scores far higher on trust rebuild (91 vs 68) — real support agents speaking directly to the crisis lands as accountability rather than a marketing message.',
        creative_a: { engagement: 84, cultural_resonance: 79, brand_fit: 88, tone: 91, clarity: 83, risk: 8,  summary: 'Authentic, low-risk trust repair asset. CTA card at the end is easy to miss — increase its on-screen duration to 4 seconds.' },
        creative_b: { engagement: 76, cultural_resonance: 62, brand_fit: 70, tone: 66, clarity: 88, risk: 22, summary: 'Clear offer communication but generic wallet-app aesthetic. Works for acquisition, not for the trust-rebuild objective it is currently paired against.' },
      },
      created_at: tsAgo(180, 11),
    },
    {
      brand_id: brandId, analysis_type: 'identity',
      input_data: { captions: ['Money moves faster with PocketPay. Try it today.', 'We hear you. We are fixing it. Every complaint gets a human response now.', 'Refer 3 friends, get ₦3,000. It really is that simple.', 'Series A closed. This is just the beginning for PocketPay.'], brandValues: ['Financial Inclusion', 'Speed', 'Trust', 'Simplicity'] },
      result: {
        consistency_score: 79,
        strengths: ['Plain-speaking tone holds across all four captions — no jargon, no corporate hedging', 'Caption 2 is the strongest trust-repair moment: direct, accountable, human', 'Caption 3 nails "Simplicity" with a concrete number and outcome'],
        drift_warnings: ['Caption 4 leans investor-facing rather than user-facing — check whether Series A content belongs on the consumer feed at all', 'Pidgin is part of the declared voice (35% language mix) but absent from all four captions — a missed cultural-fit opportunity', 'Exclamation-free tone across captions 1 and 3 reads slightly flat for an "energetic" brand voice'],
        adjustments: ['Route investor-news content to a separate LinkedIn/press channel, not the main consumer feed', 'Test a Pidgin variant of caption 3: "Refer 3 friends, collect ₦3,000. E simple like that."', 'Add a stronger verb to caption 1: "Money moves fast. PocketPay moves faster." '],
      },
      created_at: tsAgo(90, 14),
    },
    {
      brand_id: brandId, analysis_type: 'competitor',
      input_data: { competitorName: 'OPay', content: 'Everyone Loves OPay. Send money, pay bills, save more — all in one app. Download now.' },
      result: {
        tone: 'Mass-market / Reassuring',
        cultural_fit: 74,
        engagement_potential: 68,
        strategic_insights: ['"Everyone Loves" is a broad social-proof claim with no specific number or story behind it — an assertion, not evidence', 'The feature-list format (send, pay, save) reads as a utility app pitch rather than a brand with a point of view', 'OPay\'s scale advantage in agent banking is not represented in this creative — the message under-leverages their actual strength'],
        counter_positions: ['PocketPay should lead with speed and a concrete number ("3 seconds", "₦3,000 for 3 referrals") rather than a vague social-proof claim', 'Own the "we fix things fast" trust narrative that OPay has not claimed — PocketPay Cares is a genuine differentiator here', 'Lean into Gen Z and SME-specific messaging where OPay\'s creative is deliberately generic'],
      },
      created_at: tsAgo(40, 9),
    },
  ])

  /* ── 21. Pre-post analyses ────────────────────────────────────────────── */
  await sb.from('pre_post_analyses').insert([
    {
      brand_id: brandId, created_by: userId,
      content_text: 'Series A confirmed. $8M to build the fastest wallet in Nigeria. This is just the start. 🚀',
      platform: 'twitter', target_segment: 'Lagos Gen Z', funnel_goal: 'advocacy',
      engagement_score: 88, cultural_score: 80, tone_score: 85, clarity_score: 90, risk_score: 10,
      risk_flags: [],
      verdict: 'Approve',
      improvements: ['Tag the lead investor to extend reach into their network', 'Follow up with a thread explaining what the funding unlocks for users, not just the company'],
      suggested_rewrite: null,
    },
    {
      brand_id: brandId, created_by: userId,
      content_text: 'OPay slow, PocketPay fast. Simple as that. Switch today. 😤',
      platform: 'twitter', target_segment: 'Lagos Gen Z', funnel_goal: 'preference',
      engagement_score: 58, cultural_score: 45, tone_score: 28, clarity_score: 80, risk_score: 68,
      risk_flags: [{ type: 'brand_risk', detail: 'Directly naming and disparaging a competitor invites a public back-and-forth PocketPay does not need mid-recovery' }, { type: 'tone_risk', detail: 'Aggressive framing contradicts the "trustworthy, plain-speaking" brand voice, especially soon after the Cares campaign' }],
      verdict: 'Reject — do not publish',
      improvements: ['Never name competitors directly in consumer-facing posts', 'Let speed claims stand on their own with a number, not a jab', 'Keep the tone consistent with the Cares campaign trust-rebuild work'],
      suggested_rewrite: 'Sent in 3 seconds, not 3 minutes. That is the PocketPay difference. ⚡',
    },
    {
      brand_id: brandId, created_by: userId,
      content_text: 'How body? Refer 3 friends and collect ₦3,000 cash. E simple like that. Tap the link 👇',
      platform: 'instagram', target_segment: 'Students', funnel_goal: 'action',
      engagement_score: 86, cultural_score: 89, tone_score: 87, clarity_score: 84, risk_score: 6,
      risk_flags: [],
      verdict: 'Approve — strong cultural fit',
      improvements: ['Add a short screen-recording of the referral flow to reduce friction', 'Include the referral deadline to add urgency'],
      suggested_rewrite: null,
    },
  ])

  /* ── 22. Crawl runs ────────────────────────────────────────────────────── */
  await sb.from('crawl_runs').insert(
    Array.from({ length: 10 }, (_, i) => ({
      brand_id:       brandId,
      trigger_type:   i % 3 === 0 ? 'manual' : 'cron',
      status:         'done',
      mentions_found: 18 + Math.round(Math.abs(Math.sin(i * 1.4)) * 20),
      classified:     16 + Math.round(Math.abs(Math.sin(i * 1.4)) * 17),
      started_at:     tsAgo(i * 3, 6),
      completed_at:   tsAgo(i * 3, 6),
    }))
  )

  /* ── 23. AI conversation sample ───────────────────────────────────────── */
  await sb.from('ai_conversations').insert({
    brand_id: brandId, user_id: userId,
    messages: [
      { role: 'user', content: 'Why did our sentiment crash in October 2025?', timestamp: tsAgo(200) },
      { role: 'assistant', content: 'The October 2025 crash (69 → 42 over roughly three weeks) traces back to a single viral thread: a user reported a frozen account and a failed transfer that took four days to resolve. Three things amplified it:\n\n**1. Support response time.** Median first-response time that month was 18 hours against a target of under 2. The delay itself became the story, independent of the original transaction issue.\n\n**2. Copycat complaints.** Once the thread passed 10K retweets, dozens of unrelated users piled on with older, smaller complaints — a pile-on effect common in fintech Twitter.\n\n**3. Silence.** PocketPay did not respond publicly for 36 hours. In a trust-sensitive category like payments, silence reads as confirmation.\n\nThe recovery came from PocketPay Cares: public acknowledgement, a visible support-team-led content series, and a published fix timeline. Sentiment moved from 42 to 69 in six weeks.', timestamp: tsAgo(200) },
      { role: 'user', content: 'How do we avoid this happening again now that Series A news is drawing more attention to us?', timestamp: tsAgo(48) },
      { role: 'assistant', content: 'Two things matter most with more eyes on the brand:\n\n**1. Speed of first response, not resolution.** Users forgive slow fixes more easily than slow acknowledgement. A same-day public response, even without a resolution, prevents the pile-on dynamic that hurt you in October.\n\n**2. Keep the trust content flowing, not just growth content.** Series A and Refer & Earn content is acquisition-focused. Without the occasional Cares-style trust post, growth-heavy feeds read as tone-deaf if an incident happens. Recommend one trust or support-spotlight post per two weeks going forward as insurance.', timestamp: tsAgo(48) },
    ],
    sources_cited: [
      { type: 'sentiment_daily', period: 'Oct 2025', rows: 30 },
      { type: 'mentions',        keyword: 'PocketPay account frozen', count: 6 },
      { type: 'press_mentions',  period: 'Oct-Dec 2025', rows: 3 },
    ],
  })

  /* ── 24. Budget plan + line items + actuals (Refer & Earn) ────────────── */
  const { data: ppBudget } = await sb.from('budget_plans').insert({
    brand_id: brandId, name: 'PocketPay Refer & Earn — Q2 2026',
    period_start: dAgo(45), period_end: dAgo(-45),
    total_budget: 18_000_000, currency: 'NGN',
    status: 'active', notes: 'Viral referral push. Digital-heavy with influencer seeding.',
    created_by: userId,
  }).select('id').single()

  if (ppBudget?.id) {
    const { data: ppLi1 } = await sb.from('budget_line_items').insert({ brand_id: brandId, plan_id: ppBudget.id, channel: 'digital',    label: 'Meta + Google UAC',            planned_amount: 10_000_000, actual_amount: 6_240_000, currency: 'NGN', campaign_id: camp2Id }).select('id').single()
    const { data: ppLi2 } = await sb.from('budget_line_items').insert({ brand_id: brandId, plan_id: ppBudget.id, channel: 'influencer', label: 'Micro + mid-tier fintech creators', planned_amount: 4_000_000,  actual_amount: 3_800_000, currency: 'NGN', campaign_id: camp2Id }).select('id').single()
    const { data: ppLi3 } = await sb.from('budget_line_items').insert({ brand_id: brandId, plan_id: ppBudget.id, channel: 'pr',         label: 'TechCabal + Techpoint referral coverage', planned_amount: 2_000_000, actual_amount: 2_000_000, currency: 'NGN' }).select('id').single()
    const { data: ppLi4 } = await sb.from('budget_line_items').insert({ brand_id: brandId, plan_id: ppBudget.id, channel: 'production', label: 'Referral flow creative + push copy', planned_amount: 2_000_000, actual_amount: 1_180_000, currency: 'NGN' }).select('id').single()

    const ppActuals = [
      { li: ppLi1?.id, amount: 3_120_000, desc: 'Meta UAC — Week 1-2',       ref: 'META-PP-101', spent_on: dAgo(40) },
      { li: ppLi1?.id, amount: 3_120_000, desc: 'Google UAC — Week 3-4',      ref: 'GGL-PP-102',  spent_on: dAgo(26) },
      { li: ppLi2?.id, amount: 3_800_000, desc: '8 creator referral drops',   ref: 'INF-PP-201',  spent_on: dAgo(30) },
      { li: ppLi3?.id, amount: 2_000_000, desc: 'TechCabal referral feature', ref: 'PR-PP-301',   spent_on: dAgo(18) },
      { li: ppLi4?.id, amount: 1_180_000, desc: 'Referral landing page + push copy pack', ref: 'PROD-PP-401', spent_on: dAgo(44) },
    ]
    for (const a of ppActuals) {
      if (!a.li) continue
      await sb.from('budget_actuals').insert({ brand_id: brandId, line_item_id: a.li, amount: a.amount, currency: 'NGN', description: a.desc, reference: a.ref, spent_on: a.spent_on, created_by: userId })
    }
  }

  /* ── 25. A/B Experiments ──────────────────────────────────────────────── */
  const { data: ppExp1 } = await sb.from('ab_experiments').insert({
    brand_id: brandId, name: 'Refer & Earn Push Notification Copy',
    hypothesis: 'A specific cash amount in the push copy ("Collect ₦1,000 now") will out-convert a vague benefit statement ("Earn rewards today")',
    experiment_type: 'message', metric_primary: 'click_through_rate', metrics_secondary: ['conversion_rate'],
    status: 'concluded', confidence_target: 95, min_sample_size: 500,
    started_at: tsAgo(38), concluded_at: tsAgo(24),
  }).select('id').single()

  const { data: ppExp2 } = await sb.from('ab_experiments').insert({
    brand_id: brandId, name: 'Referral Banner CTA Test',
    hypothesis: 'A "Get ₦3,000" CTA will drive higher tap-through on the in-app referral banner than a generic "Refer a Friend" CTA',
    experiment_type: 'creative', metric_primary: 'click_through_rate',
    status: 'running', confidence_target: 95, min_sample_size: 400,
    started_at: tsAgo(12),
  }).select('id').single()

  const { data: ppExp3 } = await sb.from('ab_experiments').insert({
    brand_id: brandId, name: 'NPS Survey Greeting Language',
    hypothesis: 'Opening the in-app NPS prompt in Pidgin ("How was your last transfer?") will yield a higher response rate than formal English',
    experiment_type: 'message', metric_primary: 'response_rate',
    status: 'draft', confidence_target: 90, min_sample_size: 200,
  }).select('id').single()

  if (ppExp1?.id) {
    await sb.from('ab_variants').insert({ brand_id: brandId, experiment_id: ppExp1.id, name: 'Control — Earn Rewards Today', is_control: true, impressions: 42_000, conversions: 1_890, revenue: 0, sort_order: 1, content: { message: 'Earn rewards today with PocketPay Refer & Earn' } })
    const { data: ppV1v } = await sb.from('ab_variants').insert({ brand_id: brandId, experiment_id: ppExp1.id, name: 'Variant — Collect ₦1,000 Now', is_control: false, impressions: 41_600, conversions: 2_910, revenue: 0, sort_order: 2, content: { message: 'Collect ₦1,000 now — refer a friend to PocketPay' } }).select('id').single()
    if (ppV1v?.id) await sb.from('ab_experiments').update({ winner_variant_id: ppV1v.id }).eq('id', ppExp1.id)
  }
  if (ppExp2?.id) {
    await sb.from('ab_variants').insert({ brand_id: brandId, experiment_id: ppExp2.id, name: 'Control — Refer a Friend', is_control: true, impressions: 18_200, conversions: 640, revenue: 0, sort_order: 1, content: { cta_text: 'Refer a Friend' } })
    await sb.from('ab_variants').insert({ brand_id: brandId, experiment_id: ppExp2.id, name: 'Variant — Get ₦3,000',    is_control: false, impressions: 18_050, conversions: 910, revenue: 0, sort_order: 2, content: { cta_text: 'Get ₦3,000' } })
  }
  if (ppExp3?.id) {
    await sb.from('ab_variants').insert({ brand_id: brandId, experiment_id: ppExp3.id, name: 'Control — Formal English', is_control: true, impressions: 0, conversions: 0, revenue: 0, sort_order: 1, content: { message: 'How likely are you to recommend PocketPay to a friend?' } })
    await sb.from('ab_variants').insert({ brand_id: brandId, experiment_id: ppExp3.id, name: 'Variant — Pidgin Greeting', is_control: false, impressions: 0, conversions: 0, revenue: 0, sort_order: 2, content: { message: 'How your last transfer take be? Rate us small 🙏' } })
  }

  /* ── 26. Advocacy scores (weekly for 12 weeks) ────────────────────────── */
  const ppAdvocacyRows = Array.from({ length: 12 }, (_, i) => {
    const w = 11 - i
    const ss = sentScore(w * 7)
    const vol = Math.round(24 + i * 3.6 + Math.sin(i * 0.9) * 4)
    const posVol = Math.round(vol * (0.52 + (ss / 100) * 0.22))
    const negVol = Math.round(vol * (0.14 - (ss / 100) * 0.05))
    const neuVol = vol - posVol - negVol
    const reach = Math.round(vol * (2400 + i * 140))
    const engagement = Math.round(reach * 0.048)
    const sentRatio = posVol / vol
    const volScore = Math.min(100, (vol / 60) * 100)
    const reachScore = Math.min(100, (reach / 110_000) * 100)
    const engmtScore = Math.min(100, (engagement / 6_000) * 100)
    const score = (sentRatio * 40) + ((volScore * 0.5 + reachScore * 0.5) * 0.4) + (engmtScore * 0.2)
    return {
      brand_id: brandId, week_start: dAgo(w * 7 + 6),
      ugc_mentions: vol, positive_mentions: posVol, neutral_mentions: neuVol, negative_mentions: negVol,
      avg_sentiment: +ss.toFixed(2), total_reach: reach, total_engagement: engagement,
      top_platforms: { twitter: Math.round(vol * 0.60), instagram: Math.round(vol * 0.30), tiktok: Math.round(vol * 0.10) },
      top_themes: ss > 70 ? ['referral bonus', 'fast transfers', 'Series A pride'] : ['support wait times', 'account freeze', 'OPay comparison'],
      advocacy_score: +Math.min(100, score).toFixed(2),
      score_delta: i > 0 ? +(Math.sin(i * 0.6) * 3.0).toFixed(2) : 0,
      score_factors: { sentiment_contribution: +(sentRatio * 40).toFixed(1), volume_contribution: +((volScore * 0.5 + reachScore * 0.5) * 0.4).toFixed(1), engagement_contribution: +(engmtScore * 0.2).toFixed(1) },
    }
  })
  await sb.from('advocacy_scores').insert(ppAdvocacyRows)

  /* ── 27. Loyalty programme — PocketPay Points ─────────────────────────── */
  const { data: ppLp } = await sb.from('loyalty_programs').insert({
    brand_id: brandId, name: 'PocketPay Points', description: 'Earn points on every transfer, bill payment, and referral. Redeem for airtime, data, and fee waivers.',
    points_currency: 'PocketPay Points', points_per_ngn: 0.02,
    status: 'active',
  }).select('id').single()

  let ppStarter: { id: string } | null = null, ppPlus: { id: string } | null = null, ppElite: { id: string } | null = null
  if (ppLp?.id) {
    const { data: pt1 } = await sb.from('loyalty_tiers').insert({ brand_id: brandId, program_id: ppLp.id, name: 'Starter', min_points: 0,     color: '#B0B0B0', perks: ['1x points on transfers', 'Standard support queue'], sort_order: 1 }).select('id').single()
    const { data: pt2 } = await sb.from('loyalty_tiers').insert({ brand_id: brandId, program_id: ppLp.id, name: 'Plus',    min_points: 3_000, color: '#6C3FE8', perks: ['1.5x points on transfers', 'Priority support queue', 'One free transfer fee waiver per month'], sort_order: 2 }).select('id').single()
    const { data: pt3 } = await sb.from('loyalty_tiers').insert({ brand_id: brandId, program_id: ppLp.id, name: 'Elite',   min_points: 12_000, color: '#F0A500', perks: ['2x points on transfers', 'Dedicated support line', 'Unlimited fee waivers', 'Early access to new features'], sort_order: 3 }).select('id').single()
    ppStarter = pt1; ppPlus = pt2; ppElite = pt3

    await sb.from('loyalty_rewards').insert([
      { brand_id: brandId, program_id: ppLp.id, name: '₦200 Airtime Top-up',      description: 'Redeem points for instant airtime on any network', points_cost: 400,   reward_type: 'voucher',      is_active: true },
      { brand_id: brandId, program_id: ppLp.id, name: '1GB Data Bundle',          description: 'Redeem points for a 1GB data bundle',               points_cost: 600,   reward_type: 'voucher',      is_active: true },
      { brand_id: brandId, program_id: ppLp.id, name: 'Transfer Fee Waiver (5x)', description: 'Waive transfer fees on your next five transactions', points_cost: 1_200, reward_type: 'discount',     is_active: true },
      { brand_id: brandId, program_id: ppLp.id, name: 'Cashback Boost — 1 Week',  description: 'Double your cashback rate for seven days',           points_cost: 2_500, reward_type: 'experience',   is_active: true, stock: 200 },
    ])

    const ppMembers = [
      { name: 'Zainab Umar',    email: 'zainab.u@gmail.com', phone: '+2348011223301', tier: ppElite?.id,   pts: 18_400, lf: 21_200, joined: dAgo(260) },
      { name: 'Ifeanyi Obi',    email: 'ifeanyi.o@gmail.com', phone: '+2348022334402', tier: ppElite?.id,   pts: 14_900, lf: 16_800, joined: dAgo(220) },
      { name: 'Halima Sani',    email: 'halima.s@gmail.com', phone: '+2347033445503', tier: ppPlus?.id,    pts: 7_600,  lf: 8_900,  joined: dAgo(170) },
      { name: 'Damola Fashola', email: 'damola.f@gmail.com', phone: '+2348044556604', tier: ppPlus?.id,    pts: 5_200,  lf: 6_100,  joined: dAgo(140) },
      { name: 'Precious Etim',  email: 'precious.e@gmail.com', phone: '+2348055667705', tier: ppPlus?.id,  pts: 4_100,  lf: 4_700,  joined: dAgo(110) },
      { name: 'Kelechi Nna',    email: 'kelechi.n@gmail.com', phone: '+2348066778806', tier: ppStarter?.id, pts: 1_800,  lf: 2_100,  joined: dAgo(80) },
      { name: 'Aisha Bala',     email: 'aisha.b@gmail.com',  phone: '+2347077889907', tier: ppStarter?.id, pts: 900,    lf: 1_050,  joined: dAgo(50) },
      { name: 'Segun Odukoya',  email: 'segun.o@gmail.com',  phone: '+2348088990008', tier: ppStarter?.id, pts: 340,    lf: 340,    joined: dAgo(20) },
    ]
    const { data: ppMemberRows } = await sb.from('loyalty_members').insert(
      ppMembers.map(m => ({
        brand_id: brandId, program_id: ppLp.id, name: m.name, email: m.email, phone: m.phone,
        current_tier_id: m.tier, points_balance: m.pts, lifetime_points: m.lf,
        joined_at: m.joined, last_activity: dAgo(Math.floor(Math.random() * 15)),
      }))
    ).select('id')

    if (ppMemberRows?.length) {
      const ppTxInserts = ppMemberRows.flatMap((member, idx) => {
        const m = ppMembers[idx]
        const rows = []
        rows.push({ brand_id: brandId, member_id: member.id, transaction_type: 'earn', points: Math.round(m.lf * 0.65), balance_after: Math.round(m.lf * 0.65), description: 'Points earned — monthly transfer activity', reference: `TXN-${idx + 1001}`, created_at: m.joined })
        rows.push({ brand_id: brandId, member_id: member.id, transaction_type: 'bonus', points: Math.round(m.lf * 0.25), balance_after: Math.round(m.lf * 0.9), description: 'Referral bonus — friend signed up', reference: `REF-${idx + 2001}`, created_at: dAgo(35) })
        if (m.pts < m.lf) {
          const redeemed = m.lf - m.pts
          rows.push({ brand_id: brandId, member_id: member.id, transaction_type: 'redeem', points: -redeemed, balance_after: m.pts, description: 'Reward redemption — airtime top-up', reference: `RDM-${idx + 3001}`, created_at: dAgo(10) })
        }
        return rows
      })
      await sb.from('loyalty_transactions').insert(ppTxInserts)
    }
  }

  /* ── 28. Promoters + referral codes (Refer & Earn) ────────────────────── */
  const ppPromoterData = [
    { name: 'Zainab Umar',   email: 'zainab.u@gmail.com',  phone: '+2348011223301', nps: 10, city: 'Lagos', code: 'BP-PP01', clicks: 62, conversions: 19 },
    { name: 'Ifeanyi Obi',   email: 'ifeanyi.o@gmail.com', phone: '+2348022334402', nps: 9,  city: 'Abuja', code: 'BP-PP02', clicks: 44, conversions: 12 },
    { name: 'Halima Sani',   email: 'halima.s@gmail.com',  phone: '+2347033445503', nps: 10, city: 'Kano',  code: 'BP-PP03', clicks: 28, conversions: 8  },
    { name: 'Damola Fashola',email: 'damola.f@gmail.com',  phone: '+2348044556604', nps: 9,  city: 'Lagos', code: 'BP-PP04', clicks: 19, conversions: 5  },
  ]
  for (const p of ppPromoterData) {
    const { data: ppProm } = await sb.from('promoters').insert({
      brand_id: brandId, name: p.name, email: p.email, phone: p.phone,
      nps_score: p.nps, source: 'nps', status: 'active',
    }).select('id').single()
    if (ppProm?.id) {
      await sb.from('referral_codes').insert({
        brand_id: brandId, promoter_id: ppProm.id, code: p.code,
        destination_url: 'https://pocketpay.ng/refer',
        clicks: p.clicks, conversions: p.conversions, is_active: true,
      })
    }
  }

  /* ── 29. Customer profiles (CDP) ──────────────────────────────────────── */
  await sb.from('customer_profiles').insert([
    { brand_id: brandId, name: 'Zainab Umar',    email: 'zainab.u@gmail.com',  phone: '+2348011223301', nps_score: 10, nps_label: 'promoter',  last_seen_at: dAgo(2),  is_promoter: true,  segments: ['promoter', 'elite-tier', 'referrer'],        sources: { nps: true, loyalty: true, referral: true }, retention_risk_score: 4,  acquisition_source: 'referral' },
    { brand_id: brandId, name: 'Ifeanyi Obi',    email: 'ifeanyi.o@gmail.com', phone: '+2348022334402', nps_score: 9,  nps_label: 'promoter',  last_seen_at: dAgo(4),  is_promoter: true,  segments: ['promoter', 'elite-tier', 'referrer'],        sources: { nps: true, loyalty: true, referral: true }, retention_risk_score: 7,  acquisition_source: 'referral' },
    { brand_id: brandId, name: 'Halima Sani',    email: 'halima.s@gmail.com',  phone: '+2347033445503', nps_score: 10, nps_label: 'promoter',  last_seen_at: dAgo(6),  is_promoter: true,  segments: ['promoter', 'plus-tier', 'northern-market'],  sources: { nps: true, loyalty: true },                 retention_risk_score: 9,  acquisition_source: 'organic' },
    { brand_id: brandId, name: 'Damola Fashola', email: 'damola.f@gmail.com',  phone: '+2348044556604', nps_score: 9,  nps_label: 'promoter',  last_seen_at: dAgo(9),  is_promoter: true,  segments: ['promoter', 'plus-tier'],                     sources: { nps: true, loyalty: true },                 retention_risk_score: 14, acquisition_source: 'organic' },
    { brand_id: brandId, name: 'Precious Etim',  email: 'precious.e@gmail.com', phone: '+2348055667705', nps_score: 7, nps_label: 'passive',   last_seen_at: dAgo(14), is_promoter: false, segments: ['passive', 'plus-tier'],                      sources: { loyalty: true },                            retention_risk_score: 33, acquisition_source: 'campaign' },
    { brand_id: brandId, name: 'Kelechi Nna',    email: 'kelechi.n@gmail.com', phone: '+2348066778806', nps_score: 8, nps_label: 'passive',   last_seen_at: dAgo(19), is_promoter: false, segments: ['passive', 'starter-tier', 'student'],        sources: { nps: true, loyalty: true },                 retention_risk_score: 30, acquisition_source: 'campus_tour' },
    { brand_id: brandId, name: 'Aisha Bala',     email: 'aisha.b@gmail.com',  phone: '+2347077889907', nps_score: 4,  nps_label: 'detractor', last_seen_at: dAgo(28), is_promoter: false, segments: ['detractor', 'starter-tier', 'support-issue'], sources: { nps: true },                                retention_risk_score: 78, acquisition_source: 'organic' },
    { brand_id: brandId, name: 'Segun Odukoya',  email: 'segun.o@gmail.com',  phone: '+2348088990008', nps_score: 3,  nps_label: 'detractor', last_seen_at: dAgo(32), is_promoter: false, segments: ['detractor', 'starter-tier', 'churn-risk'],   sources: { nps: true },                                retention_risk_score: 88, acquisition_source: 'organic' },
  ])

  /* ── 30. Creative assets (Creative Library vault) ─────────────────────── */
  const ppCreativeAssets = [
    { title: 'PocketPay Cares — Support Team Testimonial', description: 'Real support agents speaking on-camera about fixing the October incident and what changed. 30s cut for Instagram and Twitter.', asset_type: 'video', format: 'Feed', platform: 'Instagram', status: 'vetted', fit_for_ads: true, performance: { impressions: 1_200_000, clicks: 38_000, ctr: 3.2, conversions: 5_200, spend: 900_000, roas: 4.1 }, replication_elements: ['Real employees, never actors', 'Acknowledge the problem in the first 5 seconds', 'End on a concrete fix, not just an apology', 'Keep under 30 seconds — attention drops fast on trust content'], tags: ['trust', 'crisis-recovery', 'video', 'top-performer'] },
    { title: 'Refer & Earn — Static Feed Ad', description: 'Simple product card: phone mockup showing the referral screen, "₦3,000 for 3 friends" headline, single CTA button.', asset_type: 'image', format: 'Feed', platform: 'Instagram', status: 'vetted', fit_for_ads: true, performance: { impressions: 980_000, clicks: 46_000, ctr: 4.7, conversions: 6_800, spend: 640_000, roas: 5.3 }, replication_elements: ['Lead with the naira amount, not the word "reward"', 'Phone mockup builds instant credibility on how the flow works', 'Single CTA only — extra buttons drop conversion'], tags: ['referral', 'conversion', 'top-performer'] },
    { title: 'Series A Announcement — Social Card', description: 'Clean announcement card: PocketPay logo, "$8M Series A" headline, investor logo strip beneath.', asset_type: 'image', format: 'Feed', platform: 'Twitter', status: 'vetted', fit_for_ads: false, performance: { impressions: 620_000, clicks: 9_200, ctr: 1.5 }, replication_elements: ['Investor logos add third-party credibility', 'Keep the headline number-first', 'Route to press/LinkedIn — not the main consumer feed'], tags: ['pr', 'announcement', 'series-a'] },
    { title: 'Push Notification Copy Bank — Referral Reminders', description: 'A/B tested push copy library for referral reminder nudges, sorted by tested click-through rate.', asset_type: 'copy', format: 'Push Notification', platform: 'App', status: 'vetted', fit_for_ads: false, performance: { impressions: 410_000, clicks: 28_700, ctr: 7.0 }, replication_elements: ['Lead with the cash amount, always', 'Keep under 40 characters for lock-screen visibility', 'Rotate copy every 2 weeks to avoid fatigue'], tags: ['push', 'referral', 'copy-bank'] },
    { title: 'Campus Banking Tour — Event Poster', description: 'A2 poster for on-campus activation: bold PocketPay wordmark, tour dates, "Open an account, get ₦1,000 instantly" hook.', asset_type: 'image', format: 'Print', platform: 'Print', status: 'active', fit_for_ads: false, performance: { impressions: 45_000 }, replication_elements: ['Instant incentive must be visible from 3 metres away', 'Tour dates in large type — this is a schedule tool as much as an ad', 'QR code linking straight to account opening flow'], tags: ['events', 'campus', 'print'] },
    { title: 'WhatsApp Referral Message Template', description: 'Pre-written WhatsApp share message users send when inviting friends, tuned for Pidgin-English mix.', asset_type: 'copy', format: 'WhatsApp', platform: 'WhatsApp', status: 'vetted', fit_for_ads: false, performance: { impressions: 210_000, clicks: 31_500, ctr: 15.0, conversions: 4_400 }, replication_elements: ['Pidgin-English mix outperforms formal English for peer-to-peer shares', 'Include the referral link and the naira amount in the same line', 'Keep it short enough to read in one glance in a chat thread'], tags: ['whatsapp', 'referral', 'template', 'top-performer'] },
  ]
  for (const asset of ppCreativeAssets) {
    await sb.from('creative_assets').insert({ brand_id: brandId, ...asset })
  }

  return NextResponse.json({
    success: true,
    credentials: { email: DEMO_EMAIL, password: DEMO_PASSWORD, note: 'Login at /auth/login' },
    brand: 'PocketPay', workspace: 'PocketPay (Pro plan)',
    seeded: {
      sentimentDays: 365, bhiSnapshots: 180, sovSnapshots: 26, campaigns: 4, events: 2, influencers: 8,
      mentions: 75, socialPosts: 30, npsRecords: 60, metricManual: Object.keys(pocketPaySeries).length, funnelSnapshots: 12,
      competitorSightings: 5, pressMentions: ppPress.length, creativeAnalyses: 3, prePostAnalyses: 3,
      crawlRuns: 10, abExperiments: 3, advocacyWeeks: 12, loyaltyMembers: 8, promoters: 4,
      customerProfiles: 8, creativeAssets: ppCreativeAssets.length,
    },
  })
}
