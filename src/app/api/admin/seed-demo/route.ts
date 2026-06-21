import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'

/* ─────────────────────────────────────────────────────────────────────────────
   Demo account: Jara Foods Ltd — Nigerian FMCG brand
   Story arc: healthy baseline → Oct 2025 competitor campaign dip →
              Nov–Dec 2025 Nourish Nigeria recovery + festive peak →
              Jan–Feb 2026 post-holiday stabilisation →
              Mar–May 2026 Reconnect campaign growth →
              June 2026 (now): strong summer position
───────────────────────────────────────────────────────────────────────────── */

const DEMO_EMAIL    = 'demo@jarafoods.brandpulse.ai'
const DEMO_PASSWORD = 'Demo@Jara2026!'
const SEED_SECRET   = 'seed-jara-demo-2026'
const BASE          = new Date('2026-06-15T12:00:00Z')

/* ── Date helpers ────────────────────────────────────────────────────────── */

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

/* ── Story-arc sentiment model ───────────────────────────────────────────── */

function sentScore(d: number): number {
  let base: number
  if      (d >= 290) base = 67
  else if (d >= 250) base = 65 - (d - 250) / 40 * 17        // ChowMate blitz
  else if (d >= 170) base = 48 + (250 - d) / 80 * 32        // recovery + festive
  else if (d >= 110) base = 80 - (d - 110) / 60 * 18        // post-holiday dip
  else if (d >= 30)  base = 62 + (110 - d) / 80 * 11        // Reconnect campaign
  else               base = 71 + (30 - d) * 0.13            // summer
  const noise = Math.sin(d * 1.7) * 2.5 + Math.cos(d * 0.9) * 1.8
  return +(Math.min(95, Math.max(18, base + noise)).toFixed(1))
}

/* ───────────────────────────────────────────────────────────────────────────
   POST /api/admin/seed-demo
   Header: x-seed-secret: seed-jara-demo-2026
────────────────────────────────────────────────────────────────────────────*/

export async function POST(req: NextRequest) {
  if (req.headers.get('x-seed-secret') !== SEED_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
    // Wipe previous seed by deleting workspaces (cascades to all child tables)
    const { data: mems } = await sb.from('workspace_members').select('workspace_id').eq('user_id', userId)
    for (const m of mems ?? []) {
      await sb.from('workspaces').delete().eq('id', m.workspace_id)
    }
  } else {
    const { data: created, error: authErr } = await sb.auth.admin.createUser({
      email:         DEMO_EMAIL,
      password:      DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { name: 'Temi Adewale', role: 'Brand Manager' },
    })
    if (authErr || !created?.user) {
      return NextResponse.json({ error: authErr?.message ?? 'User creation failed' }, { status: 500 })
    }
    userId = created.user.id
  }

  /* ── 2. Workspace ─────────────────────────────────────────────────────── */
  const { data: ws, error: wsErr } = await sb.from('workspaces').insert({
    name: 'Jara Foods', plan: 'pro', type: 'brand',
    industry: 'FMCG / Food & Beverages', base_currency: 'NGN',
  }).select('id').single()
  if (wsErr) return NextResponse.json({ error: wsErr.message }, { status: 500 })
  const wsId = ws.id

  await sb.from('workspace_members').insert({ workspace_id: wsId, user_id: userId, role: 'owner' })

  /* ── 3. Brand ─────────────────────────────────────────────────────────── */
  const { data: brand, error: brandErr } = await sb.from('brands').insert({
    workspace_id:    wsId,
    name:            'Jara Foods Ltd',
    category:        'FMCG',
    primary_color:   '#E8763E',
    secondary_color: '#2B4D24',
    market_share_pct: 14.7,
    brand_values:    ['Nourishment', 'Authenticity', 'Community', 'Quality'],
    cultural_profile: {
      community_corporate: 25,
      traditional_modern:  45,
      religious_secular:   30,
      mass_premium:        35,
      local_global:        20,
    },
    target_segments: [
      { name: 'Lagos Millennials',        age_range: '25-40', income: 'middle',     location: 'Lagos'       },
      { name: 'Northern Mass Market',     age_range: '18-45', income: 'low-middle', location: 'North Nigeria'},
      { name: 'Diaspora Reconnect',       age_range: '28-50', income: 'high',       location: 'UK/US/CA'    },
    ],
    brand_voice: {
      tone:          'warm, real, nourishing',
      personality:   'The dependable village elder who moved to the city',
      language_mix:  { english: 60, pidgin: 25, yoruba: 10, igbo: 5 },
    },
    bhi_weights: {
      awareness: 0.20, consideration: 0.15, preference: 0.20,
      advocacy: 0.15, nps: 0.15, sentiment: 0.10, sov: 0.05,
    },
  }).select('id').single()
  if (brandErr) return NextResponse.json({ error: brandErr.message }, { status: 500 })
  const brandId = brand.id

  /* ── 4. Competitors ───────────────────────────────────────────────────── */
  const { data: c1 } = await sb.from('competitors').insert({
    brand_id: brandId, name: 'ChowMate',
    social_handles: { instagram: '@chowmateng', twitter: '@ChowMateNG' },
    website_url: 'https://chowmateng.com', app_name: 'ChowMate App',
  }).select('id').single()
  const { data: c2 } = await sb.from('competitors').insert({
    brand_id: brandId, name: 'NutriNg Foods',
    social_handles: { instagram: '@nutring', twitter: '@NutriNgFoods' },
    website_url: 'https://nutring.com.ng',
  }).select('id').single()
  const comp1Id = c1?.id
  const comp2Id = c2?.id

  /* ── 5. Campaigns ─────────────────────────────────────────────────────── */
  const { data: camp1 } = await sb.from('campaigns').insert({
    brand_id: brandId, name: 'Nourish Nigeria',
    description: 'Integrated campaign celebrating Nigerian food heritage. OOH + events + digital.',
    objective: 'awareness', status: 'completed',
    start_date: dAgo(218), end_date: dAgo(168),
    total_budget: 18_000_000, currency: 'NGN',
    ai_summary: 'The Nourish Nigeria campaign drove a 24-point BHI uplift over 50 days. OOH placements in Lagos and Abuja generated 4.2M impressions. The Lagos festival event captured 1,847 verified leads. Sentiment peaked at 80/100 during the festive window.',
  }).select('id').single()

  const { data: camp2 } = await sb.from('campaigns').insert({
    brand_id: brandId, name: 'Reconnect with Jara',
    description: 'Digital-first retargeting campaign for lapsed purchasers.',
    objective: 'consideration', status: 'completed',
    start_date: dAgo(105), end_date: dAgo(15),
    total_budget: 12_000_000, currency: 'NGN',
    ai_summary: 'Strong consideration lift (+11pts) among Lagos millennials. Influencer content outperformed paid social 3:1 on engagement rate. Recommend maintaining @chefkemisola partnership for summer campaign.',
  }).select('id').single()

  const { data: camp3 } = await sb.from('campaigns').insert({
    brand_id: brandId, name: 'Jara Summer Vibes',
    description: 'Awareness push for the new Jara Chilled range ahead of rainy season.',
    objective: 'awareness', status: 'active',
    start_date: dAgo(14), end_date: dAgo(-76),
    total_budget: 8_500_000, currency: 'NGN',
    ai_summary: null,
  }).select('id').single()

  const camp1Id = camp1?.id
  const camp2Id = camp2?.id
  const camp3Id = camp3?.id

  if (camp1Id) await sb.from('campaign_channels').insert([
    { campaign_id: camp1Id, channel: 'ooh',     budget_allocation: 6_000_000, notes: 'Lagos + Abuja billboards' },
    { campaign_id: camp1Id, channel: 'events',  budget_allocation: 7_200_000, notes: 'Lagos Festival + Abuja popup' },
    { campaign_id: camp1Id, channel: 'digital', budget_allocation: 4_800_000, notes: 'Meta + TikTok awareness' },
  ])
  if (camp2Id) await sb.from('campaign_channels').insert([
    { campaign_id: camp2Id, channel: 'digital', budget_allocation: 9_500_000, notes: 'Meta retargeting + influencer' },
    { campaign_id: camp2Id, channel: 'radio',   budget_allocation: 2_500_000, notes: 'Lagos FM stations' },
  ])
  if (camp3Id) await sb.from('campaign_channels').insert([
    { campaign_id: camp3Id, channel: 'digital', budget_allocation: 4_500_000 },
    { campaign_id: camp3Id, channel: 'ooh',     budget_allocation: 4_000_000 },
  ])

  /* ── 6. Sentiment daily — 365 days ───────────────────────────────────── */
  const sentRows = []
  for (let d = 364; d >= 0; d--) {
    const score = sentScore(d)
    const pos   = +(Math.min(94, score * 0.85 + 5 + Math.sin(d * 0.7) * 3)).toFixed(1)
    const neg   = +(Math.max(2, 100 - pos - (15 + Math.cos(d * 0.5) * 4))).toFixed(1)
    const neu   = +(Math.max(1, 100 - pos - neg)).toFixed(1)
    const themes = score < 52
      ? ['pricing concerns', 'competitor comparison', 'availability', 'packaging complaints']
      : score > 72
      ? ['taste quality', 'value for money', 'nostalgia', 'family meals', 'brand love']
      : ['product quality', 'availability', 'taste', 'health benefits']
    sentRows.push({
      brand_id: brandId, day: dAgo(d),
      social_score: score, offline_score: +(score * 0.92 + Math.sin(d) * 2).toFixed(1),
      blended_score: score,
      positive_pct: pos, neutral_pct: neu, negative_pct: neg,
      top_themes: themes,
      emotion_distribution: {
        joy:          +(pos * 0.60).toFixed(1),
        trust:        +(pos * 0.28).toFixed(1),
        anticipation: +(pos * 0.12).toFixed(1),
        sadness:      +(neg * 0.42).toFixed(1),
        anger:        +(neg * 0.32).toFixed(1),
        fear:         +(neg * 0.26).toFixed(1),
      },
    })
  }
  await sb.from('sentiment_daily').insert(sentRows)

  /* ── 7. Brand health snapshots — 180 days ────────────────────────────── */
  const bhiRows = []
  for (let d = 179; d >= 0; d--) {
    const ss = sentScore(d)
    const t  = ss / 100
    const comps = {
      awareness:     +(55 + t * 35).toFixed(1),
      consideration: +(44 + t * 38).toFixed(1),
      preference:    +(36 + t * 42).toFixed(1),
      advocacy:      +(30 + t * 46).toFixed(1),
      nps:           +(28 + t * 48).toFixed(1),
      sentiment:     ss,
      sov:           +(34 + t * 28).toFixed(1),
    }
    const bhiVal = +(
      comps.awareness * 0.20 + comps.consideration * 0.15 + comps.preference * 0.20 +
      comps.advocacy  * 0.15 + comps.nps          * 0.15 + comps.sentiment  * 0.10 +
      comps.sov       * 0.05
    ).toFixed(1)
    bhiRows.push({
      brand_id: brandId, snapshot_date: dAgo(d),
      bhi: bhiVal, components: comps,
      data_coverage_pct: +(85 + Math.sin(d * 0.3) * 8).toFixed(1),
    })
  }
  await sb.from('brand_health_snapshots').insert(bhiRows)

  /* ── 8. SOV snapshots — every 7 days, 180 days ───────────────────────── */
  const sovRows = []
  for (let d = 175; d >= 0; d -= 7) {
    const ss = sentScore(d)
    const t  = ss / 100
    sovRows.push({
      brand_id: brandId, snapshot_date: dAgo(d),
      social_sov:  +(18 + t * 12 + Math.sin(d * 0.2) * 1.5).toFixed(1),
      paid_sov:    +(12 + t * 9).toFixed(1),
      ooh_sov:     +(8  + t * 5).toFixed(1),
      press_sov:   +(5  + t * 4).toFixed(1),
      search_sov:  +(11 + t * 7).toFixed(1),
      blended_sov: +(16 + t * 10).toFixed(1),
      esov:        +((16 + t * 10) - 14.7).toFixed(2),
      competitor_data: {
        ChowMate:     { social_sov: +(22 - t * 5).toFixed(1), blended_sov: +(20 - t * 4).toFixed(1) },
        NutriNgFoods: { social_sov: +(9  + Math.sin(d * 0.1) * 1.5).toFixed(1), blended_sov: 8.2 },
      },
    })
  }
  await sb.from('sov_snapshots').insert(sovRows)

  /* ── 9. Funnel snapshots — monthly, 12 months ────────────────────────── */
  const funnelRows = []
  for (let m = 11; m >= 0; m--) {
    const d  = m * 30
    const ss = sentScore(d)
    const t  = ss / 100
    funnelRows.push({
      brand_id: brandId, snapshot_date: dAgo(d), segment: 'all',
      awareness:      +(68 + t * 20).toFixed(1),
      consideration:  +(45 + t * 25).toFixed(1),
      preference:     +(32 + t * 28).toFixed(1),
      action:         +(18 + t * 18).toFixed(1),
      loyalty:        +(28 + t * 22).toFixed(1),
      advocacy:       +(15 + t * 18).toFixed(1),
      dropoffs: {
        awareness_to_consideration: +(30 - t * 12).toFixed(1),
        consideration_to_preference: +(25 - t * 10).toFixed(1),
        preference_to_action:        +(35 - t * 8).toFixed(1),
      },
    })
  }
  await sb.from('funnel_snapshots').insert(funnelRows)

  /* ── 10. Events ───────────────────────────────────────────────────────── */
  const { data: evt1 } = await sb.from('events').insert({
    brand_id: brandId, campaign_id: camp1Id,
    name: 'Nourish Nigeria Festival',
    event_type: 'brand_activation',
    venue: 'Eko Convention Centre', city: 'Lagos', state: 'Lagos',
    date_start: dAgo(218), date_end: dAgo(217),
    expected_attendance: 3000,
    objectives:           { primary: 'Brand love amplification', secondary: 'Lead capture', tertiary: 'Influencer content creation' },
    activation_mechanics: ['Live cooking demos', 'Recipe sampling', 'Photo booth', 'Social media wall', 'Branded gifts'],
    kpi_targets:          { leads: 1500, nps_score: 70, social_impressions: 2000000, press_mentions: 10 },
    budget: 7_200_000, currency: 'NGN',
    hashtags: ['#NourishNigeria', '#JaraFoods', '#JaraFestival2025'],
    status: 'closed',
    debrief: {
      actual_attendance: 2847, leads_captured: 1847, nps_achieved: 74,
      social_impressions: 3_400_000, press_mentions: 14,
      highlights: [
        'Chef Kemisola live demo drew 600 attendees',
        'Trended on X for 6 hours during day 1',
        'Partnership lead from Shoprite category buyer',
      ],
    },
  }).select('id').single()

  const { data: evt2 } = await sb.from('events').insert({
    brand_id: brandId, campaign_id: camp2Id,
    name: 'Jara Community Kitchen — Abuja',
    event_type: 'community_activation',
    venue: 'Millennium Park Pavilion', city: 'Abuja', state: 'FCT',
    date_start: dAgo(63), date_end: dAgo(62),
    expected_attendance: 800,
    objectives:           { primary: 'Community engagement in Abuja market', secondary: 'Lead capture' },
    activation_mechanics: ['Free community meals', 'Recipe cards', 'WhatsApp QR opt-in'],
    kpi_targets:          { leads: 400, nps_score: 65, social_impressions: 500000 },
    budget: 2_200_000, currency: 'NGN',
    hashtags: ['#JaraCommunityKitchen', '#JaraFoods', '#AbujaCooks'],
    status: 'reported',
    debrief: {
      actual_attendance: 1124, leads_captured: 631, nps_achieved: 72,
      social_impressions: 842_000,
      highlights: [
        'Exceeded attendance target by 40%',
        'FCT Deputy Governor visited',
        '312 WhatsApp opt-ins captured',
      ],
    },
  }).select('id').single()

  const evt1Id = evt1?.id
  const evt2Id = evt2?.id

  /* ── Event ambassadors + interactions ────────────────────────────────── */
  if (evt1Id) {
    const { data: amb1 } = await sb.from('event_ambassadors').insert({
      event_id: evt1Id, name: 'Amaka Okonkwo', phone: '+2348012345678',
      session_token: 'amb-jara-nourish-amaka-2025',
    }).select('id').single()
    const { data: amb2 } = await sb.from('event_ambassadors').insert({
      event_id: evt1Id, name: 'Taiwo Fashola', phone: '+2348098765432',
      session_token: 'amb-jara-nourish-taiwo-2025',
    }).select('id').single()

    const int1 = Array.from({ length: 40 }, (_, i) => ({
      event_id:         evt1Id,
      ambassador_id:    i % 2 === 0 ? amb1?.id : amb2?.id,
      interaction_type: i < 26 ? 'product_trial' : i < 36 ? 'lead_capture' : 'nps_intercept',
      customer_type:    ['new_prospect', 'lapsed_customer', 'existing_customer', 'influencer'][i % 4],
      lead_name:        i < 36 ? `Guest ${i + 1}` : null,
      lead_phone:       i < 36 ? `+23480${String(10000000 + i).slice(0, 8)}` : null,
      lead_interest:    ['Jara Rice', 'Jara Oats', 'Jara Spice Mix', 'Full Range'][i % 4],
      capture_method:   'ambassador' as const,
      client_uuid:      `evt1-${i + 1}`,
      occurred_at:      tsAgo(218 - Math.floor(i * 0.4), 9 + (i % 10)),
    }))
    await sb.from('event_interactions').insert(int1)
  }

  if (evt2Id) {
    const { data: amb3 } = await sb.from('event_ambassadors').insert({
      event_id: evt2Id, name: 'Fatima Aliyu', phone: '+2348023456789',
      session_token: 'amb-jara-abuja-fatima-2026',
    }).select('id').single()

    const int2 = Array.from({ length: 20 }, (_, i) => ({
      event_id:         evt2Id,
      ambassador_id:    amb3?.id,
      interaction_type: i < 14 ? 'product_trial' : 'lead_capture',
      customer_type:    ['new_prospect', 'existing_customer', 'lapsed_customer'][i % 3],
      lead_name:        `Attendee ${i + 1}`,
      lead_phone:       `+23481${String(10000000 + i).slice(0, 8)}`,
      lead_interest:    ['Jara Rice', 'Jara Semolina', 'Jara Spice Mix'][i % 3],
      capture_method:   'ambassador' as const,
      client_uuid:      `evt2-${i + 1}`,
      occurred_at:      tsAgo(63 - Math.floor(i * 0.3), 10 + (i % 8)),
    }))
    await sb.from('event_interactions').insert(int2)
  }

  /* ── 11. OOH sites ────────────────────────────────────────────────────── */
  // Insert active Summer Vibes (camp3) sites first — need IDs for visit logs + search uplift
  const { data: oohSummerVibes } = await sb.from('ooh_sites').insert([
    {
      brand_id: brandId, campaign_id: camp3Id,
      site_name: 'Lekki Toll Gate Mega Billboard',
      lat: 6.4698, lng: 3.5852, city: 'Lagos', state: 'Lagos',
      format_type: 'billboard', illuminated: true,
      daily_traffic: 85_000, operator: 'Outdoor Advertising Association of Nigeria',
      monthly_cost: 380_000, currency: 'NGN',
      campaign_start: dAgo(14), campaign_end: dAgo(-76),
      lga: 'Eti-Osa',
      vanity_slug: 'jara-lekki', landing_url: 'https://jarafoods.com/summer',
      visits: 2847, qr_scan_count: 631,
      notes: 'Premium location. 2× higher dwell time vs Apapa route.',
    },
    {
      brand_id: brandId, campaign_id: camp3Id,
      site_name: 'Adeniran Ogunsanya Mall, Surulere',
      lat: 6.5055, lng: 3.3576, city: 'Lagos', state: 'Lagos',
      format_type: 'unipole', illuminated: true,
      daily_traffic: 42_000, operator: 'Pison Outsourcing',
      monthly_cost: 210_000, currency: 'NGN',
      campaign_start: dAgo(14), campaign_end: dAgo(-76),
      lga: 'Surulere',
      vanity_slug: 'jara-surulere', landing_url: 'https://jarafoods.com/summer',
      visits: 1234, qr_scan_count: 289,
      notes: 'Mainland mass-market reach. Strong Jara Rice brand recall zone.',
    },
    {
      brand_id: brandId, campaign_id: camp3Id,
      site_name: 'Transcorp Hilton LED Screen, Abuja',
      lat: 9.0574, lng: 7.4898, city: 'Abuja', state: 'FCT',
      format_type: 'digital_screen', illuminated: true,
      daily_traffic: 22_000, operator: 'Ooh! Media',
      monthly_cost: 480_000, currency: 'NGN',
      campaign_start: dAgo(14), campaign_end: dAgo(-76),
      lga: 'Municipal Area Council',
      vanity_slug: 'jara-transcorp', landing_url: 'https://jarafoods.com/summer',
      visits: 1482, qr_scan_count: 312,
      notes: 'Rotating 10-second slot. High C-suite and diplomat footfall in the CBD.',
    },
    {
      brand_id: brandId, campaign_id: camp3Id,
      site_name: 'Oshodi Overhead Bridge Banners',
      lat: 6.5547, lng: 3.3500, city: 'Lagos', state: 'Lagos',
      format_type: 'lamppost', illuminated: false,
      daily_traffic: 110_000, operator: 'LASAA (Lagos State)',
      monthly_cost: 180_000, currency: 'NGN',
      campaign_start: dAgo(14), campaign_end: dAgo(-76),
      lga: 'Oshodi-Isolo',
      vanity_slug: 'jara-oshodi', landing_url: 'https://jarafoods.com/summer',
      visits: 3612, qr_scan_count: 941,
      notes: 'Highest raw footfall of all Lagos placements. Mass-market audience — best performing for Jara Rice SKU.',
    },
  ]).select('id')

  const lekkiId     = oohSummerVibes?.[0]?.id
  const surulereId  = oohSummerVibes?.[1]?.id
  const transcorpId = oohSummerVibes?.[2]?.id
  const oshodiId    = oohSummerVibes?.[3]?.id

  // Insert completed-campaign + standalone sites
  await sb.from('ooh_sites').insert([
    {
      brand_id: brandId, campaign_id: camp1Id,
      site_name: 'Murtala Muhammed International Airport',
      lat: 6.5774, lng: 3.3212, city: 'Lagos', state: 'Lagos',
      format_type: 'digital_screen', illuminated: true,
      daily_traffic: 28_000, operator: 'Ooh! Media',
      monthly_cost: 550_000, currency: 'NGN',
      campaign_start: dAgo(218), campaign_end: dAgo(168),
      lga: 'Ikeja',
      vanity_slug: 'jara-airport', landing_url: 'https://jarafoods.com/nourish',
      visits: 4102, qr_scan_count: 893,
      notes: 'Targets diaspora returnees and high-income travellers. Airport exclusivity until Dec 2026.',
    },
    {
      brand_id: brandId, campaign_id: camp1Id,
      site_name: 'Airport Road Unipole, Abuja',
      lat: 9.0063, lng: 7.4631, city: 'Abuja', state: 'FCT',
      format_type: 'unipole', illuminated: true,
      daily_traffic: 35_000, operator: 'AllOver Media',
      monthly_cost: 290_000, currency: 'NGN',
      campaign_start: dAgo(218), campaign_end: dAgo(168),
      lga: 'Municipal Area Council',
      vanity_slug: 'jara-abuja', landing_url: 'https://jarafoods.com/nourish',
      visits: 2291, qr_scan_count: 412,
    },
    {
      brand_id: brandId, campaign_id: null,
      site_name: 'Zoo Road Billboard, Kano',
      lat: 11.9944, lng: 8.5082, city: 'Kano', state: 'Kano',
      format_type: 'billboard', illuminated: true,
      daily_traffic: 48_000, operator: 'Prime Outdoor',
      monthly_cost: 120_000, currency: 'NGN',
      campaign_start: dAgo(90), campaign_end: dAgo(-30),
      lga: 'Kano Municipal',
      vanity_slug: 'jara-kano', landing_url: 'https://jarafoods.com',
      visits: 891, qr_scan_count: 198,
      notes: 'First northern placement. Hausa creative variant live. Performance below Lagos average — consider Pidgin/Hausa copy split test.',
    },
    {
      brand_id: brandId, campaign_id: null,
      site_name: 'GRA Flyover, Port Harcourt',
      lat: 4.8242, lng: 7.0336, city: 'Port Harcourt', state: 'Rivers',
      format_type: 'unipole', illuminated: true,
      daily_traffic: 31_000, operator: 'Rivers State SEMTRAC',
      monthly_cost: 165_000, currency: 'NGN',
      campaign_start: dAgo(60), campaign_end: dAgo(-30),
      lga: 'Port Harcourt',
      vanity_slug: 'jara-ph', landing_url: 'https://jarafoods.com',
      visits: 1124, qr_scan_count: 267,
      notes: 'South-South market entry. Oil-belt professional audience — good premium SKU potential.',
    },
  ])

  /* ── 11b. OOH visit logs (last 14 days, active Summer Vibes sites) ──────── */
  const oohVisitInserts: { site_id: string; brand_id: string; visited_at: string; device_type: string; ip_region: string }[] = []
  const visitDevices = ['mobile', 'mobile', 'mobile', 'desktop', 'tablet']
  const visitRegions = ['Lagos', 'Lagos', 'Abuja', 'Port Harcourt', 'Ibadan', 'Lagos', 'Kano']
  for (const { id: siteId, count } of [
    { id: lekkiId,     count: 120 },
    { id: surulereId,  count: 70  },
    { id: transcorpId, count: 85  },
    { id: oshodiId,    count: 140 },
  ]) {
    if (!siteId) continue
    for (let i = 0; i < count; i++) {
      oohVisitInserts.push({
        site_id:     siteId,
        brand_id:    brandId,
        visited_at:  tsAgo(i % 14, 7 + (i % 15)),
        device_type: visitDevices[i % visitDevices.length],
        ip_region:   visitRegions[i % visitRegions.length],
      })
    }
  }
  if (oohVisitInserts.length > 0) await sb.from('ooh_visits').insert(oohVisitInserts)

  /* ── 11c. OOH search uplift — Lekki site, 8 weeks of data ──────────────── */
  if (lekkiId) {
    const upliftInterpretations = [
      'Early correlation emerging as campaign launches.',
      'Moderate positive correlation — awareness building.',
      'Positive correlation strengthening week-on-week.',
      'Consistent uplift: OOH visits preceded search spikes by 2 days.',
      'Strong signal — search intent rising with sustained OOH presence.',
      'OOH halo effect confirmed. Branded search at 8-week high.',
      'Peak correlation. Campaign driving both physical and digital brand recall.',
      'Strong positive correlation — OOH visit spikes precede branded search increases by 2-3 days.',
    ]
    await sb.from('ooh_search_uplift').insert(
      Array.from({ length: 8 }, (_, i) => {
        const w = 7 - i
        return {
          brand_id:       brandId,
          site_id:        lekkiId,
          keyword:        'Jara Foods',
          week_start:     dAgo(w * 7 + 6),
          search_index:   +(52 + i * 4.8 + Math.sin(i * 1.3) * 4).toFixed(1),
          ooh_visits:     Math.round(55 + i * 17 + (i % 3) * 12),
          correlation:    +(0.48 + i * 0.037).toFixed(4),
          interpretation: upliftInterpretations[i],
        }
      })
    )
  }

  /* ── 12. Mentions ─────────────────────────────────────────────────────── */
  const mentionData = [
    { c: 'Jara Rice is unbeatable abeg. The way it cooks clean clean no be joke 🔥 #JaraFoods',                 p: 'twitter',   sl: 'positive', ss: 82, f: 3200,  d: 3  },
    { c: 'My family don switch to Jara Oats for morning. Children like am, husband like am. Jara win 🙌',        p: 'instagram', sl: 'positive', ss: 88, f: 1500,  d: 5  },
    { c: 'Tried Jara Spice Mix for the first time and I\'m obsessed! Authentic Nigerian flavours 😍',            p: 'twitter',   sl: 'positive', ss: 90, f: 8900,  d: 8  },
    { c: 'The Jara Community Kitchen in Abuja was everything! Free food, good vibes 👏 #JaraCommunityKitchen',   p: 'instagram', sl: 'positive', ss: 95, f: 12400, d: 62 },
    { c: 'Finally a Nigerian food brand that actually listens. New pack size na godsend for market women like us', p: 'twitter',  sl: 'positive', ss: 78, f: 890,   d: 18 },
    { c: 'Nourish Nigeria campaign di too 🔥 This advert enter my chest. Well done Jara Foods ✊',               p: 'twitter',   sl: 'positive', ss: 85, f: 6700,  d: 200},
    { c: 'Jara Foods consistently wins on quality. Been using for 3 years, never disappointed once.',            p: 'instagram', sl: 'positive', ss: 91, f: 4300,  d: 25 },
    { c: 'That Lekki billboard for Jara Summer Vibes caught my eye this morning. Love the creative 🌟',          p: 'twitter',   sl: 'positive', ss: 76, f: 2100,  d: 10 },
    { c: 'Shoutout to Jara for the free samples at the mall today! Y\'all need to try the new Jara Chilled 🥤', p: 'instagram', sl: 'positive', ss: 88, f: 5600,  d: 7  },
    { c: 'Jara Rice + Jara Spice Mix = 🤌 Perfect Sunday jollof. No shortcut for quality.',                     p: 'twitter',   sl: 'positive', ss: 92, f: 3800,  d: 12 },
    { c: 'Chef Kemisola jollof demo at the Jara festival was insane. 600 people just stood and watched 😭',    p: 'instagram', sl: 'positive', ss: 94, f: 18200, d: 216},
    { c: 'Jara na the real deal. My mama been using their products since the 90s and we still on it.',           p: 'twitter',   sl: 'positive', ss: 87, f: 2900,  d: 32 },
    { c: 'Anyone know where to get Jara Semolina in Ibadan? My usual spot don finish stock 😩',                  p: 'twitter',   sl: 'neutral',  ss: 52, f: 1200,  d: 14 },
    { c: 'Comparing Jara Rice vs ChowMate — both solid options. Depends on what you\'re cooking tbh',           p: 'instagram', sl: 'neutral',  ss: 55, f: 3100,  d: 30, ic: true },
    { c: 'Jara Oats price don increase small. Was ₦850, now ₦980. Inflation sha 😩',                            p: 'twitter',   sl: 'neutral',  ss: 45, f: 2300,  d: 45 },
    { c: 'Saw the Jara Summer Vibes campaign. Clean visuals but the music could be more Naija 🇳🇬',             p: 'instagram', sl: 'neutral',  ss: 55, f: 4100,  d: 6  },
    { c: 'Jara Reconnect campaign di okay. Nothing extraordinary but consistent with their brand.',              p: 'twitter',   sl: 'neutral',  ss: 58, f: 1700,  d: 72 },
    { c: 'Jara Rice I bought from Shoprite Ikeja had stones in it. Disappointing for a "premium" brand 😤',     p: 'twitter',   sl: 'negative', ss: 18, f: 5600,  d: 22 },
    { c: 'Customer service for Jara is a joke. Sent 3 DMs, no reply. ChowMate responds within the hour.',       p: 'twitter',   sl: 'negative', ss: 15, f: 9200,  d: 35, ic: true },
    { c: 'Jara Spice Mix expiry date unclear on pack. Had to throw it away. Sort your packaging team out.',     p: 'instagram', sl: 'negative', ss: 22, f: 1900,  d: 50 },
    { c: 'ChowMate latest campaign is EVERYWHERE. Jara where you dey? Time to show up 👀 #FMCG',               p: 'twitter',   sl: 'negative', ss: 30, f: 7800,  d: 260, ic: true },
    { c: 'ChowMate price slash + Jara price increase same week? Walahi this is not looking good for Jara.',    p: 'twitter',   sl: 'negative', ss: 25, f: 3400,  d: 255, ic: true },
    { c: 'Not feeling the Jara rebranding. Old packaging felt more premium. Change for change sake?',           p: 'instagram', sl: 'negative', ss: 32, f: 2100,  d: 80 },
  ]

  const mentionInserts = mentionData.map((m, i) => ({
    brand_id:        brandId,
    platform:        m.p,
    external_id:     `demo-mention-${i + 1}`,
    content:         m.c,
    author_handle:   `@user_${1000 + i}`,
    author_followers: m.f,
    reach:           Math.round(m.f * 0.12),
    sentiment_label: m.sl,
    sentiment_score: m.ss,
    emotion_tags:    m.ss > 70 ? ['joy', 'trust'] : m.ss < 35 ? ['anger', 'disgust'] : ['surprise', 'anticipation'],
    topics:          m.ss > 70 ? ['brand love', 'product quality'] : m.ss < 35 ? ['complaint', 'service'] : ['comparison', 'pricing'],
    language_tag:    'en',
    is_competitor:   m.ic ?? false,
    created_at:      tsAgo(m.d, 8 + (i % 14)),
  }))
  await sb.from('mentions').insert(mentionInserts)

  /* ── 13. Surveys, responses, NPS records ──────────────────────────────── */
  const { data: survey } = await sb.from('surveys').insert({
    brand_id: brandId,
    name: 'Jara Brand Health Survey — Q2 2026',
    type: 'nps',
    questions: [
      { id: 'q1', type: 'single_choice', text: 'How did you first discover Jara Foods?', options: ['TV/Radio', 'Social Media', 'Friend/Family', 'Supermarket', 'Event'] },
      { id: 'q2', type: 'nps', text: 'How likely are you to recommend Jara Foods to a friend or colleague?', scale: 10 },
      { id: 'q3', type: 'text',          text: 'What\'s one thing Jara Foods could do better?' },
      { id: 'q4', type: 'single_choice', text: 'Which product do you use most?', options: ['Jara Rice', 'Jara Oats', 'Jara Spice Mix', 'Jara Semolina', 'Other'] },
    ],
    deploy_channels: ['whatsapp', 'email', 'in-app'],
    languages: ['english', 'yoruba', 'pidgin'],
    status: 'live',
  }).select('id').single()

  const surveyId = survey?.id

  // Distribution → promoters 57%, passives 18%, detractors 25% → NPS ~32
  const npsScores = [
    ...Array.from({ length: 17 }, (_, i) => 9 + (i % 2)),   // 17 promoters
    ...Array.from({ length: 5  }, ()     => 7 + Math.floor(Math.random() * 2)), // 5 passives
    ...Array.from({ length: 8  }, (_, i) => 1 + (i % 5)),   // 8 detractors
  ]

  const segs = [
    { age: '25-34', gender: 'female', city: 'Lagos',  income: 'middle'     },
    { age: '35-44', gender: 'male',   city: 'Lagos',  income: 'high'       },
    { age: '18-24', gender: 'female', city: 'Abuja',  income: 'low-middle' },
    { age: '45-54', gender: 'male',   city: 'Kano',   income: 'middle'     },
    { age: '25-34', gender: 'male',   city: 'Ibadan', income: 'middle'     },
  ]
  const channels = ['whatsapp', 'email', 'in-app', 'event_survey']
  const verbatimMap: Record<number, string> = {
    10: 'Jara Foods is the gold standard for Nigerian food. Never switching.',
    9:  'Great quality and my family loves everything. Just need more stores.',
    8:  'Generally satisfied. Pricing could be a bit more competitive.',
    7:  'Good products but distribution in my area is inconsistent.',
    5:  'Had a quality issue last month. Not sure I would recommend yet.',
    4:  'Prefer ChowMate pricing for bulk buying honestly.',
    3:  'Too expensive vs alternatives with similar quality.',
    2:  'Poor customer service experience ruined my impression.',
    1:  'Stone in rice. Reported it. No response. Never buying again.',
  }
  const lats = [6.5244, 9.0579, 11.9964, 7.3775, 6.3350]
  const lngs = [3.3792, 7.4898,  8.5922, 3.9470, 5.6237]

  if (surveyId) {
    const respInserts = npsScores.map((score, i) => ({
      survey_id: surveyId,
      answers: {
        q1: ['Social Media', 'Friend/Family', 'Supermarket', 'TV/Radio', 'Event'][i % 5],
        q2: score,
        q3: verbatimMap[score] ?? 'Good product overall.',
        q4: ['Jara Rice', 'Jara Oats', 'Jara Spice Mix', 'Jara Semolina', 'Other'][i % 5],
      },
      respondent_profile: segs[i % 5],
      source:       channels[i % 4],
      language:     'english',
      quality_flag: 'ok',
      location_lat: lats[i % 5],
      location_lng: lngs[i % 5],
      collected_at: tsAgo(Math.floor(i * 2.8) + 5, 9 + (i % 12)),
    }))
    await sb.from('survey_responses').insert(respInserts)
  }

  // 100 NPS records for richer chart data
  const npsInserts = Array.from({ length: 100 }, (_, i) => {
    const r = (Math.sin(i * 7.3) + 1) / 2   // deterministic pseudo-random 0–1
    let score: number
    if      (r < 0.55) score = 9 + (i % 2 === 0 ? 1 : 0)
    else if (r < 0.73) score = 7 + (i % 2 === 0 ? 1 : 0)
    else               score = Math.floor(r * 7)
    return {
      brand_id:      brandId,
      score,
      verbatim:      score >= 9 ? 'Love Jara. Highly recommend.' : score >= 7 ? 'Good but room to improve.' : 'Needs work.',
      segment:       { channel: channels[i % 4], city: segs[i % 5].city, age: segs[i % 5].age },
      channel:       channels[i % 4],
      promoter_type: score >= 9 ? 'promoter' : score >= 7 ? 'passive' : 'detractor',
      created_at:    tsAgo(Math.floor(i * 3.6), 8 + (i % 14)),
    }
  })
  await sb.from('nps_records').insert(npsInserts)

  /* ── 14. Influencers ──────────────────────────────────────────────────── */
  await sb.from('influencers').insert([
    {
      brand_id: brandId, campaign_id: null,
      name: 'Funmi Afolabi', handle: 'foodie_naija', platform: 'instagram',
      category: 'Food & Lifestyle', followers: 485_000,
      cultural_iq: 88.5, risk_score: 12.0, status: 'active',
      ai_notes: 'Exceptional 5.8% engagement rate despite large following. Naturally bilingual (English/Yoruba). Strong purchase intent in comment section. Recommended for always-on partnership.',
      social_urls: [
        { platform: 'instagram', handle: 'foodie_naija', url: 'https://instagram.com/foodie_naija' },
        { platform: 'tiktok',    handle: 'foodie_naija', url: 'https://tiktok.com/@foodie_naija' },
      ],
      profile_data: {
        bio: 'Lagos food lover sharing authentic Nigerian recipes and restaurant reviews. Yoruba by heart 🍛',
        content_types: ['Recipe videos', 'Restaurant reviews', 'Product unboxings', 'Cooking tutorials'],
        posting_frequency: '5-6x per week',
        audience_demographics: {
          age_range: '22-38',
          primary_location: 'Lagos, Nigeria',
          interests: ['Nigerian cuisine', 'Cooking', 'Food photography', 'Lifestyle'],
        },
        engagement_rate_estimate: 0.058,
        online_reputation: {
          positive_signals: ['Consistent brand safe content', 'High comment engagement', 'Bilingual creator (English/Yoruba)', 'Loyal community'],
          negative_signals: [],
          controversy_flags: [],
          summary: 'Excellent reputation. No controversies on record. Strong authentic following in Lagos food community.',
        },
        estimated_followers: { instagram: 485_000, tiktok: 112_000, twitter: 0, youtube: 0, total: 597_000 },
      },
      brand_fit: {
        score: 92,
        audience_overlap: 88,
        value_alignment: 'Strong alignment — food-first creator with Nigerian cultural authenticity matching Jara Foods brand values',
        risk_factors: [],
        positive_indicators: ['Food-focused content matches Jara product range', 'Yoruba language use resonates with target market', 'Lagos audience matches key distribution cities', 'Purchase-intent comments on food posts'],
        recommendation: 'strong_fit',
        recommendation_notes: 'Top-tier candidate for always-on partnership. Prioritise for Jara Rice and Spice launches. Negotiate 6-month exclusivity to lock out ChowMate.',
      },
    },
    {
      brand_id: brandId, campaign_id: camp1Id,
      name: 'Chef Kemisola Adeyemi', handle: 'chefkemisola', platform: 'instagram',
      category: 'Chef / Food Creator', followers: 312_000,
      cultural_iq: 94.2, risk_score: 8.5, status: 'active',
      ai_notes: 'Gold standard for Jara brand partnerships. Live cooking demo at Nourish Nigeria Festival drew 600 attendees. Deep Yoruba cultural credibility. Prioritise for festive season campaigns.',
      social_urls: [
        { platform: 'instagram', handle: 'chefkemisola',    url: 'https://instagram.com/chefkemisola' },
        { platform: 'youtube',   handle: 'ChefKemisolaNG',  url: 'https://youtube.com/@ChefKemisolaNG' },
      ],
      profile_data: {
        bio: 'Professional chef | Nigerian cuisine ambassador | Cooking classes in Lagos & Abuja | Authored "Modern Nigerian Kitchen"',
        content_types: ['Professional recipe tutorials', 'Live cooking demos', 'Cookbook promotions', 'Festival appearances'],
        posting_frequency: '3-4x per week',
        audience_demographics: {
          age_range: '28-45',
          primary_location: 'Lagos & Abuja, Nigeria',
          interests: ['Professional cooking', 'Nigerian food culture', 'Home cooking', 'Wellness'],
        },
        engagement_rate_estimate: 0.072,
        online_reputation: {
          positive_signals: ['Professional chef credibility', 'Cookbook author', 'Festival speaker history', 'Zero controversy record', 'Positive press coverage'],
          negative_signals: [],
          controversy_flags: [],
          summary: 'Impeccable reputation as Nigeria\'s leading food creator. Highly trusted by audience and brands alike.',
        },
        estimated_followers: { instagram: 312_000, tiktok: 0, twitter: 45_000, youtube: 89_000, total: 446_000 },
      },
      brand_fit: {
        score: 96,
        audience_overlap: 91,
        value_alignment: 'Perfect alignment — professional culinary authority reinforces Jara Foods quality positioning',
        risk_factors: [],
        positive_indicators: ['Cookbook author lends authority to ingredient quality', 'Festival appearances create OOH opportunities', 'Audience actively seeks recipe inspiration', 'Abuja coverage addresses underperforming northern market'],
        recommendation: 'strong_fit',
        recommendation_notes: 'Gold standard partner. Activate for festive season campaign and Jara Spice range launch. Explore co-branded recipe card series.',
      },
    },
    {
      brand_id: brandId, campaign_id: null,
      name: 'Naija Tastes', handle: 'naija_tastes', platform: 'tiktok',
      category: 'Food & Culture', followers: 920_000,
      cultural_iq: 82.0, risk_score: 22.0, status: 'prospect',
      ai_notes: 'Massive TikTok reach but some past brand deals felt inauthentic. Risk score elevated by two potential controversy flags. Trial with low-commitment UGC brief before full partnership.',
      social_urls: [
        { platform: 'tiktok',    handle: 'naija_tastes', url: 'https://tiktok.com/@naija_tastes' },
        { platform: 'instagram', handle: 'naijatastes_',  url: 'https://instagram.com/naijatastes_' },
      ],
      profile_data: {
        bio: 'Serving Nigerian food content daily 🇳🇬 TikTok food creator | 900k+ fam | Collabs DM open',
        content_types: ['Short-form food videos', 'Trending food challenges', 'Street food reviews', 'UGC-style content'],
        posting_frequency: 'Daily (7x per week)',
        audience_demographics: {
          age_range: '16-28',
          primary_location: 'Nigeria (Pan-national)',
          interests: ['Street food', 'Food challenges', 'Entertainment', 'Youth culture'],
        },
        engagement_rate_estimate: 0.041,
        online_reputation: {
          positive_signals: ['Massive Gen-Z reach', 'Viral content history', 'High comment volume'],
          negative_signals: ['Past brand deals perceived as inauthentic by followers', 'Inconsistent posting quality'],
          controversy_flags: ['Tagged in influencer payment dispute thread (unresolved)', 'One deleted post involving competitor brand'],
          summary: 'High reach but elevated risk. Authenticity concerns noted by followers. Controversy flags require monitoring before commitment.',
        },
        estimated_followers: { instagram: 340_000, tiktok: 920_000, twitter: 0, youtube: 0, total: 1_260_000 },
      },
      brand_fit: {
        score: 65,
        audience_overlap: 60,
        value_alignment: 'Moderate — strong reach but youth-skew audience may not match Jara Foods core buyer (25-45)',
        risk_factors: ['Payment dispute history', 'Authenticity perception gap with followers', 'Deleted competitor post raises exclusivity concerns'],
        positive_indicators: ['Highest raw reach of any prospect', 'TikTok-first when Jara needs TikTok presence', 'Nigerian pan-national coverage'],
        recommendation: 'potential_fit',
        recommendation_notes: 'Trial with single low-commitment UGC brief. Set clear content approval gates and exclusivity clause. Do not pay full partnership fee until track record established.',
      },
    },
    {
      brand_id: brandId, campaign_id: camp2Id,
      name: 'Emeka Ogu', handle: 'abuja_foodie', platform: 'instagram',
      category: 'Food Critic / Blogger', followers: 78_000,
      cultural_iq: 79.0, risk_score: 15.0, status: 'paused',
      ai_notes: 'Useful for Abuja market. Paused after posting competitor content during Jara campaign exclusivity window. Reconsider if exclusivity terms can be tightened.',
      social_urls: [
        { platform: 'instagram', handle: 'abuja_foodie', url: 'https://instagram.com/abuja_foodie' },
        { platform: 'twitter',   handle: 'abuja_foodie', url: 'https://twitter.com/abuja_foodie' },
      ],
      profile_data: {
        bio: 'Abuja food critic | Uncovering the best of FCT dining | Restaurant reviews | Food journalism',
        content_types: ['Restaurant reviews', 'Food criticism', 'Dining guides', 'Event coverage'],
        posting_frequency: '2-3x per week',
        audience_demographics: {
          age_range: '28-45',
          primary_location: 'Abuja (FCT), Nigeria',
          interests: ['Fine dining', 'Restaurant discovery', 'Food journalism', 'Abuja lifestyle'],
        },
        engagement_rate_estimate: 0.044,
        online_reputation: {
          positive_signals: ['Respected Abuja food voice', 'Press accreditation at food events', 'Engaged niche audience'],
          negative_signals: ['Posted competitor content during Jara exclusivity window'],
          controversy_flags: [],
          summary: 'Credible micro-influencer with a specific Abuja niche. Currently paused due to exclusivity breach. Low risk if contract tightened.',
        },
        estimated_followers: { instagram: 78_000, tiktok: 0, twitter: 22_000, youtube: 0, total: 100_000 },
      },
      brand_fit: {
        score: 72,
        audience_overlap: 70,
        value_alignment: 'Good alignment for Abuja market — food-focused credible voice where Jara distribution is growing',
        risk_factors: ['Previous exclusivity breach needs contractual resolution before re-engagement'],
        positive_indicators: ['Abuja-specific reach fills geographic gap', 'Food critic credibility matches Jara quality narrative', 'Engaged audience in target income bracket'],
        recommendation: 'potential_fit',
        recommendation_notes: 'Re-engage with tightened exclusivity terms and 30-day monitoring period. Suitable for Abuja market activation only until trust is rebuilt.',
      },
    },
    {
      brand_id: brandId, campaign_id: null,
      name: 'Tunde Bello', handle: 'tbello_foodvlogs', platform: 'youtube',
      category: 'Food Vlogger', followers: 245_000,
      cultural_iq: 85.0, risk_score: 10.0, status: 'prospect',
      ai_notes: 'Long-form food vlogger with strong YouTube and Instagram cross-platform presence. Authentic product integration style. High audience trust score. Ideal for Jara Oats and Rice recipe series.',
      social_urls: [
        { platform: 'youtube',   handle: 'tbello_foodvlogs', url: 'https://youtube.com/@tbello_foodvlogs' },
        { platform: 'instagram', handle: 'tbello_foodvlogs', url: 'https://instagram.com/tbello_foodvlogs' },
      ],
      profile_data: {
        bio: 'Nigerian food vlogger | Cooking honest meals on YouTube | Lagos-based | 245K YouTube fam | Product reviews',
        content_types: ['Long-form recipe videos', 'Product reviews', 'Taste tests', 'Grocery hauls', 'Cooking challenges'],
        posting_frequency: '2x per week (YouTube) + 4x per week (Instagram)',
        audience_demographics: {
          age_range: '25-42',
          primary_location: 'Lagos, Nigeria',
          interests: ['Home cooking', 'Budget-friendly meals', 'Nigerian food culture', 'Product discovery'],
        },
        engagement_rate_estimate: 0.063,
        online_reputation: {
          positive_signals: ['Honest product review reputation', 'High audience trust score', 'Clean controversy record', 'Consistent content quality'],
          negative_signals: [],
          controversy_flags: [],
          summary: 'Well-respected food vlogger known for authentic reviews. Strong trust with audience makes product placements credible.',
        },
        estimated_followers: { instagram: 187_000, tiktok: 0, twitter: 0, youtube: 245_000, total: 432_000 },
      },
      brand_fit: {
        score: 88,
        audience_overlap: 84,
        value_alignment: 'Strong — long-form recipe content is ideal vehicle for Jara ingredient products (rice, spices, oats)',
        risk_factors: [],
        positive_indicators: ['YouTube recipe format perfect for Jara Oats morning routine content', 'Product review credibility drives purchase intent', 'Lagos audience matches primary distribution zone'],
        recommendation: 'strong_fit',
        recommendation_notes: 'Commission a 3-video Jara Oats breakfast series and a Jara Rice jollof recipe integration. YouTube content has long shelf-life with high SEO value.',
      },
    },
    {
      brand_id: brandId, campaign_id: null,
      name: 'Ada Okonkwo', handle: 'adaph_lifestyle', platform: 'instagram',
      category: 'Lifestyle & Food', followers: 620_000,
      cultural_iq: 75.0, risk_score: 18.0, status: 'prospect',
      ai_notes: 'High-reach lifestyle influencer with mixed content (beauty, fashion, food). Food content makes up ~30% of posts. Large TikTok following adds scale. Brand fit is potential due to diluted food focus.',
      social_urls: [
        { platform: 'instagram', handle: 'adaph_lifestyle', url: 'https://instagram.com/adaph_lifestyle' },
        { platform: 'tiktok',    handle: 'adaph_lifestyle', url: 'https://tiktok.com/@adaph_lifestyle' },
      ],
      profile_data: {
        bio: 'Lagos lifestyle creator | Beauty, fashion & food | Living my best life 💅🏾 | Collabs: hello@adaph.ng',
        content_types: ['Lifestyle vlogs', 'Beauty tutorials', 'Fashion hauls', 'Food content', 'Day-in-my-life'],
        posting_frequency: '6x per week',
        audience_demographics: {
          age_range: '20-35',
          primary_location: 'Lagos, Nigeria',
          interests: ['Beauty', 'Fashion', 'Lifestyle', 'Food', 'Entertainment'],
        },
        engagement_rate_estimate: 0.038,
        online_reputation: {
          positive_signals: ['Strong personal brand', 'High visibility', 'Aspirational lifestyle appeal'],
          negative_signals: ['Food content is secondary to beauty/fashion — may dilute brand message', 'Engagement rate lower than food-specialist peers'],
          controversy_flags: [],
          summary: 'Popular lifestyle creator with broad reach. Food is a secondary niche which reduces specificity for a food FMCG brand.',
        },
        estimated_followers: { instagram: 620_000, tiktok: 1_200_000, twitter: 0, youtube: 0, total: 1_820_000 },
      },
      brand_fit: {
        score: 58,
        audience_overlap: 55,
        value_alignment: 'Partial — aspirational lifestyle positioning is compatible but food focus is diluted by beauty/fashion content',
        risk_factors: ['Mixed content may confuse brand message association', 'Audience follows for beauty not food — conversion risk'],
        positive_indicators: ['Massive combined reach across Instagram + TikTok', 'Lagos female audience (25-35) is Jara household decision-maker target', 'Aspirational lifestyle angle suits Jara Oats health positioning'],
        recommendation: 'potential_fit',
        recommendation_notes: 'Consider for a single campaign burst focused on Jara Oats healthy living angle. Request food-only content brief and audience demographic report before committing.',
      },
    },
    {
      brand_id: brandId, campaign_id: null,
      name: 'Ibrahim Musa', handle: 'northernspice', platform: 'twitter',
      category: 'Northern Food Blogger', followers: 92_000,
      cultural_iq: 77.0, risk_score: 14.0, status: 'prospect',
      ai_notes: 'Northern Nigerian food blogger with credible reach in an underserved market for Jara. Twitter-first audience is older and more opinion-driven. Potential fit for Jara Spice range in northern markets.',
      social_urls: [
        { platform: 'twitter', handle: 'northernspice', url: 'https://twitter.com/northernspice' },
      ],
      profile_data: {
        bio: 'Northern Nigerian food culture | Hausa cuisine | Kano-based | Food writer & blogger | نکلا دانی به',
        content_types: ['Food commentary', 'Recipe threads', 'Cultural food essays', 'Market reviews'],
        posting_frequency: '3-4x per week',
        audience_demographics: {
          age_range: '25-45',
          primary_location: 'Kano & Kaduna, Northern Nigeria',
          interests: ['Hausa cuisine', 'Northern Nigerian culture', 'Food writing', 'Agriculture'],
        },
        engagement_rate_estimate: 0.052,
        online_reputation: {
          positive_signals: ['Respected northern food voice', 'Bilingual English/Hausa content', 'Zero controversy record', 'Academic food writing credibility'],
          negative_signals: ['Single platform limits reach multiplier', 'Twitter-first limits visual product showcase'],
          controversy_flags: [],
          summary: 'Credible northern Nigeria food blogger. Limited reach compared to peers but high relevance for northern market activation.',
        },
        estimated_followers: { instagram: 0, tiktok: 0, twitter: 92_000, youtube: 0, total: 92_000 },
      },
      brand_fit: {
        score: 68,
        audience_overlap: 72,
        value_alignment: 'Good regional alignment — northern food credibility supports Jara Spice range in an underserved market',
        risk_factors: ['Single-platform concentration limits campaign amplification', 'Smaller absolute reach than other prospects'],
        positive_indicators: ['Fills critical northern Nigeria geographic gap', 'Hausa-language content unlocks underserved audience', 'Food specificity matches Jara Spice product range'],
        recommendation: 'potential_fit',
        recommendation_notes: 'Commission for targeted northern Nigeria Jara Spice activation. Low budget required. Pair with local radio and OOH for market entry amplification.',
      },
    },
    {
      brand_id: brandId, campaign_id: null,
      name: 'Shade Williams', handle: 'beautybyshade', platform: 'instagram',
      category: 'Beauty & Skincare', followers: 390_000,
      cultural_iq: 41.0, risk_score: 28.0, status: 'rejected',
      ai_notes: 'Beauty influencer with no food content. Audience is beauty-focused with different purchase behaviour. Poor fit for food FMCG. High misalignment risk — audience would see food brand collab as inauthentic.',
      social_urls: [
        { platform: 'instagram', handle: 'beautybyshade', url: 'https://instagram.com/beautybyshade' },
        { platform: 'tiktok',    handle: 'beautybyshade', url: 'https://tiktok.com/@beautybyshade' },
      ],
      profile_data: {
        bio: 'Lagos beauty creator | Skincare obsessed | Makeup tutorials | Brand collabs | 390K IG fam',
        content_types: ['Makeup tutorials', 'Skincare reviews', 'Beauty hauls', 'Get-ready-with-me'],
        posting_frequency: '5x per week',
        audience_demographics: {
          age_range: '18-32',
          primary_location: 'Lagos, Nigeria',
          interests: ['Beauty', 'Skincare', 'Makeup', 'Self-care'],
        },
        engagement_rate_estimate: 0.045,
        online_reputation: {
          positive_signals: ['Strong beauty niche credibility', 'High engagement in beauty category'],
          negative_signals: ['Zero food content history — cross-category risk is high', 'Audience follows exclusively for beauty content'],
          controversy_flags: [],
          summary: 'Successful beauty creator but entirely wrong category for Jara Foods. Collaboration would feel forced and likely damage brand perception.',
        },
        estimated_followers: { instagram: 390_000, tiktok: 210_000, twitter: 0, youtube: 0, total: 600_000 },
      },
      brand_fit: {
        score: 18,
        audience_overlap: 20,
        value_alignment: 'Very poor — beauty creator audience has no overlap with FMCG food purchase intent',
        risk_factors: ['Category mismatch will appear inauthentic to both beauty and food audiences', 'Risk of negative brand association from forced collaboration', 'Budget waste — wrong audience for Jara purchase funnel'],
        positive_indicators: ['Large reach could theoretically build awareness'],
        recommendation: 'poor_fit',
        recommendation_notes: 'Do not proceed. Category mismatch creates reputational risk without meaningful ROI. Reallocate budget to food-category creators.',
      },
    },
  ])

  /* ── 15. Competitor sightings ─────────────────────────────────────────── */
  await sb.from('competitor_sightings').insert([
    {
      brand_id: brandId, competitor_name: 'ChowMate',
      lat: 6.4698, lng: 3.5852, sighting_type: 'billboard',
      city: 'Lagos', state: 'Lagos',
      spotted_at: dAgo(12),
      description: 'ChowMate mega billboard at Lekki Toll Gate, 15m wide. "Taste the Difference" creative. Directly competing with our Lekki placement.',
    },
    {
      brand_id: brandId, competitor_name: 'ChowMate',
      lat: 6.5055, lng: 3.3576, sighting_type: 'activation',
      city: 'Lagos', state: 'Lagos',
      spotted_at: dAgo(18),
      description: 'ChowMate pop-up sampling stand at Adeniran Ogunsanya Mall. 2 ambassadors, ~200 samples distributed.',
    },
    {
      brand_id: brandId, competitor_name: 'ChowMate',
      lat: 9.0063, lng: 7.4631, sighting_type: 'billboard',
      city: 'Abuja', state: 'FCT',
      spotted_at: dAgo(30),
      description: 'ChowMate digital screen at Abuja Airport. High-footfall location. 6-week rotation running.',
    },
    {
      brand_id: brandId, competitor_name: 'NutriNg Foods',
      lat: 6.4281, lng: 3.4219, sighting_type: 'billboard',
      city: 'Lagos', state: 'Lagos',
      spotted_at: dAgo(45),
      description: 'NutriNg Foods small format banner at Ikeja City Mall. Limited budget play.',
    },
    {
      brand_id: brandId, competitor_name: 'ChowMate',
      lat: 6.6018, lng: 3.3515, sighting_type: 'activation',
      city: 'Lagos', state: 'Lagos',
      spotted_at: dAgo(7),
      description: 'ChowMate campus activation at UNILAG. Targeting Gen-Z. Free tasting + Spotify playlist collab. Smart cultural play — monitor closely.',
    },
  ])

  /* ── 16. Creative analyses ────────────────────────────────────────────── */
  await sb.from('creative_analyses').insert([
    {
      brand_id: brandId, asset_type: 'social_video',
      asset_url: 'https://jarafoods.com/assets/nourish-nigeria-hero-30s.mp4',
      cultural_resonance: 88.0, brand_consistency: 85.0,
      message_clarity: 82.0, emotional_impact: 91.0, cta_strength: 72.0,
      funnel_suitability: 'awareness', red_flags: [],
      recommendations: [
        'Add a Pidgin subtitle track for wider northern reach',
        '"Learn More" CTA underperforms on video — try "Find a Store" or "Shop Now"',
        'Music drop at 8s is a strong brand signature moment — protect in all cut-downs',
      ],
    },
    {
      brand_id: brandId, asset_type: 'ooh_static',
      asset_url: 'https://jarafoods.com/assets/summer-vibes-lekki.jpg',
      cultural_resonance: 79.0, brand_consistency: 90.0,
      message_clarity: 86.0, emotional_impact: 75.0, cta_strength: 68.0,
      funnel_suitability: 'awareness',
      red_flags: [{ flag: 'colour_contrast', detail: 'Yellow tagline on white falls below 3:1 contrast ratio beyond 30m viewing distance' }],
      recommendations: [
        'Switch yellow tagline to brand orange (#E8763E) on white for legibility',
        'Product shot occupies only 10% of billboard area — increase to 35–40%',
        'Lagos skyline background is strong — confirms local identity and cultural fit',
      ],
    },
  ])

  /* ── 17. Cultural resonance scores ───────────────────────────────────── */
  const crsSegments = [
    { segment: 'Lagos Millennials (25-40)',     crs: 82, auth: 88, lang: 85, vis: 79, sym: 83, comm: 80, drift: 'normal'  },
    { segment: 'Northern Mass Market',          crs: 64, auth: 72, lang: 55, vis: 68, sym: 70, comm: 58, drift: 'watch'   },
    { segment: 'Abuja Professional Diaspora',   crs: 74, auth: 78, lang: 80, vis: 72, sym: 68, comm: 76, drift: 'normal'  },
    { segment: 'South-East Traditional Market', crs: 58, auth: 65, lang: 48, vis: 62, sym: 60, comm: 55, drift: 'warning' },
  ]
  const crsInserts = []
  for (let m = 0; m < 6; m++) {
    for (const s of crsSegments) {
      const drift = m * 0.4
      crsInserts.push({
        brand_id: brandId, segment: s.segment, snapshot_date: dAgo(m * 30),
        crs:                +(s.crs  - drift + Math.sin(m * 0.8) * 1.2).toFixed(1),
        authenticity:       +(s.auth - drift * 0.5).toFixed(1),
        language_relevance: +(s.lang - drift * 0.3).toFixed(1),
        visual_rep:         +(s.vis  + drift * 0.2).toFixed(1),
        symbol_value:       +s.sym.toFixed(1),
        community_embed:    +(s.comm - drift * 0.4).toFixed(1),
        drift_flag:         s.drift,
      })
    }
  }
  await sb.from('cultural_resonance_scores').insert(crsInserts)

  /* ── 18. Social posts ─────────────────────────────────────────────────── */
  const postData = [
    { c: '🍚 Good food starts with great ingredients. Jara Rice gives your jollof the lift it deserves. #JaraFoods #NaijaFood',  fs: 'awareness',     p: 'instagram', li: 4821, co: 312, sh: 891, er: 5.8, ai: 88, d: 8,   cmp: camp3Id },
    { c: 'Community is everything. Thank you Abuja for showing up for the Jara Community Kitchen! ❤️ #JaraCommunityKitchen',     fs: 'advocacy',      p: 'instagram', li: 7432, co: 623, sh: 1204, er: 8.2, ai: 94, d: 62,  cmp: camp2Id },
    { c: 'The Nourish Nigeria Festival is LIVE 🎉 Over 2,000 of you showed up. We are moved. #NourishNigeria',                   fs: 'advocacy',      p: 'twitter',   li: 12800, co: 892, sh: 3200, er: 12.1, ai: 96, d: 218, cmp: camp1Id },
    { c: 'Summer is here and Jara Chilled is the answer 🌊☀️ Find us at stores near you. #JaraSummerVibes',                     fs: 'consideration', p: 'instagram', li: 2341, co: 187, sh: 421, er: 3.8, ai: 72, d: 5,   cmp: camp3Id },
    { c: 'Breakfast sorted. Jara Oats, 5 minutes, done. What\'s your morning routine? 🫶',                                       fs: 'consideration', p: 'instagram', li: 3102, co: 289, sh: 542, er: 4.9, ai: 81, d: 20,  cmp: camp2Id },
    { c: 'Every pack of Jara is made with one goal: nourishing Nigerian families. 🫶🇳🇬 #JaraFoods',                            fs: 'awareness',     p: 'twitter',   li: 5610, co: 441, sh: 1120, er: 6.3, ai: 85, d: 35,  cmp: camp1Id },
    { c: 'Reconnect with the taste of home. Jara Spice Mix brings it all together. Link in bio to shop. 👆',                     fs: 'action',        p: 'instagram', li: 1892, co: 142, sh: 318, er: 3.2, ai: 76, d: 70,  cmp: camp2Id },
    { c: 'Your jollof deserves the best foundation. Jara Long Grain Rice — always consistent. 🍛',                               fs: 'preference',    p: 'instagram', li: 6233, co: 512, sh: 980, er: 7.1, ai: 89, d: 45,  cmp: camp1Id },
  ]

  const postInserts = postData.map((p, i) => ({
    brand_id:             brandId,
    platform:             p.p,
    external_id:          `jara-post-${i + 1}`,
    content:              p.c,
    content_type:         i % 3 === 0 ? 'video' : 'image',
    reach:                Math.round((p.li + p.co + p.sh) * 8),
    impressions:          Math.round((p.li + p.co + p.sh) * 15),
    likes: p.li, comments: p.co, shares: p.sh,
    saves:                Math.round(p.li * 0.12),
    video_views:          i % 3 === 0 ? Math.round(p.li * 2.4) : 0,
    engagement_rate:      p.er,
    funnel_stage:         p.fs,
    campaign_id:          p.cmp,
    sentiment_score:      +(p.ai * 0.9).toFixed(1),
    sentiment_label:      p.ai > 80 ? 'positive' : 'neutral',
    emotion_tags:         p.ai > 85 ? ['joy', 'trust'] : ['anticipation', 'trust'],
    language_tag:         'en',
    ai_performance_score: p.ai,
    ai_diagnosis:         p.ai > 85
      ? 'High cultural relevance. Authentic Naija voice driving strong organic sharing.'
      : 'Solid performance. More community-centric framing could lift engagement.',
    posted_at:            tsAgo(p.d, 9 + (i % 10)),
  }))
  await sb.from('social_posts').insert(postInserts)

  /* ── 19. Pre-post analyses ────────────────────────────────────────────── */
  await sb.from('pre_post_analyses').insert([
    {
      brand_id: brandId, created_by: userId,
      content_text: 'Jara Chilled. Hot weather. Cool choice. Find it near you. #JaraSummerVibes',
      platform: 'instagram', target_segment: 'Lagos Millennials (25-40)',
      funnel_goal: 'awareness',
      engagement_score: 74, cultural_score: 78, tone_score: 80, clarity_score: 85, risk_score: 12,
      risk_flags: [],
      verdict: 'Approve with minor revisions',
      improvements: ['Add product visual — text-only posts underperform on Instagram', 'Include a location tag for Lagos stores'],
      suggested_rewrite: 'The heat is real. Jara Chilled is realer. 🥤 Find your nearest store → link in bio. #JaraSummerVibes #LagosLife',
    },
    {
      brand_id: brandId, created_by: userId,
      content_text: 'ChowMate who? Jara Foods has been nourishing Nigeria since before your brand was born. 😤',
      platform: 'twitter', target_segment: 'Lagos Millennials (25-40)',
      funnel_goal: 'preference',
      engagement_score: 65, cultural_score: 60, tone_score: 30, clarity_score: 75, risk_score: 72,
      risk_flags: [{ type: 'brand_risk', detail: 'Directly naming a competitor is legally and reputationally risky in Nigerian market' }, { type: 'tone_risk', detail: 'Aggressive tone contradicts "warm, community-first" brand voice' }],
      verdict: 'Reject — do not publish',
      improvements: ['Never name competitors in public posts', 'Lead with Jara\'s strengths, not competitor weaknesses', 'Stay warm — aggression alienates the community-first audience'],
      suggested_rewrite: 'Over 20 years of nourishing Nigerian families and counting. Some things only get better with time. 🫶 #JaraFoods',
    },
    {
      brand_id: brandId, created_by: userId,
      content_text: 'Sallah is almost here. Cook with Jara and make it unforgettable for your family. ✨ #EidMubarak',
      platform: 'instagram', target_segment: 'Northern Mass Market',
      funnel_goal: 'consideration',
      engagement_score: 88, cultural_score: 91, tone_score: 88, clarity_score: 82, risk_score: 8,
      risk_flags: [],
      verdict: 'Approve — strong cultural fit',
      improvements: ['Add Hausa subtitle for northern reach', 'Feature a family cooking visual, not just product shot'],
      suggested_rewrite: null,
    },
  ])

  /* ── 20. Crawl runs ───────────────────────────────────────────────────── */
  await sb.from('crawl_runs').insert(
    Array.from({ length: 10 }, (_, i) => ({
      brand_id:       brandId,
      trigger_type:   i % 3 === 0 ? 'manual' : 'cron',
      status:         'done',
      mentions_found: 20 + Math.round(Math.abs(Math.sin(i * 1.3)) * 16),
      classified:     18 + Math.round(Math.abs(Math.sin(i * 1.3)) * 14),
      started_at:     tsAgo(i * 3, 6),
      completed_at:   tsAgo(i * 3, 6),
    }))
  )

  /* ── 21. Weekly briefings ─────────────────────────────────────────────── */
  const briefings = [
    { daysBack: 28, summary: 'Reconnect campaign nearing completion. Sentiment at 71/100. ChowMate UNILAG activation flagged — recommend Gen-Z counter-narrative.' },
    { daysBack: 21, summary: 'Summer Vibes pre-launch. OOH placements confirmed. @chefkemisola seeding driving Instagram saves above benchmark.' },
    { daysBack: 14, summary: 'Campaign launch week. Lekki + Surulere OOH live. Early Meta signals positive — 4.1% CTR on awareness creative.' },
    { daysBack:  7, summary: 'Week 2 of Summer Vibes. Sentiment at 73/100, above 90-day average. ChowMate Lekki counter-placement confirmed.' },
  ]
  for (const b of briefings) {
    await sb.from('weekly_briefings').insert({
      brand_id: brandId, week_start: dAgo(b.daysBack),
      content: {
        summary:           b.summary,
        top_wins:          ['Sentiment above 90-day average', 'Influencer content outperforming paid 3:1'],
        watch_items:       ['ChowMate OOH expansion in Lagos', 'Northern distribution gap widening'],
        ai_recommendation: 'Maintain momentum on digital while leveraging OOH halo for brand health. Prioritise NPS follow-up with event leads.',
        sentiment_change:  2.3,
        bhi_change:        1.1,
      },
      sent_at: tsAgo(b.daysBack - 1, 9),
    })
  }

  /* ── 22. AI conversation sample ───────────────────────────────────────── */
  await sb.from('ai_conversations').insert({
    brand_id: brandId, user_id: userId,
    messages: [
      {
        role: 'user',
        content: 'Why did our sentiment drop so sharply in October 2025?',
        timestamp: tsAgo(30),
      },
      {
        role: 'assistant',
        content: 'The October 2025 dip (65 → 48 over 30 days) aligns with ChowMate\'s "Festive Blitz" campaign that launched October 3rd. Three factors drove it:\n\n**1. Share of voice collapse.** ChowMate increased paid social spend by ~340% that month, dominating FMCG conversation. Jara\'s blended SOV fell from 22% to 14%.\n\n**2. Price perception hit.** ChowMate introduced a -18% promotional price during school resumption — exactly when your audience is budget-sensitive. Mentions linking "Jara" and "too expensive" peaked in week 2 of October.\n\n**3. Distribution noise amplified.** Two Twitter threads about Jara stockouts in Kano and Maiduguri went semi-viral (~180K combined impressions), layering negative sentiment on top of the competitive pressure.\n\nThe recovery from November was driven by the Nourish Nigeria campaign, which successfully reanchored Jara around community and authenticity. The Lagos festival alone generated 3.4M social impressions at 89% positive sentiment.',
        timestamp: tsAgo(30),
      },
      {
        role: 'user',
        content: 'What should we do if ChowMate runs another aggressive campaign this October?',
        timestamp: tsAgo(29),
      },
      {
        role: 'assistant',
        content: 'Three defensive plays, ranked by impact:\n\n**1. Pre-empt with a cultural moment.** Jara\'s cultural IQ is your moat. Own Sallah (late Sept) and October 1 Independence Day before ChowMate can fill that space. Brief @chefkemisola and @foodie_naija now for Q3 content — exclusivity windows are critical.\n\n**2. Lock down distribution visibility.** The October 2025 stockout threads did outsized damage. Work with your supply team to ensure Kano, Maiduguri and Ibadan are fully stocked by September 15. A visible stockout during a competitor blitz is a multiplier.\n\n**3. Activate your promoter base.** You currently have 57% promoters in NPS. Build a micro-advocacy programme — send promoters shareable content packs and limited-edition products pre-October. Your best defence against paid SOV is genuine community voice.',
        timestamp: tsAgo(29),
      },
    ],
    sources_cited: [
      { type: 'sentiment_daily',  period: 'Oct 2025',  rows: 31 },
      { type: 'sov_snapshots',    period: 'Q4 2025',   rows: 12 },
      { type: 'mentions',         keyword: 'ChowMate', count: 8  },
      { type: 'nps_records',      period: 'Q2 2026',   rows: 100 },
    ],
  })

  /* ── 23. TV channels + schedules ─────────────────────────────────────── */
  const tvChannelInserts = [
    { name: 'NTA 1',             type: 'fta_national',  platform: 'Free-to-air', reach_prime: 4_200_000, reach_day: 1_800_000 },
    { name: 'Channels TV',       type: 'fta_national',  platform: 'Free-to-air', reach_prime: 3_100_000, reach_day: 1_200_000 },
    { name: 'TVC',               type: 'fta_regional',  platform: 'Free-to-air', reach_prime: 1_900_000, reach_day:   700_000 },
    { name: 'Africa Magic Family', type: 'pay_tv',       platform: 'DSTV',        reach_prime: 2_800_000, reach_day:   900_000 },
    { name: 'Wazobia Max',       type: 'pay_tv',         platform: 'GOtv',        reach_prime: 1_400_000, reach_day:   450_000 },
  ]

  const { data: existingTvCh } = await sb.from('tv_channels').select('id, name').in('name', tvChannelInserts.map(c => c.name))
  const existingTvNames = new Set((existingTvCh ?? []).map(c => c.name))
  const tvChToInsert = tvChannelInserts.filter(c => !existingTvNames.has(c.name))
  if (tvChToInsert.length) await sb.from('tv_channels').insert(tvChToInsert)
  const { data: tvChRows } = await sb.from('tv_channels').select('id, name').in('name', tvChannelInserts.map(c => c.name))
  const tvChMap: Record<string, string> = {}
  for (const r of tvChRows ?? []) tvChMap[r.name] = r.id

  const tvSpots = [
    { ch: 'Channels TV', prog: 'Morning Brief',        dp: 'breakfast',    dOff: 3,  dur: 30, sp: 2, sa: 2, grpP: 4.8,  grpD: 4.6,  cost: 620_000,  st: 'aired'     },
    { ch: 'Africa Magic Family', prog: 'Home & Family',dp: 'prime_time',   dOff: 5,  dur: 30, sp: 3, sa: 3, grpP: 9.2,  grpD: 9.0,  cost: 2_100_000,st: 'aired'     },
    { ch: 'NTA 1',       prog: 'NTA Network News',     dp: 'prime_time',   dOff: 8,  dur: 30, sp: 2, sa: 2, grpP: 8.0,  grpD: 7.8,  cost: 1_500_000,st: 'aired'     },
    { ch: 'TVC',         prog: 'Lunch Break',          dp: 'daytime',      dOff: 12, dur: 15, sp: 3, sa: 3, grpP: 3.5,  grpD: 3.4,  cost: 420_000,  st: 'aired'     },
    { ch: 'Wazobia Max', prog: 'Comedy Night',         dp: 'prime_time',   dOff: 15, dur: 30, sp: 2, sa: 1, grpP: 5.1,  grpD: 2.6,  cost: 780_000,  st: 'make_good' },
    { ch: 'Channels TV', prog: 'Business Morning',     dp: 'breakfast',    dOff: 18, dur: 30, sp: 2, sa: 2, grpP: 4.5,  grpD: 4.5,  cost: 620_000,  st: 'aired'     },
    { ch: 'Africa Magic Family', prog: 'Telenovela Tue',dp:'prime_time',   dOff: 22, dur: 30, sp: 3, sa: 3, grpP: 10.1, grpD: 10.0, cost: 2_100_000,st: 'aired'     },
    { ch: 'NTA 1',       prog: 'Midday News',          dp: 'daytime',      dOff: 26, dur: 15, sp: 2, sa: 2, grpP: 3.2,  grpD: 3.1,  cost: 480_000,  st: 'aired'     },
    { ch: 'TVC',         prog: 'Drive Time',           dp: 'early_fringe', dOff: 30, dur: 30, sp: 2, sa: 0, grpP: 4.0,  grpD: 0,    cost: 560_000,  st: 'scheduled' },
    { ch: 'Channels TV', prog: 'Sunrise Daily',        dp: 'breakfast',    dOff: 45, dur: 30, sp: 3, sa: 3, grpP: 4.8,  grpD: 4.8,  cost: 930_000,  st: 'aired'     },
    { ch: 'NTA 1',       prog: 'NTA Sports',           dp: 'late_fringe',  dOff: 50, dur: 15, sp: 2, sa: 2, grpP: 2.8,  grpD: 2.7,  cost: 350_000,  st: 'aired'     },
    { ch: 'Africa Magic Family', prog: 'Weekend Movie', dp: 'prime_time',  dOff: 58, dur: 30, sp: 3, sa: 3, grpP: 11.2, grpD: 11.0, cost: 2_100_000,st: 'aired'     },
  ]

  await sb.from('tv_schedules').insert(tvSpots.map(s => ({
    brand_id:       brandId,
    campaign_id:    camp3Id,
    channel_id:     tvChMap[s.ch] ?? null,
    channel_name:   s.ch,
    programme:      s.prog,
    daypart:        s.dp,
    spot_date:      dAgo(s.dOff),
    duration_sec:   s.dur,
    spots_planned:  s.sp,
    spots_aired:    s.sa,
    grp_planned:    s.grpP,
    grp_delivered:  s.grpD,
    net_cost:       s.cost,
    currency:       'NGN',
    status:         s.st,
    material_name:  'Jara Nourish Nigeria :30s',
  })))

  /* ── 24. Radio stations + schedules ──────────────────────────────────── */
  const radioStationInserts = [
    { name: 'Beat 99.9 FM', frequency: '99.9 FM', city: 'Lagos',  state: 'Lagos',  reach_am: 420_000, reach_pm: 380_000, reach_day: 190_000, network: 'Beat FM',    is_national: false },
    { name: 'Cool FM 96.9', frequency: '96.9 FM', city: 'Lagos',  state: 'Lagos',  reach_am: 510_000, reach_pm: 470_000, reach_day: 210_000, network: 'Cool FM',    is_national: true  },
    { name: 'Wazobia FM Lagos', frequency: '94.1 FM', city: 'Lagos', state: 'Lagos', reach_am: 680_000, reach_pm: 590_000, reach_day: 310_000, network: 'Wazobia', is_national: true  },
    { name: 'Naija FM',     frequency: '102.7 FM',city: 'Lagos',  state: 'Lagos',  reach_am: 290_000, reach_pm: 260_000, reach_day: 140_000, network: 'Naija FM',   is_national: false },
    { name: 'Smooth FM 98.1', frequency: '98.1 FM', city: 'Lagos', state: 'Lagos', reach_am: 320_000, reach_pm: 300_000, reach_day: 160_000, network: 'Smooth FM', is_national: false },
    { name: 'Rhythm FM Abuja', frequency: '93.7 FM', city: 'Abuja', state: 'FCT', reach_am: 180_000, reach_pm: 160_000, reach_day:  80_000, network: 'Rhythm FM',  is_national: false },
  ]

  const { data: existingRs } = await sb.from('radio_stations').select('id, name').in('name', radioStationInserts.map(s => s.name))
  const existingRsNames = new Set((existingRs ?? []).map(s => s.name))
  const rsToInsert = radioStationInserts.filter(s => !existingRsNames.has(s.name))
  if (rsToInsert.length) await sb.from('radio_stations').insert(rsToInsert)
  const { data: rsRows } = await sb.from('radio_stations').select('id, name').in('name', radioStationInserts.map(s => s.name))
  const rsMap: Record<string, string> = {}
  for (const r of rsRows ?? []) rsMap[r.name] = r.id

  const radioSpots = [
    { stn: 'Cool FM 96.9',     dp: 'morning_drive',   dOff: 2,  dur: 30, sp: 3, sa: 3, rc: 350_000, nc: 315_000, st: 'aired'     },
    { stn: 'Wazobia FM Lagos', dp: 'morning_drive',   dOff: 3,  dur: 30, sp: 5, sa: 5, rc: 210_000, nc: 189_000, st: 'aired'     },
    { stn: 'Beat 99.9 FM',     dp: 'evening',         dOff: 5,  dur: 30, sp: 3, sa: 3, rc: 280_000, nc: 252_000, st: 'aired'     },
    { stn: 'Smooth FM 98.1',   dp: 'daytime',         dOff: 7,  dur: 15, sp: 4, sa: 4, rc: 160_000, nc: 144_000, st: 'aired'     },
    { stn: 'Naija FM',         dp: 'morning_drive',   dOff: 10, dur: 30, sp: 3, sa: 3, rc: 190_000, nc: 171_000, st: 'aired'     },
    { stn: 'Rhythm FM Abuja',  dp: 'morning_drive',   dOff: 12, dur: 30, sp: 3, sa: 2, rc: 120_000, nc: 108_000, st: 'make_good' },
    { stn: 'Cool FM 96.9',     dp: 'afternoon_drive', dOff: 15, dur: 30, sp: 4, sa: 4, rc: 300_000, nc: 270_000, st: 'aired'     },
    { stn: 'Wazobia FM Lagos', dp: 'evening',         dOff: 18, dur: 30, sp: 5, sa: 5, rc: 200_000, nc: 180_000, st: 'aired'     },
    { stn: 'Beat 99.9 FM',     dp: 'morning_drive',   dOff: 22, dur: 30, sp: 3, sa: 3, rc: 280_000, nc: 252_000, st: 'aired'     },
    { stn: 'Cool FM 96.9',     dp: 'morning_drive',   dOff: 30, dur: 30, sp: 3, sa: 3, rc: 350_000, nc: 315_000, st: 'aired'     },
    { stn: 'Wazobia FM Lagos', dp: 'morning_drive',   dOff: 35, dur: 30, sp: 5, sa: 5, rc: 210_000, nc: 189_000, st: 'aired'     },
    { stn: 'Smooth FM 98.1',   dp: 'early_morning',   dOff: 40, dur: 15, sp: 3, sa: 3, rc: 130_000, nc: 117_000, st: 'aired'     },
    { stn: 'Naija FM',         dp: 'late_night',      dOff: 45, dur: 30, sp: 2, sa: 0, rc: 90_000,  nc: 81_000,  st: 'scheduled' },
  ]

  await sb.from('radio_schedules').insert(radioSpots.map(s => ({
    brand_id:       brandId,
    campaign_id:    camp1Id,
    station_id:     rsMap[s.stn] ?? null,
    station_name:   s.stn,
    daypart:        s.dp,
    spot_date:      dAgo(s.dOff),
    duration_sec:   s.dur,
    spots_planned:  s.sp,
    spots_aired:    s.sa,
    rate_card:      s.rc,
    net_cost:       s.nc,
    currency:       'NGN',
    status:         s.st,
    material_name:  'Jara "Cook Better" :30s',
  })))

  /* ── 25. Print publications + placements ──────────────────────────────── */
  const printPubInserts = [
    { name: 'The Punch',   type: 'newspaper',     circulation: 80_000,  readership_mult: 4.5, primary_demo: 'mass market' },
    { name: 'Vanguard',    type: 'newspaper',     circulation: 65_000,  readership_mult: 4.2, primary_demo: 'mass market' },
    { name: 'BusinessDay', type: 'newspaper',     circulation: 35_000,  readership_mult: 2.8, primary_demo: 'business/professional' },
    { name: 'The Nation',  type: 'newspaper',     circulation: 50_000,  readership_mult: 4.0, primary_demo: 'mass market' },
    { name: 'TW Magazine', type: 'magazine',      circulation: 22_000,  readership_mult: 5.5, primary_demo: 'youth' },
    { name: 'City People', type: 'magazine',      circulation: 45_000,  readership_mult: 6.0, primary_demo: 'mass market' },
  ]

  const { data: existingPubs } = await sb.from('print_publications').select('id, name').in('name', printPubInserts.map(p => p.name))
  const existingPubNames = new Set((existingPubs ?? []).map(p => p.name))
  const pubsToInsert = printPubInserts.filter(p => !existingPubNames.has(p.name))
  if (pubsToInsert.length) await sb.from('print_publications').insert(pubsToInsert)
  const { data: pubRows } = await sb.from('print_publications').select('id, name').in('name', printPubInserts.map(p => p.name))
  const pubMap: Record<string, string> = {}
  for (const r of pubRows ?? []) pubMap[r.name] = r.id

  await sb.from('print_placements').insert([
    { brand_id: brandId, campaign_id: camp3Id, publication_id: pubMap['The Punch'],   publication_name: 'The Punch',   edition_date: dAgo(5),  position: 'back_page',    size: 'full_page',    colour: 'full_colour', rate_card: 1_800_000, discount_pct: 10, net_cost: 1_620_000, insertions: 1, currency: 'NGN', status: 'published', qr_scan_count: 142, vanity_slug: 'jara-punch-jun', attribution_url: 'https://jarafoods.com/nourish' },
    { brand_id: brandId, campaign_id: camp3Id, publication_id: pubMap['Vanguard'],    publication_name: 'Vanguard',    edition_date: dAgo(8),  position: 'page_3',       size: 'full_page',    colour: 'full_colour', rate_card: 1_400_000, discount_pct: 10, net_cost: 1_260_000, insertions: 1, currency: 'NGN', status: 'published', qr_scan_count: 89,  vanity_slug: 'jara-vanguard-jun', attribution_url: 'https://jarafoods.com/nourish' },
    { brand_id: brandId, campaign_id: camp1Id, publication_id: pubMap['TW Magazine'], publication_name: 'TW Magazine', edition_date: dAgo(15), position: 'centrespread',  size: 'full_page',    colour: 'full_colour', rate_card: 900_000,  discount_pct: 15, net_cost:   765_000, insertions: 1, currency: 'NGN', status: 'published', qr_scan_count: 211, vanity_slug: 'jara-tw-may', attribution_url: 'https://jarafoods.com/summer' },
    { brand_id: brandId, campaign_id: camp2Id, publication_id: pubMap['BusinessDay'], publication_name: 'BusinessDay', edition_date: dAgo(22), position: 'rop_interior',  size: 'half_page',    colour: 'full_colour', rate_card: 850_000,  discount_pct: 0,  net_cost:   850_000, insertions: 1, currency: 'NGN', status: 'published', qr_scan_count: 34,  vanity_slug: 'jara-bd-may', attribution_url: 'https://jarafoods.com/reconnect' },
    { brand_id: brandId, campaign_id: camp1Id, publication_id: pubMap['The Punch'],   publication_name: 'The Punch',   edition_date: dAgo(30), position: 'front_page',   size: 'strip',        colour: 'full_colour', rate_card: 600_000,  discount_pct: 10, net_cost:   540_000, insertions: 3, currency: 'NGN', status: 'published', qr_scan_count: 318, vanity_slug: 'jara-punch-may', attribution_url: 'https://jarafoods.com/nourish' },
    { brand_id: brandId, campaign_id: camp1Id, publication_id: pubMap['City People'], publication_name: 'City People', edition_date: dAgo(38), position: 'rop_interior',  size: 'full_page',    colour: 'full_colour', rate_card: 750_000,  discount_pct: 5,  net_cost:   712_500, insertions: 1, currency: 'NGN', status: 'published', qr_scan_count: 167, vanity_slug: 'jara-cp-may', attribution_url: 'https://jarafoods.com/nourish' },
    { brand_id: brandId, campaign_id: camp2Id, publication_id: pubMap['The Nation'],  publication_name: 'The Nation',  edition_date: dAgo(45), position: 'back_page',    size: 'half_page',    colour: 'full_colour', rate_card: 1_200_000,discount_pct: 10, net_cost: 1_080_000, insertions: 1, currency: 'NGN', status: 'published', qr_scan_count: 72,  vanity_slug: 'jara-nation-apr', attribution_url: 'https://jarafoods.com/reconnect' },
    { brand_id: brandId, campaign_id: camp2Id, publication_id: pubMap['Vanguard'],    publication_name: 'Vanguard',    edition_date: dAgo(60), position: 'rop_interior',  size: 'quarter_page', colour: 'black_white', rate_card: 350_000,  discount_pct: 15, net_cost:   297_500, insertions: 2, currency: 'NGN', status: 'published', qr_scan_count: 28,  vanity_slug: 'jara-van-apr', attribution_url: 'https://jarafoods.com/reconnect' },
  ])

  /* ── 26. Geo-Lift studies ─────────────────────────────────────────────── */
  const makeWeekly = (weeks: number, baseT: number, baseC: number, liftPct: number) =>
    Array.from({ length: weeks }, (_, i) => ({
      week: dAgo((weeks - i) * 7),
      treatment_index: Math.round(baseT + (liftPct * i / weeks) * baseT * 0.01 + Math.sin(i * 0.9) * 2),
      control_index:   Math.round(baseC + Math.sin(i * 1.1) * 1.5),
    }))

  await sb.from('geo_lift_studies').insert([
    {
      brand_id:          brandId,
      campaign_id:       camp3Id,
      treatment_city:    'Lagos',
      control_city:      'Ibadan',
      keyword:           'Jara Foods',
      study_start:       dAgo(84),
      study_end:         dAgo(14),
      lift_pct:          18.4,
      confidence:        94.2,
      correlation:       0.8812,
      status:            'complete',
      weekly_data:       makeWeekly(10, 78, 55, 18.4),
      ai_interpretation: 'The Nourish Nigeria campaign produced significant incremental search uplift in Lagos (+18.4%) vs the Ibadan control market. The lift signal is strongest in weeks 4-7, correlating with the peak of OOH and TV spend. 94% confidence confirms this is above statistical noise. Estimated 14,000 incremental branded searches attributable to the campaign.',
    },
    {
      brand_id:          brandId,
      campaign_id:       camp1Id,
      treatment_city:    'Abuja',
      control_city:      'Kaduna',
      keyword:           'Jara Rice',
      study_start:       dAgo(120),
      study_end:         dAgo(50),
      lift_pct:          11.2,
      confidence:        87.8,
      correlation:       0.8240,
      status:            'complete',
      weekly_data:       makeWeekly(10, 52, 44, 11.2),
      ai_interpretation: 'Abuja market showed 11.2% incremental brand search uplift for "Jara Rice" during the Reconnect campaign. TV and radio were the primary drivers — OOH contributed less at this stage. Confidence at 87.8% is strong but below the 90% threshold. Recommend extending the next Abuja study by 2 additional weeks for higher confidence.',
    },
    {
      brand_id:          brandId,
      campaign_id:       camp2Id,
      treatment_city:    'Port Harcourt',
      control_city:      'Enugu',
      keyword:           'Jara Foods',
      study_start:       dAgo(45),
      study_end:         dAgo(5),
      lift_pct:          7.3,
      confidence:        81.1,
      correlation:       0.7690,
      status:            'complete',
      weekly_data:       makeWeekly(6, 38, 35, 7.3),
      ai_interpretation: 'Moderate but statistically meaningful lift in Port Harcourt (+7.3%). Spend levels in this market were 40% below Lagos — the lift-to-spend ratio is actually superior, suggesting PH is an under-invested high-ROI market. Recommend increasing budget allocation here in Q3.',
    },
  ])

  /* ── 27. Press mentions (PR tracking) ────────────────────────────────── */
  const pressMentions = [
    { headline: 'Jara Foods Launches "Nourish Nigeria" Campaign Targeting 5 Million Families', publication: 'The Punch', url: 'https://punchng.com/jara-nourish-nigeria-campaign', pub_date: dAgo(2),  sent_score: 0.82, sent_label: 'positive', reach: 280_000, emv: 1_540_000, is_comp: false, comp: null,       snippet: 'Jara Foods has launched an ambitious campaign to reach five million Nigerian families with its premium food products, investing over ₦500 million in a 90-day ATL push.' },
    { headline: 'Jara Community Kitchen Initiative Gets Thumbs-Up from Lagos Residents', publication: 'Vanguard', url: 'https://vanguardngr.com/jara-community-kitchen', pub_date: dAgo(8),  sent_score: 0.91, sent_label: 'positive', reach: 240_000, emv: 1_320_000, is_comp: false, comp: null,       snippet: 'The Jara Community Kitchen pop-up, which visited five LGAs in Lagos over two weeks, fed over 8,000 residents and generated significant goodwill for the brand.' },
    { headline: 'FMCG Brands Double Down on TV Spend as Digital Costs Rise', publication: 'BusinessDay', url: 'https://businessday.ng/fmcg-tv-spend-2026', pub_date: dAgo(12), sent_score: 0.10, sent_label: 'neutral',  reach: 85_000,  emv:   468_000, is_comp: false, comp: null,       snippet: 'Brands including Jara Foods, NutriNg, and ChowMate have increased TV and radio allocations by 30% as social media CPMs climb above ₦3,000.' },
    { headline: 'ChowMate Raises $8M Series B, Plans Nationwide Expansion', publication: 'TechCabal', url: 'https://techcabal.com/chowmate-series-b-2026', pub_date: dAgo(15), sent_score: 0.65, sent_label: 'positive', reach: 120_000, emv:   660_000, is_comp: true,  comp: 'ChowMate', snippet: 'ChowMate, the food-tech challenger brand, announced an $8M Series B round to expand distribution to 12 new states and launch a loyalty programme targeting 500,000 users.' },
    { headline: 'Jara Foods Wins Nigeria Food Brand of the Year Award', publication: 'The Nation', url: 'https://thenationonlineng.net/jara-brand-award-2026', pub_date: dAgo(18), sent_score: 0.95, sent_label: 'positive', reach: 190_000, emv: 1_045_000, is_comp: false, comp: null,       snippet: 'For the third consecutive year, Jara Foods has been recognised as Nigeria\'s most loved food brand, citing its community-first approach and consistent product quality.' },
    { headline: 'Jara Rice Shortage Reported in Kano, Maiduguri — Distributors Speak Out', publication: 'Daily Trust', url: 'https://dailytrust.com/jara-rice-shortage-north', pub_date: dAgo(25), sent_score: -0.62, sent_label: 'negative', reach: 160_000, emv: -640_000, is_comp: false, comp: null,       snippet: 'Distributors in Kano and Maiduguri have reported stockouts of Jara Long Grain Rice, with some noting gaps of up to two weeks. The brand has not responded publicly.' },
    { headline: 'NutriNg Foods Expands to School Feeding Programme with Federal Contract', publication: 'The Punch', url: 'https://punchng.com/nutring-school-feeding', pub_date: dAgo(28), sent_score: 0.70, sent_label: 'positive', reach: 260_000, emv:   910_000, is_comp: true,  comp: 'NutriNg Foods', snippet: 'NutriNg Foods has secured a federal government school feeding contract covering 3 states, displacing established FMCG players in the institutional segment.' },
    { headline: 'How Jara Foods Is Using AI to Track Brand Health in Real Time', publication: 'Techpoint Africa', url: 'https://techpoint.africa/jara-foods-brand-health-ai', pub_date: dAgo(32), sent_score: 0.88, sent_label: 'positive', reach: 95_000,  emv:   522_500, is_comp: false, comp: null,       snippet: 'Jara Foods marketing director shared insights on how the brand uses real-time sentiment tracking and Share of Voice analysis to make faster campaign decisions.' },
    { headline: 'ChowMate\'s "Taste the Difference" OOH Blitz Divides Lagos Opinion', publication: 'BellaNaija', url: 'https://bellanaija.com/chowmate-ooh-lagos', pub_date: dAgo(38), sent_score: -0.20, sent_label: 'neutral',  reach: 320_000, emv:  -64_000, is_comp: true,  comp: 'ChowMate', snippet: 'ChowMate\'s aggressive billboard spend at Lekki Toll Gate and Ikeja has been noticed, but brand sentiment among focus groups remains mixed — consumers question whether quality matches the bold claims.' },
    { headline: 'Jara Summer Vibes Campaign Drives 22% Sales Uplift in Lagos', publication: 'Marketing Edge', url: 'https://marketingedge.com.ng/jara-summer-vibes-uplift', pub_date: dAgo(42), sent_score: 0.89, sent_label: 'positive', reach: 45_000,  emv:   247_500, is_comp: false, comp: null,       snippet: 'Internal figures from Jara Foods show the Summer Vibes campaign drove a 22% sales uplift in Lagos trade channels during its 6-week run, with digital contributing 38% of attributed revenue.' },
    { headline: 'Northern Nigeria FMCG Market Heats Up as Brands Battle for Distribution', publication: 'Blueprint', url: 'https://blueprint.ng/fmcg-northern-nigeria-battle', pub_date: dAgo(50), sent_score: 0.05, sent_label: 'neutral',  reach: 80_000,  emv:    32_000, is_comp: false, comp: null,       snippet: 'Jara Foods, ChowMate and NutriNg are all ramping up northern Nigeria investment, with Kano and Abuja seen as key battlegrounds for the next three years.' },
    { headline: 'Jara Foods to Expand to East Africa — CEO Confirms 2027 Plans', publication: 'BusinessDay', url: 'https://businessday.ng/jara-east-africa-expansion', pub_date: dAgo(55), sent_score: 0.83, sent_label: 'positive', reach: 85_000,  emv:   467_500, is_comp: false, comp: null,       snippet: 'The CEO of Jara Foods confirmed at a Lagos business summit that the company intends to enter East Africa through Kenya and Ethiopia, leveraging the "Nourish" brand positioning.' },
  ]

  await sb.from('press_mentions').insert(pressMentions.map(m => ({
    brand_id:        brandId,
    headline:        m.headline,
    publication:     m.publication,
    url:             m.url,
    published_at:    m.pub_date,
    sentiment_score: m.sent_score,
    sentiment_label: m.sent_label,
    estimated_reach: m.reach,
    emv:             m.emv,
    mention_type:    'press' as const,
    is_competitor:   m.is_comp,
    competitor_name: m.comp,
    raw_snippet:     m.snippet,
    crawl_source:    'manual',
  })))

  /* ── Done ─────────────────────────────────────────────────────────────── */
  return NextResponse.json({
    success: true,
    credentials: {
      email:    DEMO_EMAIL,
      password: DEMO_PASSWORD,
      note:     'Login at /auth/login — the AI Command Layer works on all seeded data.',
    },
    brand:     'Jara Foods Ltd',
    workspace: 'Jara Foods (Pro plan)',
    seeded: {
      sentimentDays:       365,
      bhiSnapshots:        180,
      sovSnapshots:        Math.ceil(175 / 7),
      funnelSnapshots:     12,
      campaigns:           3,
      campaignChannels:    5,
      events:              2,
      eventInteractions:   60,
      oohSites:            8,
      oohVisits:           415,
      oohSearchUplift:     8,
      mentions:            mentionInserts.length,
      surveyResponses:     npsScores.length,
      npsRecords:          100,
      influencers:         8,
      competitorSightings: 5,
      creativeAnalyses:    2,
      culturalScores:      crsInserts.length,
      socialPosts:         postInserts.length,
      prePostAnalyses:     3,
      crawlRuns:           10,
      weeklyBriefings:     4,
      aiConversations:     1,
      tvChannels:          5,
      tvSpots:             12,
      radioStations:       6,
      radioSpots:          13,
      printPublications:   6,
      printPlacements:     8,
      geoLiftStudies:      3,
      pressMentions:       12,
    },
  })
}
