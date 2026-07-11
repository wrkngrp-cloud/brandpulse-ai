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
// Gated by the shared ADMIN_SECRET env var (fail closed if unset).
const SEED_SECRET   = process.env.ADMIN_SECRET
const BASE          = new Date()

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
   Header: x-seed-secret: <value of ADMIN_SECRET env var>
────────────────────────────────────────────────────────────────────────────*/

export async function POST(req: NextRequest) {
  if (!SEED_SECRET || req.headers.get('x-seed-secret') !== SEED_SECRET) {
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
    // Volume split across platforms (Instagram-heavy for Nigerian food brand)
    const igVol  = Math.round(120 + Math.sin(d * 0.3) * 20)
    const twVol  = Math.round(60  + Math.cos(d * 0.4) * 10)
    const tkVol  = Math.round(45  + Math.sin(d * 0.5) * 8)
    sentRows.push({
      brand_id: brandId, day: dAgo(d),
      social_score: score, offline_score: +(score * 0.92 + Math.sin(d) * 2).toFixed(1),
      blended_score: score,
      positive_pct: pos, neutral_pct: neu, negative_pct: neg,
      top_themes: themes,
      platform_breakdown: {
        instagram: { volume: igVol, score: +(score + Math.sin(d * 0.2) * 3).toFixed(1), positive_pct: pos, neutral_pct: neu, negative_pct: neg },
        twitter:   { volume: twVol, score: +(score - 2 + Math.cos(d * 0.3) * 2).toFixed(1), positive_pct: +(pos - 3).toFixed(1), neutral_pct: +(neu + 2).toFixed(1), negative_pct: +(neg + 1).toFixed(1) },
        tiktok:    { volume: tkVol, score: +(score + 4 + Math.sin(d * 0.6) * 2).toFixed(1), positive_pct: +(pos + 4).toFixed(1), neutral_pct: +(neu - 2).toFixed(1), negative_pct: +(neg - 2).toFixed(1) },
      },
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
        brand_volume:       Math.round(8000 + t * 4000),
        competitor_volumes: {
          'ChowMate':      Math.round(9000 - t * 2000),
          'NutriNg Foods': Math.round(3000 + Math.sin(d * 0.1) * 500),
        },
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
  type OohVisitRow = {
    site_id: string; brand_id: string; visited_at: string
    device_type: string; ip_region: string
    geo_lat?: number; geo_lng?: number; geo_city?: string; geo_state?: string
    matched_site_id?: string; attribution_method?: string; attribution_confidence?: number
  }
  const oohVisitInserts: OohVisitRow[] = []
  const visitDevices = ['mobile', 'mobile', 'mobile', 'desktop', 'tablet']
  const visitRegions = ['Lagos', 'Lagos', 'Abuja', 'Port Harcourt', 'Ibadan', 'Lagos', 'Kano']

  // Geo coordinates near each site (realistic variance within 2km)
  const siteGeo: Record<string, { lat: number; lng: number; city: string }> = {
    [lekkiId ?? '']:     { lat: 6.4700, lng: 3.5855, city: 'Lekki' },
    [surulereId ?? '']:  { lat: 6.5058, lng: 3.3578, city: 'Surulere' },
    [transcorpId ?? '']: { lat: 9.0728, lng: 7.4908, city: 'Abuja' },
    [oshodiId ?? '']:    { lat: 6.5540, lng: 3.3630, city: 'Oshodi' },
  }

  for (const { id: siteId, count, method } of [
    { id: lekkiId,     count: 120, method: 'branded_link'  as const },
    { id: surulereId,  count: 70,  method: 'branded_link'  as const },
    { id: transcorpId, count: 85,  method: 'geo_proximity' as const },
    { id: oshodiId,    count: 140, method: 'branded_link'  as const },
  ]) {
    if (!siteId) continue
    const geo = siteGeo[siteId]
    for (let i = 0; i < count; i++) {
      const hasGeo = geo && i % 5 !== 0  // 80% have geo data
      const geoVarianceLat = (Math.random() - 0.5) * 0.008  // ~±400m
      const geoVarianceLng = (Math.random() - 0.5) * 0.008
      oohVisitInserts.push({
        site_id:               siteId,
        brand_id:              brandId,
        visited_at:            tsAgo(i % 14, 7 + (i % 15)),
        device_type:           visitDevices[i % visitDevices.length],
        ip_region:             visitRegions[i % visitRegions.length],
        ...(hasGeo ? {
          geo_lat:              +(geo.lat + geoVarianceLat).toFixed(7),
          geo_lng:              +(geo.lng + geoVarianceLng).toFixed(7),
          geo_city:             geo.city,
          geo_state:            visitRegions[i % visitRegions.length],
          matched_site_id:      siteId,
          attribution_method:   method,
          attribution_confidence: method === 'branded_link' ? 0.95 : +(0.65 + Math.random() * 0.25).toFixed(2),
        } : {}),
      })
    }
  }
  if (oohVisitInserts.length > 0) await sb.from('ooh_visits').insert(oohVisitInserts)

  /* ── 11b2. Seed 1 demo geo-retargeting audience for the Lekki site ───────── */
  if (lekkiId) {
    await sb.from('ooh_geo_audiences').insert({
      brand_id: brandId, ooh_site_id: lekkiId,
      audience_name: 'Lekki Toll Gate — Meta Geo Retarget',
      platform: 'meta', fence_radius_m: 500, dwell_minutes: 5,
      creative_headline: 'You saw us at Lekki — shop Jara Rice now',
      creative_description: 'Get 5% off your first Jara order this week only.',
      estimated_reach: 18400,
      status: 'active', synced_at: tsAgo(5, 10),
    })
    await sb.from('ooh_geo_audiences').insert({
      brand_id: brandId, ooh_site_id: lekkiId,
      audience_name: 'Lekki Toll Gate — Google Display Retarget',
      platform: 'google', fence_radius_m: 1000, dwell_minutes: 3,
      creative_headline: 'The rice that nourishes Lagos families',
      estimated_reach: 24100,
      status: 'draft',
    })
  }

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
    { c: 'Jara Summer Vibes packaging is too cute abeg 😍 Just bought 2 packs of Jara Chilled at Shoprite.',   p: 'instagram', sl: 'positive', ss: 91, f: 4700,  d: 0  },
    { c: 'The Lekki billboard still dey give 🔥 Been seeing it every morning for weeks. Jara doing well.',      p: 'twitter',   sl: 'positive', ss: 84, f: 2300,  d: 1  },
    { c: 'Jara Summer Vibes campaign got me 😂 Bought Jara Chilled, tasted nothing like the advert. 7/10 sha', p: 'twitter',   sl: 'neutral',  ss: 62, f: 1800,  d: 2  },
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
      collected_at: tsAgo(Math.floor(i * 2.8), 9 + (i % 12)),
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

  // ── 13b. Perception audit survey + responses ─────────────────────────────
  // Absorbed from /api/demo/seed-perception — Brand Equity page works out of
  // the box after seeding without manual button clicks.
  const BASE_PERC: Record<string, number> = {
    q2: 4.0, // Quality
    q3: 4.5, // Trust
    q4: 3.5, // Innovation
    q5: 3.0, // Value
    q6: 4.0, // Cultural Relevance
    q7: 4.0, // Accessibility
    q8: 4.5, // Reliability
    q9: 3.5, // Emotional Connection
  }

  const { data: perceptionSurvey } = await sb.from('surveys').insert({
    brand_id: brandId,
    type:     'perception_audit',
    name:     'Brand Perception Audit Q2 2025',
    status:   'live',
  }).select('id').single()

  if (perceptionSurvey?.id) {
    const perceptionResponses = Array.from({ length: 15 }, (_, i) => {
      const answers: Record<string, number> = {
        // q1: familiarity 3-5 (deterministic)
        q1: Math.min(5, Math.max(3, 3 + Math.round(Math.abs(Math.sin(i * 2.1))))),
      }
      for (const [key, base] of Object.entries(BASE_PERC)) {
        const v = Math.sin(i * 3.7 + Number(key.slice(1)) * 0.9)  // -1 to 1
        answers[key] = Math.round(Math.min(5, Math.max(1, base + v * 0.5)) * 2) / 2
      }
      return {
        survey_id:    perceptionSurvey.id,
        answers,
        quality_flag: 'ok',
        collected_at: tsAgo(30 + i * 3, 9 + (i % 10)),
      }
    })
    await sb.from('survey_responses').insert(perceptionResponses)
  }

  // ── 13c. Awareness check survey + responses ──────────────────────────────
  // Absorbed from /api/demo/seed-nps (awareness half).
  const AWARENESS_SEED_ANSWERS = Array.from({ length: 20 }, (_, i) =>
    i < 16 ? 'Yes — I know them well' : 'I have heard of them'
  )

  const { data: awarenessSurvey } = await sb.from('surveys').insert({
    brand_id: brandId,
    type:     'awareness_check',
    name:     'Brand Awareness Check Q2 2025',
    status:   'live',
  }).select('id').single()

  if (awarenessSurvey?.id) {
    await sb.from('survey_responses').insert(
      AWARENESS_SEED_ANSWERS.map((answer, i) => ({
        survey_id:    awarenessSurvey.id,
        answers:      { q1: answer },
        quality_flag: 'ok',
        collected_at: tsAgo(60 + i * 4, 10 + (i % 8)),
      }))
    )
  }

  // ── 13d. Post-purchase NPS survey + responses ────────────────────────────
  // Absorbed from /api/demo/seed-nps (NPS half).
  // Realistic distribution: ~8 promoters (9-10), ~13 passives (7-8), ~4 detractors (0-6).
  const POST_NPS_SCORES: number[] = [
    10, 9, 9, 9, 10, 9, 8, 7, 8, 9,
    8,  7, 8, 8, 7,  9, 10, 7, 8, 9,
    6,  8, 7, 9, 8,
  ]

  const { data: postNpsSurvey } = await sb.from('surveys').insert({
    brand_id: brandId,
    type:     'post_purchase_nps',
    name:     'Customer NPS Survey Q2 2025',
    status:   'live',
  }).select('id').single()

  if (postNpsSurvey?.id) {
    await sb.from('survey_responses').insert(
      POST_NPS_SCORES.map((score, i) => ({
        survey_id:    postNpsSurvey.id,
        answers:      { q2: score },
        quality_flag: 'ok',
        collected_at: tsAgo(45 + Math.floor(i * 3), 9 + (i % 12)),
      }))
    )
  }

  // ── 13e. Survey tracking panels ──────────────────────────────────────────
  // Two demo panels: one live (Summer Vibes awareness) and one closed (Reconnect recall).
  const { data: panel1 } = await sb.from('survey_panels').insert({
    brand_id:         brandId,
    workspace_id:     wsId,
    name:             'Jara Summer Awareness Check',
    template_key:     'awareness_check',
    cadence:          'monthly',
    active:           true,
    last_run_at:      tsAgo(14, 9),
    next_run_at:      tsAgo(-16, 9),   // next run: ~16 days from now
    recipient_emails: ['temi@jarafoods.ng', 'marketing@jarafoods.ng'],
  }).select('id').single()

  // Link the seeded awareness_check survey back to this panel
  if (panel1?.id && awarenessSurvey?.id) {
    await sb.from('surveys').update({ panel_id: panel1.id, is_panel: true }).eq('id', awarenessSurvey.id)
  }

  const { data: panel2 } = await sb.from('survey_panels').insert({
    brand_id:         brandId,
    workspace_id:     wsId,
    name:             'Jara Reconnect Brand Recall',
    template_key:     'brand_recall',
    cadence:          'quarterly',
    active:           false,   // closed after Reconnect campaign
    last_run_at:      tsAgo(75, 9),
    recipient_emails: ['temi@jarafoods.ng'],
  }).select('id').single()

  // Create the closed brand-recall survey run linked to panel2
  if (panel2?.id) {
    const { data: recallSurvey } = await sb.from('surveys').insert({
      brand_id:  brandId,
      type:      'brand_recall',
      name:      'Jara Brand Recall — Q1 2026',
      status:    'closed',
      panel_id:  panel2.id,
      is_panel:  true,
    }).select('id').single()

    if (recallSurvey?.id) {
      const recallAnswers = [
        { q1: 'Jara Foods',  q2: 'Jara Rice',      q3: 'TV advertising'      },
        { q1: 'Jara Foods',  q2: 'Jara Oats',       q3: 'Supermarket shelf'   },
        { q1: 'Jara',        q2: 'Jara Spice Mix',  q3: 'Friend recommendation'},
        { q1: 'Jara Foods',  q2: 'Jara Rice',       q3: 'Social media'        },
        { q1: 'Jara',        q2: 'Jara Oats',       q3: 'Event / activation'  },
        { q1: 'Jara Foods',  q2: 'Jara Semolina',   q3: 'Radio'               },
        { q1: 'Jara',        q2: 'Jara Rice',       q3: 'Billboard'           },
        { q1: 'Jara Foods',  q2: 'Jara Spice Mix',  q3: 'WhatsApp group'      },
        { q1: 'Jara',        q2: 'Jara Oats',       q3: 'Supermarket shelf'   },
        { q1: 'Jara Foods',  q2: 'Jara Rice',       q3: 'TV advertising'      },
      ]
      await sb.from('survey_responses').insert(
        recallAnswers.map((answers, i) => ({
          survey_id:    recallSurvey.id,
          answers,
          quality_flag: 'ok',
          collected_at: tsAgo(75 + i * 2, 10 + (i % 8)),
        }))
      )
    }
  }

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
      brand_id: brandId,
      analysis_type: 'compare',
      input_data: { platform: 'instagram', creativeA: 'Nourish Nigeria hero video — 30s lifestyle', creativeB: 'Summer Vibes product pack shot — 15s' },
      result: {
        winner: 'A',
        why_winner: 'The lifestyle video scores significantly higher on cultural resonance (88 vs 72) and emotional impact — the community kitchen narrative connects deeply with the Jara nourishment brand pillar in a way the product shot cannot match.',
        creative_a: { engagement: 88, cultural_resonance: 88, brand_fit: 85, tone: 87, clarity: 82, risk: 12, summary: 'Strong brand fit and high emotional pull — music drop at 8s is a signature moment. CTA "Learn More" underperforms; swap for "Shop Now" or "Find a Store".' },
        creative_b: { engagement: 72, cultural_resonance: 71, brand_fit: 74, tone: 70, clarity: 86, risk: 28, summary: 'Clear and on-brand packaging shot but lacks the emotional depth needed to drive organic sharing. Better suited for retargeting than awareness.' },
      },
      created_at: tsAgo(14, 11),
    },
    {
      brand_id: brandId,
      analysis_type: 'identity',
      input_data: { captions: ['Good food starts with great ingredients — Jara Rice 🍚', 'Community is everything. Thank you Abuja for showing up ❤️', 'Breakfast sorted. Jara Oats, 5 minutes, done. 🫶', 'Reconnect with the taste of home. Jara Spice Mix brings it all together.'], brandValues: ['Nourishment', 'Authenticity', 'Community', 'Quality'] },
      result: {
        consistency_score: 84,
        strengths: ['Community and warmth language is consistent across all four captions', 'Active-voice copy aligns with the "Authenticity" brand value', '"Taste of home" in caption 4 is the strongest single brand-voice moment — use more often', 'Short-form captions are disciplined and resist over-explaining'],
        drift_warnings: ['Caption 2 switches to a gratitude/event register that has no product anchor — risks feeling disconnected from the food brand', '"5 minutes, done" in caption 3 leans functional rather than emotional — inconsistent with the nourishment-led voice', 'Emoji use is inconsistent (2 of 4 use them, 2 don\'t) — pick a style and stick to it'],
        adjustments: ['Add a subtle product or outcome cue to event captions e.g. "Thank you Abuja — we fed 2,000 families together ❤️"', 'Inject warmth into functional captions — try "5 minutes. Warm bowl. Good morning." instead of "5 minutes, done."', 'Establish emoji policy: 1 maximum per caption, placed at end only', 'Run all captions through the Voice Builder Retune tab before publishing'],
      },
      created_at: tsAgo(7, 14),
    },
    {
      brand_id: brandId,
      analysis_type: 'competitor',
      input_data: { competitorName: 'ChowMate', content: 'ChowMate — Nigerian Rice Redefined. Premium quality, every grain counts. Shop now at chowmate.ng/summer 🌟' },
      result: {
        tone: 'Aspirational / Premium',
        cultural_fit: 62,
        engagement_potential: 58,
        strategic_insights: ['ChowMate\'s "Redefined" positioning attempts premium uplift but feels imposed rather than earned — no cultural or community anchor', '"Every grain counts" is a quality claim with no storytelling proof — it\'s a brand assertion, not a brand truth', 'The western-style aspirational tone may alienate mass-market Northern Nigeria consumers where Jara is strong', 'Direct-to-website CTA in a brand awareness post suggests funnel confusion — mixing brand and performance objectives'],
        counter_positions: ['Lead with community ownership — "Jara: Made with Nigerian families, for Nigerian families" vs ChowMate\'s top-down premium claim', 'Use origin storytelling (farms, families, processes) to build quality credibility instead of asserting it, making "quality" a story Jara owns not claims', 'Target Northern Nigeria and South-East with dialect-inflected content (Hausa/Igbo phrases) where ChowMate\'s English-only approach leaves a wide gap'],
      },
      created_at: tsAgo(3, 9),
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
    { c: 'Sunday done right ✅ Jara Chilled on ice, Jara Rice on fire 🔥 #JaraSummerVibes #NaijaWeekend',                         fs: 'advocacy',      p: 'instagram', li: 8921, co: 742, sh: 1803, er: 9.4, ai: 93, d: 0,   cmp: camp3Id },
    { c: 'Which Jara product is your summer staple? 👇 Drop it in the comments 👇 #JaraSummerVibes',                              fs: 'consideration', p: 'instagram', li: 3840, co: 1247, sh: 621, er: 6.8, ai: 82, d: 1,   cmp: camp3Id },
    { c: 'Summer afternoons call for Jara Chilled. Now in more stores across Lagos 🌊 #JaraSummerVibes',                           fs: 'awareness',     p: 'twitter',   li: 4102, co: 318, sh: 830, er: 5.3, ai: 78, d: 2,   cmp: camp3Id },
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
    {
      daysBack: 28,
      content: {
        title: 'Jara Foods Competitive Briefing — Reconnect Campaign Closeout',
        executive_summary: 'Reconnect campaign nearing completion with sentiment stabilising at 71/100. ChowMate has launched a Gen-Z activation at UNILAG requiring an urgent counter-narrative before the Summer Vibes launch.',
        sov_analysis: 'Jara holds 48.3% share of voice among tracked FMCG competitors, up 2.1 points week-on-week. ChowMate has retreated slightly to 36.4% after its Reconnect-period counter-spend. NutriNg Foods remains steady at 15.3%. Jara\'s ESOV of +3.6% signals positive investment efficiency ahead of the upcoming campaign.',
        sentiment_vs_market: 'Jara\'s 14-day average sentiment (71.0/100) is 6.8 points above the estimated category average. ChowMate\'s UNILAG activation has not yet dented Jara\'s sentiment but is generating awareness among the 18-24 segment — monitor closely.',
        porter_forces: {
          competitive_rivalry: 'HIGH. ChowMate is increasing spend targeting student campuses. NutriNg Foods is repositioning toward health-conscious consumers in Lagos Island.',
          threat_of_new_entrants: 'MEDIUM. Distribution barriers remain high, but D2C food brands are gaining traction on Instagram and WhatsApp commerce.',
          bargaining_power_buyers: 'MEDIUM-HIGH. Price sensitivity elevated post-school resumption. Promoter NPS base (57%) provides a buffer against churn.',
          threat_of_substitutes: 'MEDIUM. Imported snack brands growing in Shoprite and Hubmart premium shelves.',
          overall_intensity: 'High',
        },
        brand_strengths: [
          'SOV leadership (48.3%) — 12 points ahead of ChowMate',
          'Sentiment premium of 6.8 points above estimated category average',
          'Reconnect campaign built strong southern Nigeria consideration — Ibadan geo-lift +18.4%',
        ],
        brand_vulnerabilities: [
          'Gen-Z consideration gap — ChowMate UNILAG activation is filling an uncontested space',
          'Northern distribution gaps remain unresolved (Kano, Maiduguri)',
          'No TikTok presence — blind spot on the fastest-growing Gen-Z platform',
        ],
        competitor_threats: [
          'ChowMate UNILAG activation targets 18-24 segment with brand sampling and student ambassador programme',
          'NutriNg Foods "Clean Label" rebrand launching next quarter — credibility play in health segment',
          'ChowMate planning 8 new Lekki-Ajah billboards starting July 2026',
        ],
        opportunities: [
          'Summer Vibes pre-launch: seeding @chefkemisola ahead of competitors closes the Gen-Z gap',
          'Kano restocking ahead of Sallah — first mover beats ChowMate in Northern recovery',
          'TikTok trial: 4-week campaign during Summer Vibes could capture organic Gen-Z attention at low cost',
        ],
        recommendations: [
          { action: 'Brief @chefkemisola for Summer Vibes Reel by end of week', rationale: 'Influencer seeding 2 weeks before paid launch historically drives 40% lower CPM for Jara campaigns.', priority: 'High' as const },
          { action: 'Prepare Gen-Z counter-narrative social pack for UNILAG/LASU audiences', rationale: 'ChowMate campus activation will start generating UGC within 10 days — preemptive content is cheaper than defensive response.', priority: 'High' as const },
          { action: 'Restock Kano and Maiduguri to 120% before Sallah', rationale: 'October 2025 stockout threads cost 8 points of SOV. Distribution consistency is the fastest brand health lever.', priority: 'Medium' as const },
        ],
        data_gaps: [
          'No TikTok listening — ChowMate Gen-Z activity on platform unmonitored',
          'Competitor market share estimates unconfirmed — ESOV uses proxies',
        ],
        confidence: 'Medium' as const,
      },
    },
    {
      daysBack: 21,
      content: {
        title: 'Jara Foods Competitive Briefing — Summer Vibes Pre-Launch',
        executive_summary: 'Summer Vibes pre-launch week. OOH placements confirmed across Lekki and Surulere. @chefkemisola seeding is driving Instagram saves 47% above benchmark, signalling strong organic momentum heading into paid activation.',
        sov_analysis: 'Jara SOV has climbed to 49.8% among tracked competitors as pre-launch content begins circulating. ChowMate has pulled back slightly (35.1%) — likely conserving budget ahead of a planned counter-campaign. NutriNg Foods holds 15.1%.',
        sentiment_vs_market: 'Jara\'s 14-day sentiment average is 72.1/100, rising 1.1 points from last week. The @chefkemisola content is generating strong joy and anticipation signals in emotion analysis. ChowMate sentiment remains stable at an estimated 62/100.',
        porter_forces: {
          competitive_rivalry: 'HIGH. ChowMate budget draw-down suggests a planned counter-activation in the next 2-3 weeks. Competitive response window is narrow.',
          threat_of_new_entrants: 'MEDIUM. Influencer-first food brands are gaining distribution through Instagram and Jumia — monitor Chow Express and FreshMade.',
          bargaining_power_buyers: 'MEDIUM. Summer season is a high-purchase window. Brand preference decisions are being made now.',
          threat_of_substitutes: 'LOW-MEDIUM. Jara\'s cultural positioning inoculates against imported substitute pressure during Nigerian summer.',
          overall_intensity: 'High',
        },
        brand_strengths: [
          'SOV at 49.8% — approaching majority share among tracked competitors',
          'Influencer saves benchmark exceeded by 47% on pre-launch content',
          'OOH placements secured in high-footfall Lekki and Surulere corridors',
          'Geo-lift from Reconnect campaign still active: Lagos sentiment elevated +4.2 points',
        ],
        brand_vulnerabilities: [
          'Heavy reliance on single influencer (@chefkemisola) — diversification needed for Q3',
          'ChowMate counter-campaign likely imminent based on spend patterns',
          'NPS promoter base not yet activated for Summer Vibes amplification',
        ],
        competitor_threats: [
          'ChowMate spend reduction this week suggests a planned burst in weeks 2-3 of Summer Vibes',
          'NutriNg Foods partnering with fitness influencers — tangential health narrative building',
        ],
        opportunities: [
          'Activate NPS promoter base with Summer Vibes shareable kits this week — 200 promoters could generate 1.8M impressions',
          'NPC (Nigerian Pop Culture) moment: tie Summer Vibes to Afrobeats season for earned media',
          'OOH halo effect: geo-targeted digital ads near Lekki and Surulere boards will amplify recall',
        ],
        recommendations: [
          { action: 'Send Summer Vibes shareable kit to top 200 NPS promoters by Friday', rationale: 'Promoter UGC converts 3x better than paid creative and is free. This is the highest-ROI action this week.', priority: 'High' as const },
          { action: 'Brief a backup influencer (mid-tier, 80-150k) for Week 2 amplification', rationale: 'Single influencer dependency is a risk. A second voice diversifies and doubles reach at modest cost.', priority: 'Medium' as const },
          { action: 'Set up OOH geo-targeted Instagram retargeting within 500m of billboards', rationale: 'OOH + digital pairing lifts recall by ~22% vs OOH alone in Lagos market.', priority: 'Medium' as const },
        ],
        data_gaps: [
          'No ChowMate spend data — counter-campaign timing is inferred from past patterns',
          'TikTok listening still inactive — Gen-Z signals incomplete',
        ],
        confidence: 'Medium' as const,
      },
    },
    {
      daysBack: 14,
      content: {
        title: 'Jara Foods Competitive Briefing — Summer Vibes Launch Week',
        executive_summary: 'Campaign launch week delivering strong early signals. Lekki and Surulere OOH live. Meta awareness creative achieving 4.1% CTR — well above the 1.8% FMCG benchmark. Sentiment trending upward.',
        sov_analysis: 'Jara SOV surged to 52.4% on launch day on the back of OOH + digital + influencer overlap. ChowMate fell to 33.2% — no visible counter-campaign yet. NutriNg Foods at 14.4%. Jara ESOV now +7.7%, above the growth threshold.',
        sentiment_vs_market: 'Jara\'s 14-day average sentiment climbed to 72.8/100 — the highest recorded since the Nourish Nigeria campaign peak. The emotion distribution shows joy (38%), anticipation (27%), trust (21%), which is the healthiest mix in 90 days.',
        porter_forces: {
          competitive_rivalry: 'HIGH. ChowMate has not responded yet, which is unusual. Expect a counter-move in weeks 2-3. NutriNg is gaining micro-influence traction on X.',
          threat_of_new_entrants: 'MEDIUM. The Summer Vibes campaign is reinforcing Jara\'s category leadership before any new entrant can capitalise.',
          bargaining_power_buyers: 'MEDIUM. Strong brand momentum typically shifts price negotiation power back toward the brand.',
          threat_of_substitutes: 'LOW-MEDIUM. Jara cultural presence is at its strongest — substitutes struggle during high-brand-equity windows.',
          overall_intensity: 'Medium',
        },
        brand_strengths: [
          'SOV at 52.4% — majority share among tracked competitors for the first time in 6 months',
          'Meta CTR 4.1% vs 1.8% FMCG benchmark — creative is outperforming',
          'Sentiment at 72.8/100, 90-day high — strong equity foundation',
          'OOH + digital overlap in Lekki and Surulere creating recall multiplier effect',
        ],
        brand_vulnerabilities: [
          'ChowMate silence may precede a significant burst — do not reduce monitoring',
          'Campaign budget concentrated in weeks 1-2 — tail-off risk in weeks 3-4 if not refreshed',
        ],
        competitor_threats: [
          'ChowMate likely preparing a counter-campaign — monitor OOH booking sites and influencer brief activity',
          'NutriNg Foods gaining X (Twitter) share in health conversation — niche but growing',
        ],
        opportunities: [
          'Capture launch week UGC for retargeting — high-sentiment content performs well as paid posts',
          'OOH halo effect: expand geo-targeting to Ajah and Yaba corridors while CPM is low',
          'Sentiment is high — good time to run an NPS pulse to capture promoters at peak satisfaction',
        ],
        recommendations: [
          { action: 'Capture and boost top UGC from launch week as paid posts', rationale: 'UGC-as-paid performs 2.4x better on authenticity metrics and reuses existing social proof.', priority: 'High' as const },
          { action: 'Run a 48-hour NPS pulse survey to active customers this week', rationale: 'Sentiment is at a 90-day high — capturing promoters now maximises advocacy programme pipeline.', priority: 'Medium' as const },
          { action: 'Prepare Week 3 creative refresh ahead of expected ChowMate counter-campaign', rationale: 'Brands that maintain consistent spend through competitor bursts recover SOV faster.', priority: 'Medium' as const },
        ],
        data_gaps: [
          'ChowMate next move unknown — no spend transparency on OOH bookings',
          'TikTok listening inactive — missing Gen-Z signals during a high-engagement week',
        ],
        confidence: 'High' as const,
      },
    },
    {
      daysBack: 7,
      content: {
        title: 'Jara Foods Competitive Briefing — Summer Vibes Week 2',
        executive_summary: 'Week 2 of Summer Vibes. Sentiment at 73.0/100, above the 90-day average. ChowMate Lekki counter-placement confirmed — 6 new billboards. Campaign momentum remains strong with influencer content outperforming paid 3:1 on saves.',
        sov_analysis: 'Jara holds 51.2% share of voice among tracked competitors. ChowMate recovered slightly to 33.8% on the back of its Lekki OOH placement. NutriNg Foods at 15.0%. Jara\'s ESOV of +6.5% remains firmly in growth territory above the +5% threshold.',
        sentiment_vs_market: 'Jara\'s 14-day average sentiment (73.0/100) sits 8.2 points above the estimated category average. ChowMate\'s Lekki counter-placement has generated some competitor noise on X but has not yet affected Jara\'s sentiment trajectory. Influencer content (joy + trust dominant) is the primary driver.',
        porter_forces: {
          competitive_rivalry: 'HIGH. ChowMate\'s Lekki OOH placement is a direct geographic challenge. 6 billboards across Victoria Island and Lekki Phase 1 corridor compete for identical audiences.',
          threat_of_new_entrants: 'MEDIUM. No new significant entrants detected. D2C brands continue building social audiences but lack distribution scale.',
          bargaining_power_buyers: 'MEDIUM. Jara\'s brand momentum and cultural presence are reducing price sensitivity among core Lagos consumers.',
          threat_of_substitutes: 'LOW-MEDIUM. Jara\'s Summer Vibes campaign is effectively inoculating against substitute consideration during the campaign window.',
          overall_intensity: 'High',
        },
        brand_strengths: [
          'SOV at 51.2% — market-leading position sustained into Week 2',
          'Influencer content outperforming paid creative 3:1 on Instagram saves',
          'Sentiment at 73.0/100, 8.2 points above estimated category average',
          'Nourish Nigeria geo-lift still active in Southwest — adds earned lift to campaign',
        ],
        brand_vulnerabilities: [
          'ChowMate OOH directly competing in Jara\'s strongest Lagos corridors',
          'Northern distribution gap persists — Kano and Maiduguri under-served ahead of Sallah',
          'No TikTok presence — Gen-Z voice gap while ChowMate earns 22% of its SOV there',
        ],
        competitor_threats: [
          'ChowMate 6-board Lekki-VI OOH placement targets Jara\'s highest-value demographic',
          'NutriNg Foods partnering with @FitNaija and @HealthyLagos for a clean-label campaign in Q3',
          'ChowMate reportedly in talks with two Gen-Z TikTok creators (500k+ followers each)',
        ],
        opportunities: [
          'Sallah seeding: brief @AdaezeFoods and @HijabChic for July cultural content — exclusivity window closes soon',
          'Kano restocking ahead of Sallah creates first-mover advantage in Northern market recovery',
          'NPS promoter micro-advocacy campaign: 200 promoters at 57% NPS promoter rate = est. 2M organic impressions',
          'TikTok trial: 4-week Summer Vibes extension at ₦400k could close Gen-Z gap before ChowMate locks creator relationships',
        ],
        recommendations: [
          { action: 'Brief Sallah creators by July 1 (2 weeks away)', rationale: 'Cultural moments drive 2.4x engagement vs standard ads for Jara\'s audience. ChowMate has not booked Sallah talent — first mover wins.', priority: 'High' as const },
          { action: 'Restock Kano and Maiduguri to 120% ahead of Sallah window', rationale: 'October 2025 stockout threads amplified ChowMate\'s SOV gain by 8 points. Prevention is cheaper than recovery.', priority: 'High' as const },
          { action: 'Launch TikTok account with 4-week Summer Vibes extension (₦400k trial)', rationale: 'ChowMate earns 22% of its SOV on TikTok. Jara has zero presence. Low cost to test before Q4 budget lock.', priority: 'Medium' as const },
          { action: 'Activate 200 NPS promoters with Summer Vibes shareable kits', rationale: 'Promoter UGC converts at 3x paid CTR. The Summer Vibes high-sentiment window is the ideal moment to capture organic amplification.', priority: 'Medium' as const },
        ],
        data_gaps: [
          'No TikTok listening — ChowMate and NutriNg activity on platform is a blind spot',
          'Competitor market share not confirmed — ESOV calculation uses indicative estimates',
          'No sentiment tracking for NutriNg Foods or ChowMate at individual post level',
        ],
        confidence: 'High' as const,
      },
    },
  ]
  for (const b of briefings) {
    await sb.from('weekly_briefings').insert({
      brand_id: brandId, week_start: dAgo(b.daysBack),
      content: b.content,
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

  // Summer Vibes per-site geo-lift studies — one for each of the 4 active OOH placements.
  // These are early-stage running studies (campaign launched 14 days ago).
  await sb.from('geo_lift_studies').insert([
    {
      brand_id:          brandId,
      campaign_id:       camp3Id,
      ooh_site_id:       lekkiId,
      treatment_city:    'Lagos',
      control_city:      'Ibadan',
      keyword:           'Jara Summer Vibes',
      study_start:       dAgo(14),
      study_end:         dAgo(-76),
      lift_pct:          8.7,
      confidence:        78.4,
      correlation:       0.7820,
      status:            'running',
      weekly_data:       makeWeekly(2, 65, 52, 8.7),
      ai_interpretation: 'Early signal from Lekki Toll Gate — +8.7% branded search uplift in the Lagos treatment zone after 2 weeks. Correlation strengthening week-on-week. Study ongoing; confidence expected to cross 90% threshold by week 6.',
    },
    {
      brand_id:          brandId,
      campaign_id:       camp3Id,
      ooh_site_id:       surulereId,
      treatment_city:    'Lagos',
      control_city:      'Ibadan',
      keyword:           'Jara Rice',
      study_start:       dAgo(14),
      study_end:         dAgo(-76),
      lift_pct:          6.2,
      confidence:        72.1,
      correlation:       0.7340,
      status:            'running',
      weekly_data:       makeWeekly(2, 58, 48, 6.2),
      ai_interpretation: 'Adeniran Ogunsanya Mall unipole generating moderate early uplift for "Jara Rice" branded searches. Surulere mainland audience is responding with a 6.2% treatment lift vs Ibadan control. Confidence still building — recommend extending study 4 more weeks before drawing conclusions.',
    },
    {
      brand_id:          brandId,
      campaign_id:       camp3Id,
      ooh_site_id:       transcorpId,
      treatment_city:    'Abuja',
      control_city:      'Kaduna',
      keyword:           'Jara Foods',
      study_start:       dAgo(14),
      study_end:         dAgo(-76),
      lift_pct:          11.8,
      confidence:        81.9,
      correlation:       0.8130,
      status:            'running',
      weekly_data:       makeWeekly(2, 44, 38, 11.8),
      ai_interpretation: 'Transcorp Hilton LED placement driving strong early signal in the Abuja CBD — +11.8% branded search uplift, above the Reconnect campaign baseline for this market. C-suite and professional footfall at Transcorp appears highly responsive to digital OOH. Monitor weekly to confirm trajectory.',
    },
    {
      brand_id:          brandId,
      campaign_id:       camp3Id,
      ooh_site_id:       oshodiId,
      treatment_city:    'Lagos',
      control_city:      'Ibadan',
      keyword:           'Jara Rice',
      study_start:       dAgo(14),
      study_end:         dAgo(-76),
      lift_pct:          14.3,
      confidence:        85.6,
      correlation:       0.8410,
      status:            'running',
      weekly_data:       makeWeekly(2, 72, 56, 14.3),
      ai_interpretation: 'Oshodi overhead banners are outperforming per-impression expectations — 110,000 daily footfall is generating a 14.3% branded search uplift despite the non-illuminated format. Mass-market "Jara Rice" audience is clearly concentrated in this corridor. Highest lift-per-naira of all 4 Summer Vibes OOH sites after 2 weeks.',
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

  /* ── 28. Marketplace — Jara on Jumia & Konga vs ChowMate ────────────── */
  const { data: mp1 } = await sb.from('marketplace_products').insert({
    brand_id: brandId, platform: 'jumia', product_name: 'Jara Long Grain Rice 5kg',
    sku: 'JLR-5KG', category: 'Rice & Grains', is_own_product: true, is_active: true,
    product_url: 'https://jumia.com.ng/jara-rice-5kg',
  }).select('id').single()
  const { data: mp2 } = await sb.from('marketplace_products').insert({
    brand_id: brandId, platform: 'jumia', product_name: 'Jara Spice Mix 200g',
    sku: 'JSM-200G', category: 'Spices & Seasoning', is_own_product: true, is_active: true,
    product_url: 'https://jumia.com.ng/jara-spice-mix-200g',
  }).select('id').single()
  const { data: mp3 } = await sb.from('marketplace_products').insert({
    brand_id: brandId, platform: 'konga', product_name: 'Jara Oats 500g',
    sku: 'JOT-500G', category: 'Cereals & Oats', is_own_product: true, is_active: true,
    product_url: 'https://konga.com/product/jara-oats-500g',
  }).select('id').single()
  const { data: mp4 } = await sb.from('marketplace_products').insert({
    brand_id: brandId, platform: 'jumia', product_name: 'ChowMate Jollof Rice Mix 1kg',
    sku: 'CM-JRM-1KG', category: 'Rice & Grains', is_own_product: false, is_active: true,
    product_url: 'https://jumia.com.ng/chowmate-jollof-mix-1kg',
  }).select('id').single()
  const { data: mp5 } = await sb.from('marketplace_products').insert({
    brand_id: brandId, platform: 'konga', product_name: 'NutriNg Premium Rice 5kg',
    sku: 'NNG-PR-5KG', category: 'Rice & Grains', is_own_product: false, is_active: true,
    product_url: 'https://konga.com/product/nutring-premium-rice-5kg',
  }).select('id').single()

  const mpIds = [mp1?.id, mp2?.id, mp3?.id, mp4?.id, mp5?.id]

  const snapshotBase = [
    { idx: 0, prices: [3_200, 3_100, 3_050, 3_200, 3_200, 3_300, 3_300, 3_400], ratings: [4.6, 4.7, 4.7, 4.5, 4.6, 4.6, 4.7, 4.8], reviews: [847, 812, 798, 822, 835, 856, 862, 871], shelf: [3, 2, 2, 1, 1, 2, 2, 1] },
    { idx: 1, prices: [980, 950, 950, 1_000, 1_000, 1_000, 1_020, 1_020], ratings: [4.5, 4.4, 4.5, 4.5, 4.6, 4.6, 4.6, 4.7], reviews: [412, 398, 401, 415, 422, 430, 441, 448], shelf: [5, 4, 4, 3, 3, 3, 2, 2] },
    { idx: 2, prices: [850, 820, 820, 850, 850, 880, 880, 880], ratings: [4.4, 4.3, 4.4, 4.4, 4.5, 4.5, 4.6, 4.6], reviews: [289, 275, 280, 292, 299, 307, 314, 321], shelf: [4, 5, 4, 4, 3, 3, 3, 2] },
    { idx: 3, prices: [2_800, 2_850, 2_800, 2_750, 2_700, 2_650, 2_650, 2_700], ratings: [4.1, 4.0, 4.1, 4.2, 4.2, 4.1, 4.2, 4.3], reviews: [1_241, 1_189, 1_202, 1_214, 1_230, 1_247, 1_261, 1_278], shelf: [1, 1, 1, 2, 2, 1, 1, 2] },
    { idx: 4, prices: [2_950, 2_900, 2_900, 2_950, 2_950, 3_000, 3_000, 3_000], ratings: [4.3, 4.2, 4.3, 4.3, 4.4, 4.4, 4.4, 4.5], reviews: [631, 608, 614, 625, 638, 647, 657, 664], shelf: [5, 4, 4, 5, 4, 4, 3, 3] },
  ]
  const snapInserts = []
  for (const s of snapshotBase) {
    const id = mpIds[s.idx]
    if (!id) continue
    for (let w = 0; w < 8; w++) {
      snapInserts.push({
        brand_id: brandId, product_id: id,
        snapshot_date: dAgo(w * 7),
        price: s.prices[w], currency: 'NGN',
        rating: s.ratings[w], review_count: s.reviews[w],
        shelf_position: s.shelf[w], in_stock: true,
        sales_rank: Math.round(s.shelf[w] * 12 + (w * 2)),
        badges: s.idx < 3 ? ['Jara Brand'] : [],
      })
    }
  }
  await sb.from('marketplace_snapshots').insert(snapInserts)

  // Add marketplace reviews for Jara Rice (mp1)
  if (mp1?.id) {
    await sb.from('marketplace_reviews').insert([
      { brand_id: brandId, product_id: mp1.id, platform: 'jumia', external_id: 'jmr-001', author: 'Ngozi A.', rating: 5, title: 'Best rice in the market!', body: 'Jara Long Grain cooks so well. No stones, no broken grains. My family loves it.', verified: true, helpful_count: 47, sentiment_label: 'positive', sentiment_score: 92, reviewed_at: dAgo(12) },
      { brand_id: brandId, product_id: mp1.id, platform: 'jumia', external_id: 'jmr-002', author: 'Emeka O.', rating: 4, title: 'Good quality, fast delivery', body: 'Quality is consistent. Delivery was 2 days. Would be 5 stars if price was lower.', verified: true, helpful_count: 23, sentiment_label: 'positive', sentiment_score: 74, reviewed_at: dAgo(20) },
      { brand_id: brandId, product_id: mp1.id, platform: 'jumia', external_id: 'jmr-003', author: 'Bimpe K.', rating: 2, title: 'Price increase again?', body: 'Love the product but the price jump from ₦3,050 to ₦3,400 in 2 weeks is too much. Looking at alternatives.', verified: false, helpful_count: 89, sentiment_label: 'negative', sentiment_score: 28, reviewed_at: dAgo(5) },
      { brand_id: brandId, product_id: mp1.id, platform: 'jumia', external_id: 'jmr-004', author: 'Tunde B.', rating: 5, title: 'Consistent quality', body: 'Been buying Jara Rice for 3 years. Never disappointed me once.', verified: true, helpful_count: 61, sentiment_label: 'positive', sentiment_score: 96, reviewed_at: dAgo(35) },
    ])
  }

  /* ── 29. Budget plan + line items + actuals (Summer Vibes) ───────────── */
  const { data: budgetPlan } = await sb.from('budget_plans').insert({
    brand_id: brandId, name: 'Jara Summer Vibes — Q3 2026',
    period_start: dAgo(14), period_end: dAgo(-76),
    total_budget: 8_500_000, currency: 'NGN',
    status: 'active', notes: 'Full 90-day campaign. Digital + OOH weighted toward Lagos.',
    created_by: userId,
  }).select('id').single()

  if (budgetPlan?.id) {
    const { data: li1 } = await sb.from('budget_line_items').insert({ brand_id: brandId, plan_id: budgetPlan.id, channel: 'digital', label: 'Meta Ads (Facebook + Instagram)', planned_amount: 2_500_000, actual_amount: 1_124_800, currency: 'NGN', campaign_id: camp3Id }).select('id').single()
    const { data: li2 } = await sb.from('budget_line_items').insert({ brand_id: brandId, plan_id: budgetPlan.id, channel: 'digital', label: 'Google Display & Search', planned_amount: 800_000, actual_amount: 362_000, currency: 'NGN', campaign_id: camp3Id }).select('id').single()
    const { data: li3 } = await sb.from('budget_line_items').insert({ brand_id: brandId, plan_id: budgetPlan.id, channel: 'ooh', label: 'Lagos Billboards (Lekki + Oshodi)', planned_amount: 2_200_000, actual_amount: 1_100_000, currency: 'NGN', campaign_id: camp3Id }).select('id').single()
    const { data: li4 } = await sb.from('budget_line_items').insert({ brand_id: brandId, plan_id: budgetPlan.id, channel: 'ooh', label: 'Abuja LED Screen (Transcorp)', planned_amount: 480_000, actual_amount: 480_000, currency: 'NGN', campaign_id: camp3Id }).select('id').single()
    const { data: li5 } = await sb.from('budget_line_items').insert({ brand_id: brandId, plan_id: budgetPlan.id, channel: 'influencer', label: 'Chef Kemisola + Foodie Naija', planned_amount: 1_400_000, actual_amount: 1_400_000, currency: 'NGN', campaign_id: camp3Id }).select('id').single()
    const { data: li6 } = await sb.from('budget_line_items').insert({ brand_id: brandId, plan_id: budgetPlan.id, channel: 'production', label: 'Creative Production & Editing', planned_amount: 620_000, actual_amount: 584_000, currency: 'NGN' }).select('id').single()
    const { data: li7 } = await sb.from('budget_line_items').insert({ brand_id: brandId, plan_id: budgetPlan.id, channel: 'events', label: 'Mall Sampling Activations', planned_amount: 500_000, actual_amount: 0, currency: 'NGN', campaign_id: camp3Id }).select('id').single()

    // Actuals (spend events) — staggered over last 14 days
    const actualInserts = [
      { li: li1?.id, amount: 524_800, desc: 'Meta Ads Week 1', ref: 'META-INV-8821', spent_on: dAgo(13) },
      { li: li1?.id, amount: 600_000, desc: 'Meta Ads Week 2', ref: 'META-INV-8934', spent_on: dAgo(6) },
      { li: li2?.id, amount: 362_000, desc: 'Google Ads — Display + Search', ref: 'GGL-INV-4421', spent_on: dAgo(10) },
      { li: li3?.id, amount: 560_000, desc: 'Lekki Toll Gate billboard — Month 1', ref: 'OOHN-221', spent_on: dAgo(14) },
      { li: li3?.id, amount: 540_000, desc: 'Oshodi + Surulere banners — Month 1', ref: 'LASAA-112', spent_on: dAgo(14) },
      { li: li4?.id, amount: 480_000, desc: 'Transcorp LED Screen — 4 weeks', ref: 'OOHM-512', spent_on: dAgo(14) },
      { li: li5?.id, amount: 850_000, desc: '@chefkemisola partnership fee', ref: 'INF-KEMI-01', spent_on: dAgo(18) },
      { li: li5?.id, amount: 550_000, desc: '@foodie_naija Instagram series (3 posts)', ref: 'INF-FOOD-01', spent_on: dAgo(15) },
      { li: li6?.id, amount: 584_000, desc: 'Creative studio — Summer Vibes full package', ref: 'PROD-SV-2026', spent_on: dAgo(21) },
    ]
    for (const a of actualInserts) {
      if (!a.li) continue
      await sb.from('budget_actuals').insert({ brand_id: brandId, line_item_id: a.li, amount: a.amount, currency: 'NGN', description: a.desc, reference: a.ref, spent_on: a.spent_on, created_by: userId })
    }
    void li7 // scheduled, not yet spent
  }

  /* ── 30. Loyalty program — Jara Rewards ──────────────────────────────── */
  const { data: lp } = await sb.from('loyalty_programs').insert({
    brand_id: brandId, name: 'Jara Rewards', description: 'Earn points on every Jara purchase. Redeem for discounts and exclusive products.',
    points_currency: 'Jara Points', points_per_ngn: 0.01,
    status: 'active',
  }).select('id').single()

  let bronze: { id: string } | null = null, silver: { id: string } | null = null, gold: { id: string } | null = null
  if (lp?.id) {
    const { data: t1 } = await sb.from('loyalty_tiers').insert({ brand_id: brandId, program_id: lp.id, name: 'Bronze', min_points: 0, color: '#cd7f32', perks: ['5% discount on Jara Rice', 'Birthday bonus points', 'Early access to new products'], sort_order: 1 }).select('id').single()
    const { data: t2 } = await sb.from('loyalty_tiers').insert({ brand_id: brandId, program_id: lp.id, name: 'Silver', min_points: 5_000, color: '#aaa9ad', perks: ['8% discount on all products', 'Double points Fridays', 'Free shipping on Jumia/Konga', 'Quarterly mystery box'], sort_order: 2 }).select('id').single()
    const { data: t3 } = await sb.from('loyalty_tiers').insert({ brand_id: brandId, program_id: lp.id, name: 'Gold', min_points: 20_000, color: '#ffd700', perks: ['12% lifetime discount', 'Monthly chef masterclass invite', 'Personalised gifting', 'Priority CS hotline', 'Exclusive community kitchen invites'], sort_order: 3 }).select('id').single()
    bronze = t1; silver = t2; gold = t3

    // Rewards
    await sb.from('loyalty_rewards').insert([
      { brand_id: brandId, program_id: lp.id, name: '₦500 off next purchase', description: 'Redeem for ₦500 discount on any Jara order', points_cost: 1_000, reward_type: 'discount', is_active: true },
      { brand_id: brandId, program_id: lp.id, name: 'Free Jara Spice Mix 200g', description: 'Get a free Jara Spice Mix added to your next order', points_cost: 2_500, reward_type: 'free_product', is_active: true, stock: 200 },
      { brand_id: brandId, program_id: lp.id, name: 'Chef Kemisola Cooking Class', description: 'Live online cooking class with Chef Kemisola — 1 session', points_cost: 8_000, reward_type: 'experience', is_active: true, stock: 50 },
      { brand_id: brandId, program_id: lp.id, name: '₦2,000 off ₦10,000+ order', description: 'Discount voucher for large orders', points_cost: 3_500, reward_type: 'voucher', is_active: true },
    ])

    // Members with varied tiers and points
    const memberData = [
      { name: 'Funke Adeleke',  email: 'funke.a@gmail.com', phone: '+2348012345001', tier: gold?.id,   pts: 32_400, lf: 38_200, joined: dAgo(320) },
      { name: 'Chidi Okonkwo', email: 'chidi.o@yahoo.com', phone: '+2348034567002', tier: gold?.id,   pts: 28_100, lf: 31_600, joined: dAgo(280) },
      { name: 'Amina Bello',   email: 'amina.b@gmail.com', phone: '+2347012345003', tier: silver?.id, pts: 14_800, lf: 18_400, joined: dAgo(210) },
      { name: 'Taiwo Adesanya',email: 'taiwo.a@gmail.com', phone: '+2348045678004', tier: silver?.id, pts: 11_200, lf: 12_900, joined: dAgo(180) },
      { name: 'Ngozi Eze',     email: 'ngozi.e@gmail.com', phone: '+2348056789005', tier: silver?.id, pts: 8_400,  lf: 9_100,  joined: dAgo(155) },
      { name: 'Emeka Uche',    email: 'emeka.u@gmail.com', phone: '+2348067890006', tier: silver?.id, pts: 6_200,  lf: 7_800,  joined: dAgo(140) },
      { name: 'Bimpe Lawal',   email: 'bimpe.l@gmail.com', phone: '+2348078901007', tier: bronze?.id, pts: 3_800,  lf: 4_200,  joined: dAgo(90) },
      { name: 'Yusuf Garba',   email: 'yusuf.g@gmail.com', phone: '+2347023456008', tier: bronze?.id, pts: 2_100,  lf: 2_800,  joined: dAgo(75) },
      { name: 'Shade Williams',email: 'shade.w@gmail.com', phone: '+2348034567009', tier: bronze?.id, pts: 1_400,  lf: 1_900,  joined: dAgo(60) },
      { name: 'Ola Adeyemi',   email: 'ola.a@gmail.com',  phone: '+2348045678010', tier: bronze?.id, pts: 620,    lf: 620,    joined: dAgo(30) },
    ]
    const { data: memberRows } = await sb.from('loyalty_members').insert(
      memberData.map(m => ({
        brand_id: brandId, program_id: lp.id, name: m.name, email: m.email, phone: m.phone,
        current_tier_id: m.tier, points_balance: m.pts, lifetime_points: m.lf,
        joined_at: m.joined, last_activity: dAgo(Math.floor(Math.random() * 20)),
      }))
    ).select('id')

    if (memberRows?.length) {
      const txInserts = memberRows.flatMap((member, idx) => {
        const m = memberData[idx]
        const rows = []
        // Initial earn (purchase)
        rows.push({ brand_id: brandId, member_id: member.id, transaction_type: 'earn', points: Math.round(m.lf * 0.7), balance_after: Math.round(m.lf * 0.7), description: 'Purchase — Jara Rice 5kg × 4', reference: `PUR-${idx + 1001}`, created_at: m.joined })
        // Additional earn
        rows.push({ brand_id: brandId, member_id: member.id, transaction_type: 'earn', points: Math.round(m.lf * 0.2), balance_after: Math.round(m.lf * 0.9), description: 'Purchase — Jara Oats + Spice Mix', reference: `PUR-${idx + 2001}`, created_at: dAgo(60) })
        // Bonus
        rows.push({ brand_id: brandId, member_id: member.id, transaction_type: 'bonus', points: Math.round(m.lf * 0.1), balance_after: m.lf, description: 'Referral bonus — friend signup', reference: `REF-${idx + 3001}`, created_at: dAgo(30) })
        // Redemption for high-tier members
        if (m.pts < m.lf) {
          const redeemed = m.lf - m.pts
          rows.push({ brand_id: brandId, member_id: member.id, transaction_type: 'redeem', points: -redeemed, balance_after: m.pts, description: 'Reward redemption — ₦500 discount', reference: `RDM-${idx + 4001}`, created_at: dAgo(15) })
        }
        return rows
      })
      await sb.from('loyalty_transactions').insert(txInserts)
    }
  }

  /* ── 31. A/B Experiments ─────────────────────────────────────────────── */
  const { data: exp1 } = await sb.from('ab_experiments').insert({
    brand_id: brandId, name: 'Summer Vibes Email CTA',
    hypothesis: 'A stronger action-oriented CTA ("Grab yours now") will drive higher click-through than the current informational CTA ("Learn more")',
    experiment_type: 'email', metric_primary: 'click_through_rate',
    metrics_secondary: ['open_rate', 'conversion_rate'],
    status: 'concluded',
    confidence_target: 95, min_sample_size: 500,
    started_at: tsAgo(21), concluded_at: tsAgo(7),
  }).select('id').single()

  const { data: exp2 } = await sb.from('ab_experiments').insert({
    brand_id: brandId, name: 'Jara Rice Jumia Listing Image',
    hypothesis: 'A lifestyle cooking image will generate more clicks than the plain product-on-white image, because it shows the product in context',
    experiment_type: 'creative', metric_primary: 'click_through_rate',
    status: 'running',
    confidence_target: 95, min_sample_size: 300,
    started_at: tsAgo(7),
  }).select('id').single()

  const { data: exp3 } = await sb.from('ab_experiments').insert({
    brand_id: brandId, name: 'WhatsApp Survey Greeting Language',
    hypothesis: 'Opening survey invite in Pidgin English ("How body? Quick question for you!") will yield higher response rates than formal English ("We value your feedback")',
    experiment_type: 'message', metric_primary: 'response_rate',
    status: 'draft',
    confidence_target: 90, min_sample_size: 200,
  }).select('id').single()

  if (exp1?.id) {
    const { data: ev1c } = await sb.from('ab_variants').insert({ brand_id: brandId, experiment_id: exp1.id, name: 'Control — Learn More', is_control: true, impressions: 2840, conversions: 142, revenue: 0, sort_order: 1, content: { cta_text: 'Learn more', cta_color: '#666666' } }).select('id').single()
    const { data: ev1v } = await sb.from('ab_variants').insert({ brand_id: brandId, experiment_id: exp1.id, name: 'Variant — Grab Yours Now', is_control: false, impressions: 2861, conversions: 218, revenue: 0, sort_order: 2, content: { cta_text: 'Grab yours now', cta_color: '#E8763E' } }).select('id').single()
    if (ev1v?.id) await sb.from('ab_experiments').update({ winner_variant_id: ev1v.id }).eq('id', exp1.id)
    void ev1c
  }
  if (exp2?.id) {
    await sb.from('ab_variants').insert({ brand_id: brandId, experiment_id: exp2.id, name: 'Control — Product White BG', is_control: true, impressions: 1420, conversions: 68, revenue: 218_400, sort_order: 1, content: { image_type: 'product_white', description: 'Jara 5kg bag on white background' } })
    await sb.from('ab_variants').insert({ brand_id: brandId, experiment_id: exp2.id, name: 'Variant — Lifestyle Cooking', is_control: false, impressions: 1435, conversions: 94, revenue: 301_800, sort_order: 2, content: { image_type: 'lifestyle', description: 'Family cooking jollof with Jara rice' } })
  }
  if (exp3?.id) {
    await sb.from('ab_variants').insert({ brand_id: brandId, experiment_id: exp3.id, name: 'Control — Formal English', is_control: true, impressions: 0, conversions: 0, revenue: 0, sort_order: 1, content: { message: 'We value your feedback. Could you spare 2 minutes?' } })
    await sb.from('ab_variants').insert({ brand_id: brandId, experiment_id: exp3.id, name: 'Variant — Pidgin Greeting', is_control: false, impressions: 0, conversions: 0, revenue: 0, sort_order: 2, content: { message: 'How body? Quick question for you! Go bother you 2 mins? 🙏' } })
  }

  /* ── 32. Advocacy scores (weekly for 12 weeks) ───────────────────────── */
  const advocacyRows = Array.from({ length: 12 }, (_, i) => {
    const w = 11 - i
    const ss = sentScore(w * 7)
    const vol = Math.round(28 + i * 3.2 + Math.sin(i * 0.8) * 4)
    const posVol = Math.round(vol * (0.55 + (ss / 100) * 0.2))
    const negVol = Math.round(vol * (0.12 - (ss / 100) * 0.04))
    const neuVol = vol - posVol - negVol
    const reach = Math.round(vol * (2800 + i * 120))
    const engagement = Math.round(reach * 0.052)
    const sentRatio = posVol / vol
    const volScore = Math.min(100, (vol / 60) * 100)
    const reachScore = Math.min(100, (reach / 120_000) * 100)
    const engmtScore = Math.min(100, (engagement / 6_500) * 100)
    const score = (sentRatio * 40) + ((volScore * 0.5 + reachScore * 0.5) * 0.4) + (engmtScore * 0.2)
    return {
      brand_id: brandId, week_start: dAgo(w * 7 + 6),
      ugc_mentions: vol, positive_mentions: posVol, neutral_mentions: neuVol, negative_mentions: negVol,
      avg_sentiment: +ss.toFixed(2), total_reach: reach, total_engagement: engagement,
      top_platforms: { instagram: Math.round(vol * 0.55), twitter: Math.round(vol * 0.38), tiktok: Math.round(vol * 0.07) },
      top_themes: ss > 70 ? ['brand love', 'product quality', 'nostalgia'] : ['pricing', 'availability', 'comparison'],
      advocacy_score: +Math.min(100, score).toFixed(2),
      score_delta: i > 0 ? +(Math.sin(i * 0.5) * 3.2).toFixed(2) : 0,
      score_factors: { sentiment_contribution: +(sentRatio * 40).toFixed(1), volume_contribution: +((volScore * 0.5 + reachScore * 0.5) * 0.4).toFixed(1), engagement_contribution: +(engmtScore * 0.2).toFixed(1) },
    }
  })
  await sb.from('advocacy_scores').insert(advocacyRows)

  /* ── 33. Promoters + referral codes ──────────────────────────────────── */
  const promoterData = [
    { name: 'Funke Adeleke', email: 'funke.a@gmail.com', phone: '+2348012345001', nps: 10, city: 'Lagos', code: 'BP-JARA01', clicks: 48, conversions: 12 },
    { name: 'Chidi Okonkwo', email: 'chidi.o@yahoo.com', phone: '+2348034567002', nps: 9, city: 'Abuja', code: 'BP-JARA02', clicks: 31, conversions: 8 },
    { name: 'Amina Bello', email: 'amina.b@gmail.com', phone: '+2347012345003', nps: 10, city: 'Kano', code: 'BP-JARA03', clicks: 22, conversions: 6 },
    { name: 'Taiwo Adesanya', email: 'taiwo.a@gmail.com', phone: '+2348045678004', nps: 9, city: 'Lagos', code: 'BP-JARA04', clicks: 15, conversions: 3 },
  ]
  for (const p of promoterData) {
    const { data: prom } = await sb.from('promoters').insert({
      brand_id: brandId, name: p.name, email: p.email, phone: p.phone,
      nps_score: p.nps, source: 'nps', status: 'active',
      notes: `Activated after Summer Vibes NPS pulse. ${p.nps === 10 ? 'Superfan.' : 'Highly satisfied customer.'}`,
    }).select('id').single()
    if (prom?.id) {
      await sb.from('referral_codes').insert({
        brand_id: brandId, promoter_id: prom.id, code: p.code,
        destination_url: 'https://jarafoods.com/summer',
        clicks: p.clicks, conversions: p.conversions, is_active: true,
      })
    }
  }

  /* ── 34. Customer Profiles (CDP) ─────────────────────────────────────── */
  await sb.from('customer_profiles').insert([
    { brand_id: brandId, name: 'Funke Adeleke',  email: 'funke.a@gmail.com',  phone: '+2348012345001', nps_score: 10, nps_label: 'promoter',  last_seen_at: dAgo(5),  is_promoter: true,  segments: ['promoter', 'gold-loyalty', 'jollof-fan'],       sources: { survey: true, nps: true, loyalty: true },  retention_risk_score: 5,  acquisition_source: 'loyalty' },
    { brand_id: brandId, name: 'Chidi Okonkwo',  email: 'chidi.o@yahoo.com',  phone: '+2348034567002', nps_score: 9,  nps_label: 'promoter',  last_seen_at: dAgo(8),  is_promoter: true,  segments: ['promoter', 'gold-loyalty', 'rice-buyer'],       sources: { survey: true, nps: true, loyalty: true },  retention_risk_score: 8,  acquisition_source: 'loyalty' },
    { brand_id: brandId, name: 'Amina Bello',    email: 'amina.b@gmail.com',  phone: '+2347012345003', nps_score: 10, nps_label: 'promoter',  last_seen_at: dAgo(12), is_promoter: true,  segments: ['promoter', 'silver-loyalty', 'northern-market'], sources: { survey: true, nps: true, loyalty: true },  retention_risk_score: 10, acquisition_source: 'survey' },
    { brand_id: brandId, name: 'Taiwo Adesanya', email: 'taiwo.a@gmail.com',  phone: '+2348045678004', nps_score: 9,  nps_label: 'promoter',  last_seen_at: dAgo(15), is_promoter: true,  segments: ['promoter', 'silver-loyalty'],                   sources: { nps: true, loyalty: true },                retention_risk_score: 12, acquisition_source: 'nps' },
    { brand_id: brandId, name: 'Ngozi Eze',      email: 'ngozi.e@gmail.com',  phone: '+2348056789005', nps_score: 7,  nps_label: 'passive',   last_seen_at: dAgo(18), is_promoter: false, segments: ['passive', 'silver-loyalty'],                    sources: { survey: true, loyalty: true },              retention_risk_score: 35, acquisition_source: 'survey' },
    { brand_id: brandId, name: 'Emeka Uche',     email: 'emeka.u@gmail.com',  phone: '+2348067890006', nps_score: 8,  nps_label: 'passive',   last_seen_at: dAgo(22), is_promoter: false, segments: ['passive', 'silver-loyalty'],                    sources: { nps: true, loyalty: true },                retention_risk_score: 28, acquisition_source: 'nps' },
    { brand_id: brandId, name: 'Bimpe Lawal',    email: 'bimpe.l@gmail.com',  phone: '+2348078901007', nps_score: 5,  nps_label: 'detractor', last_seen_at: dAgo(25), is_promoter: false, segments: ['detractor', 'bronze-loyalty', 'price-sensitive'], sources: { survey: true, loyalty: true },             retention_risk_score: 72, acquisition_source: 'survey' },
    { brand_id: brandId, name: 'Yusuf Garba',    email: 'yusuf.g@gmail.com',  phone: '+2347023456008', nps_score: 3,  nps_label: 'detractor', last_seen_at: dAgo(30), is_promoter: false, segments: ['detractor', 'bronze-loyalty', 'northern-market'], sources: { nps: true, loyalty: true },               retention_risk_score: 85, acquisition_source: 'nps' },
    { brand_id: brandId, name: 'Shade Williams', email: 'shade.w@gmail.com',  phone: '+2348034567009', nps_score: 7,  nps_label: 'passive',   last_seen_at: dAgo(32), is_promoter: false, segments: ['passive', 'bronze-loyalty'],                    sources: { nps: true, loyalty: true },                retention_risk_score: 42, acquisition_source: 'nps' },
    { brand_id: brandId, name: 'Ola Adeyemi',    email: 'ola.a@gmail.com',    phone: '+2348045678010', nps_score: 9,  nps_label: 'promoter',  last_seen_at: dAgo(28), is_promoter: false, segments: ['promoter', 'bronze-loyalty', 'new-customer'],  sources: { loyalty: true },                            retention_risk_score: 18, acquisition_source: 'loyalty' },
  ])

  /* ── 35. Extra social posts for richer Advocacy scores ──────────────── */
  const extraPostData = [
    { platform: 'instagram', external_id: 'ugc-ig-001', content: 'My family cannot get enough of Jara Rice 🍚 Every Sunday rice is always Jara. Na the best wey dey! #JaraFoods #SundayRice', sentiment_label: 'positive', sentiment_score: 92, reach: 4200, likes: 312, comments: 48, shares: 67, posted_at: dAgo(2) },
    { platform: 'twitter',   external_id: 'ugc-tw-001', content: 'Jara spice mix transformed my jollof. Not exaggerating. Whole family asked what was different. #JaraFoods', sentiment_label: 'positive', sentiment_score: 89, reach: 1800, likes: 145, comments: 23, shares: 89, posted_at: dAgo(3) },
    { platform: 'instagram', external_id: 'ugc-ig-002', content: 'Bought Jara Rice for the first time after seeing it on MamaTolu page. Zero regrets. The quality is proper 💯 #JaraRice', sentiment_label: 'positive', sentiment_score: 91, reach: 3600, likes: 267, comments: 31, shares: 54, posted_at: dAgo(4) },
    { platform: 'facebook',  external_id: 'ugc-fb-001', content: 'Jara Foods hamper was a blessing this festive season. My in-laws kept asking where I bought it from. 10/10 recommend!', sentiment_label: 'positive', sentiment_score: 88, reach: 2900, likes: 198, comments: 67, shares: 43, posted_at: dAgo(5) },
    { platform: 'twitter',   external_id: 'ugc-tw-002', content: 'Okay so I tried Jara oats this morning with banana and I might never go back to my old brand. This is it 😭', sentiment_label: 'positive', sentiment_score: 87, reach: 1200, likes: 89, comments: 14, shares: 31, posted_at: dAgo(6) },
    { platform: 'instagram', external_id: 'ugc-ig-003', content: 'Jara Rice restock finally came through at my Estate Shoprite. Grabbed 3 bags. You know why 😂 #JaraRice #Lagos', sentiment_label: 'positive', sentiment_score: 85, reach: 5100, likes: 421, comments: 78, shares: 102, posted_at: dAgo(7) },
    { platform: 'instagram', external_id: 'ugc-ig-004', content: 'Shoutout to @JaraFoods for making cooking less stressful for us working mums. Quick to prepare, family loves it. Keep it up 🙌', sentiment_label: 'positive', sentiment_score: 93, reach: 6800, likes: 534, comments: 112, shares: 145, posted_at: dAgo(8) },
    { platform: 'twitter',   external_id: 'ugc-tw-003', content: 'Why is Jara always out of stock at Konga? I need the 5kg bag delivered to Abuja ASAP 😩 @JaraFoods please fix your supply', sentiment_label: 'negative', sentiment_score: 22, reach: 980, likes: 12, comments: 34, shares: 8, posted_at: dAgo(9) },
    { platform: 'facebook',  external_id: 'ugc-fb-002', content: 'Been using Jara spice for 6 months now. Consistent quality every time. Not many brands can say that in Nigeria.', sentiment_label: 'positive', sentiment_score: 90, reach: 3400, likes: 256, comments: 44, shares: 67, posted_at: dAgo(10) },
    { platform: 'instagram', external_id: 'ugc-ig-005', content: 'Cooked Jara Oats for my toddler this morning — she ate the whole bowl. This is a miracle tbh 😂 #JaraFoods #MumLife', sentiment_label: 'positive', sentiment_score: 86, reach: 7200, likes: 612, comments: 134, shares: 188, posted_at: dAgo(11) },
    { platform: 'twitter',   external_id: 'ugc-tw-004', content: 'Jara Rice is honestly underrated. Quality rivals the imported brands but at a price that makes actual sense. Support local!', sentiment_label: 'positive', sentiment_score: 94, reach: 2100, likes: 178, comments: 29, shares: 112, posted_at: dAgo(13) },
    { platform: 'instagram', external_id: 'ugc-ig-006', content: 'My compound is literally having a taste test this weekend — brought Jara vs the usual suspects. Will report back 👀 #JaraFoods', sentiment_label: 'positive', sentiment_score: 82, reach: 4500, likes: 345, comments: 89, shares: 76, posted_at: dAgo(14) },
    { platform: 'facebook',  external_id: 'ugc-fb-003', content: 'Customer service at Jara responded to my complaint within 2 hours and sorted me out. That is the kind of brand I will stay loyal to.', sentiment_label: 'positive', sentiment_score: 95, reach: 1800, likes: 134, comments: 21, shares: 38, posted_at: dAgo(15) },
    { platform: 'twitter',   external_id: 'ugc-tw-005', content: 'Saw Jara Rice on a billboard on Ozumba Mbadiwe. The campaign is clean. Nigerian brands stepping up 💪 #Jara', sentiment_label: 'positive', sentiment_score: 81, reach: 1400, likes: 98, comments: 17, shares: 44, posted_at: dAgo(16) },
    { platform: 'instagram', external_id: 'ugc-ig-007', content: 'People ask me why I switched from my old rice brand. Simple: Jara. Same price range, way better texture and aroma 🤷‍♀️', sentiment_label: 'positive', sentiment_score: 90, reach: 5600, likes: 467, comments: 93, shares: 121, posted_at: dAgo(18) },
    { platform: 'twitter',   external_id: 'ugc-tw-006', content: 'The Jara oats packaging redesign looks premium. Picked it up thinking it was an imported brand 😅 Love to see it #MadeInNigeria', sentiment_label: 'positive', sentiment_score: 87, reach: 1600, likes: 121, comments: 19, shares: 56, posted_at: dAgo(20) },
    { platform: 'facebook',  external_id: 'ugc-fb-004', content: 'Jara spice mix is the one thing I pack when I travel abroad. My friends there have started ordering it through their relatives 😂 Global domination!', sentiment_label: 'positive', sentiment_score: 96, reach: 4200, likes: 389, comments: 78, shares: 156, posted_at: dAgo(22) },
    { platform: 'instagram', external_id: 'ugc-ig-008', content: 'Okay the price went up slightly but the quality is still there so I cannot be too mad. Still recommending Jara to everyone.', sentiment_label: 'neutral', sentiment_score: 58, reach: 3100, likes: 212, comments: 45, shares: 34, posted_at: dAgo(24) },
    { platform: 'twitter',   external_id: 'ugc-tw-007', content: 'Jara customer care line does not pick up sometimes. Frustrating when you have a delivery issue. Hope they fix this.', sentiment_label: 'negative', sentiment_score: 28, reach: 890, likes: 8, comments: 27, shares: 5, posted_at: dAgo(26) },
    { platform: 'instagram', external_id: 'ugc-ig-009', content: 'My mum used to laugh at me for buying "expensive rice" — now she specifically asks me to bring Jara when I visit. Vindicated! 😂 #JaraRice', sentiment_label: 'positive', sentiment_score: 93, reach: 8900, likes: 789, comments: 167, shares: 234, posted_at: dAgo(28) },
  ]
  await sb.from('social_posts').insert(extraPostData.map(p => ({
    brand_id: brandId, platform: p.platform, external_id: p.external_id,
    content: p.content, sentiment_label: p.sentiment_label, sentiment_score: p.sentiment_score,
    reach: p.reach, likes: p.likes, comments: p.comments, shares: p.shares,
    funnel_stage: 'advocacy', language_tag: 'en', posted_at: p.posted_at,
  })))

  /* ── 35. Creative Assets (Creative Library vault) ───────────────────── */
  const creativeAssets = [
    {
      title: 'Festive Season — Market Women Hero',
      description: 'Full-bleed image of a market woman proudly holding a 5kg Jara Rice bag. Warm earthy tones with a natural smile. Used for Instagram Feed and Facebook.',
      asset_type: 'image', format: 'Feed', platform: 'Instagram',
      status: 'vetted', fit_for_ads: true,
      performance: { impressions: 148000, clicks: 5920, ctr: 4.0, conversions: 890, spend: 320000, roas: 4.2 },
      notes: 'Our top performer Q4 2025. Market women imagery outperformed product-only shots by 3.1x on CTR. Brief the photographer to keep the setting recognisably local.',
      replication_elements: ['Warm earthy tones (burnt orange, deep brown)', 'Real person — not a model', 'Pidgin tagline: "Rice wey make sense"', 'Product in hand, not on table', '5kg bag prominently visible'],
      tags: ['hero', 'q4-2025', 'instagram', 'top-performer'],
    },
    {
      title: 'Ramadan Healing Recipe Reel',
      description: '30-second vertical video: hands preparing Jara spice mix into a simmering pot. Voice-over in Hausa with English subtitles. Ramadan crescent overlay in the corner.',
      asset_type: 'video', format: 'Reel', platform: 'Instagram',
      status: 'vetted', fit_for_ads: true,
      performance: { impressions: 210000, clicks: 6300, ctr: 3.0, conversions: 1260, spend: 480000, roas: 3.8 },
      notes: 'Ran during Ramadan 2026. Northern Nigeria segment drove 68% of conversions. Hausa voiceover was key — English-only test underperformed by 44%.',
      replication_elements: ['Hausa voiceover for northern Nigeria targeting', 'Cultural timing — Ramadan / suhoor angle', 'Hands-only shot keeps focus on the food', 'Subtitle both languages', '30 seconds max — 85% completion rate'],
      tags: ['ramadan', 'hausa', 'video', 'northern-nigeria', 'vetted'],
    },
    {
      title: 'Jara Rice 5kg — Price Drop Announcement',
      description: 'Simple product card: 5kg bag on white background, big red price sticker with new price, and a "Limited time" CTA. Facebook Feed and Instagram Story versions.',
      asset_type: 'image', format: 'Story', platform: 'Facebook',
      status: 'vetted', fit_for_ads: true,
      performance: { impressions: 95000, clicks: 4750, ctr: 5.0, conversions: 1425, spend: 210000, roas: 5.1 },
      notes: 'Price-led creative outperformed brand-led on Facebook by 2.7x. Facebook audience skews older (25-45) and responds to value signals more than aesthetic.',
      replication_elements: ['Price prominently front and centre', 'Red urgency colour for price sticker', 'White background keeps product the hero', '"Limited time" CTA drives FOMO', 'Facebook Story format (9:16) — separate crop from Feed version'],
      tags: ['price-led', 'facebook', 'conversion', 'vetted'],
    },
    {
      title: 'Morning Energy — Radio 30s Script',
      description: 'Radio script for morning drive-time. Opens with jingle, then a market woman voice testimonial, then an announcer with offer. Runs on Lagos and Abuja FM stations.',
      asset_type: 'copy', format: 'Radio Script', platform: 'Radio',
      status: 'vetted', fit_for_ads: false,
      performance: { impressions: 890000, spend: 1200000 },
      notes: 'Morning slot (6am-9am) outperforms midday by 2.1x for our category. The testimonial format from a real sounding market woman drives more recall than announcer-only.',
      replication_elements: ['Open with Jara jingle (under 3 seconds)', 'Testimonial voice — female, market-woman tone', 'Price mention in first 10 seconds', 'Repeat brand name 3x minimum', 'Morning slot 6-9am for Lagos and Abuja'],
      tags: ['radio', 'morning-slot', 'testimonial', 'script'],
    },
    {
      title: 'Lagos Mainland OOH — Unipole Creative',
      description: 'Billboard artwork: bold "Jara" wordmark top-left, 5kg bag centre, headline "The Rice Your Family Deserves" in large serif type. Bottom strip shows stockist logos.',
      asset_type: 'image', format: 'OOH Billboard', platform: 'Out of Home',
      status: 'vetted', fit_for_ads: true,
      performance: { impressions: 1200000, spend: 850000 },
      notes: 'Tested on two sites: Ikeja along and LASU Road. LASU Road site showed stronger brand recall (+18%) likely due to slower traffic. Simple designs outperform busy ones on OOH.',
      replication_elements: ['Max 7 words on the headline', 'High contrast — dark background with white/orange text', 'Product size should be minimum 40% of artwork', 'Stockist bar at the bottom drives retail enquiries', 'Serif headline reads as premium'],
      tags: ['ooh', 'billboard', 'lagos', 'vetted'],
    },
    {
      title: 'NPS Thank You — Email Template',
      description: 'Plain-text style email thanking NPS respondents. Includes a personalised score summary, a discount code, and a referral link. Designed to convert passives to promoters.',
      asset_type: 'copy', format: 'Email', platform: 'Email',
      status: 'vetted', fit_for_ads: false,
      performance: { impressions: 3400, clicks: 680, ctr: 20.0, conversions: 204 },
      notes: 'Plain text outperformed HTML template by 34% on open rate. Personalised subject line ("Funke, here is what you said") beat generic by 51%.',
      replication_elements: ['Plain text format — higher open rates', 'Personalised subject with first name', 'Acknowledge their specific NPS score', 'Single CTA only', 'Discount code for detractors: "FEEDBACK10"'],
      tags: ['email', 'nps', 'retention', 'template'],
    },
    {
      title: 'Influencer Brief — Mama Tolu Collaboration',
      description: 'Creative brief for micro-influencer @MamaTolu (85k followers, Lagos food/home content). Covers messaging pillars, do/dont list, required hashtags, and deliverables.',
      asset_type: 'copy', format: 'Brief', platform: 'Instagram',
      status: 'active', fit_for_ads: false,
      performance: { impressions: 62000, clicks: 1860, ctr: 3.0, conversions: 186 },
      notes: 'Mama Tolu delivers consistently. Her audience trusts her cooking recommendations. Let her keep her natural style — briefs that over-script always underperform.',
      replication_elements: ['Let the creator keep their natural voice', 'Product integration — cooking scene, not product shot', 'Require "authentic use" — not just hold-to-camera', 'Hashtag: #JaraKitchen minimum', 'Brief: max 1 page — creators skip long briefs'],
      tags: ['influencer', 'brief', 'micro-influencer', 'instagram'],
    },
    {
      title: 'Christmas Hamper Launch — Carousel',
      description: '5-slide carousel: slide 1 hero hamper shot, slides 2-4 show individual products with prices, slide 5 is a CTA to order a hamper. Designed for Instagram and Facebook.',
      asset_type: 'carousel', format: 'Feed Carousel', platform: 'Instagram',
      status: 'vetted', fit_for_ads: true,
      performance: { impressions: 175000, clicks: 8750, ctr: 5.0, conversions: 1312, spend: 390000, roas: 4.8 },
      notes: 'Carousels drove 2.4x more saves than single images during the festive period. Slide 3 (spice mix) had the highest swipe-through rate — consider leading with it.',
      replication_elements: ['Slide 1 must create curiosity — not reveal everything', 'Price each item on its own slide', 'Final slide is always the CTA', 'Warm red/gold palette for festive angle', 'Include "swipe to see more" text on slide 1'],
      tags: ['christmas', 'carousel', 'festive', 'instagram', 'top-performer'],
    },
    {
      title: 'Jara x Oga Chef — Recipe Card Print',
      description: 'A5 recipe card: Oga Chef portrait on left, recipe steps on right. Features Jara Rice prominently in the ingredient list. Distributed in-store and at events.',
      asset_type: 'image', format: 'Print', platform: 'Print',
      status: 'active', fit_for_ads: false,
      performance: { impressions: 22000 },
      notes: "Recipe cards distributed at Shoprite Lagos and events. Drives in-store trial better than vouchers. Oga Chef's face drives credibility with the core 30-50 age group.",
      replication_elements: ['Recipe format (not ad) — people keep it', 'Celebrity / chef association for credibility', 'A5 format fits in a handbag', 'QR code to video tutorial on back', 'Brand logo bottom right — understated'],
      tags: ['print', 'recipe-card', 'oga-chef', 'in-store'],
    },
    {
      title: 'New Year New Kitchen — Campaign Teaser',
      description: 'Split-screen video teaser: left shows a tired kitchen with generic brands; right shows a vibrant kitchen with Jara. 15-second cut for Story/Reel.',
      asset_type: 'video', format: 'Story / Reel', platform: 'Instagram',
      status: 'active', fit_for_ads: true,
      performance: { impressions: 88000, clicks: 2640, ctr: 3.0, spend: 195000 },
      notes: 'Currently in testing for Q1 2027 campaign. Before/after format performs well in January when people are in "new year" mindset.',
      replication_elements: ['Before/after contrast is instantly readable', '15 seconds max for awareness play', 'No voiceover — music only in first 3 seconds', 'Open loop — the "after" side should make them want to know more', 'End on strong brand frame'],
      tags: ['video', 'teaser', 'new-year', 'before-after'],
    },
    // ── Fatigue signal assets ────────────────────────────────────────────
    {
      title: 'Summer Vibes Launch Ad — Facebook',
      description: 'Facebook feed image ad for the Summer Vibes campaign. Product pack shot with orange background, "Beat the Heat" headline. Has been running continuously since launch.',
      asset_type: 'image', format: 'Feed', platform: 'Facebook',
      status: 'active', fit_for_ads: true,
      performance: { impressions: 1240000, clicks: 14880, ctr: 1.2, conversions: 1190, spend: 2100000, roas: 2.1, frequency: 5.8 },
      notes: 'Original Summer Vibes launch ad — running 82 days unrefreshed. Meta Ads Manager flagging high frequency. Audience is tuning out. Need fresh creative ASAP.',
      replication_elements: ['Orange background aligns with brand palette', '"Beat the Heat" seasonal hook resonated at launch', 'Refresh with lifestyle instead of product-only — market women format likely to reset frequency response'],
      tags: ['summer-vibes', 'facebook', 'active', 'needs-refresh'],
      _created_at: dAgo(82),
    },
    {
      title: 'Jara Oats — Morning Routine Reel',
      description: '30-second Instagram Reel showing a Lagos professional making Jara Oats in the morning rush. Upbeat afrobeats soundtrack. Part of the Q1 brand refresh.',
      asset_type: 'video', format: 'Reel', platform: 'Instagram',
      status: 'active', fit_for_ads: true,
      performance: { impressions: 620000, clicks: 13020, ctr: 2.1, conversions: 1116, spend: 890000, roas: 3.2, frequency: 4.2 },
      notes: 'Good creative but high frequency on core Lagos Millennial segment. CTR declining week-on-week (started at 3.4%, now 2.1%). A/B test with a new script or swap out with a different talent.',
      replication_elements: ['Morning routine format is relatable — keep the scenario', 'Afrobeats hook in first 3 seconds is doing the heavy lifting', 'Talent refresh (new face) often resets frequency decay better than new concept'],
      tags: ['oats', 'reel', 'instagram', 'morning-routine', 'active'],
      _created_at: dAgo(54),
    },
    {
      title: 'Jara Rice 5kg — Google Display Banner',
      description: 'Responsive Google Display banner set (300x250, 728x90, 160x600). Product hero with "Nigeria\'s Favourite Rice" tagline and price callout. Running on Google Display Network.',
      asset_type: 'image', format: 'Display Banner', platform: 'Google',
      status: 'active', fit_for_ads: true,
      performance: { impressions: 3400000, clicks: 85000, ctr: 2.5, conversions: 3825, spend: 1250000, roas: 3.4, frequency: 3.6 },
      notes: 'GDN banner running 49 days. CTR started at 3.8%, trending toward 2.5% — plan creative refresh within 10-14 days before further decline.',
      replication_elements: ['Price callout critical for Display — always include', '"Nigeria\'s Favourite" social proof claim is strong anchor', 'Refresh headline and image while keeping price callout format'],
      tags: ['google', 'display', 'banner', 'active'],
      _created_at: dAgo(49),
    },
  ]

  for (const asset of creativeAssets) {
    const { _created_at, ...rest } = asset as typeof asset & { _created_at?: string }
    await sb.from('creative_assets').insert({
      brand_id:             brandId,
      title:                rest.title,
      description:          rest.description,
      asset_type:           rest.asset_type,
      format:               rest.format,
      platform:             rest.platform,
      status:               rest.status,
      fit_for_ads:          rest.fit_for_ads,
      performance:          rest.performance,
      notes:                rest.notes,
      replication_elements: rest.replication_elements,
      tags:                 rest.tags,
      ...((_created_at) ? { created_at: _created_at } : {}),
    })
  }

  /* ── 36. Update brand_voice on the brand record ──────────────────────── */
  await sb.from('brands').update({
    brand_voice: {
      adjectives:       ['Warm', 'Grounded', 'Confident', 'Playful', 'Authentic'],
      tone:             'Jara Foods speaks like a trusted market auntie who knows her food — warm, direct, a little cheeky. She does not oversell. She tells you what is good and why, and she sounds like someone you would actually run into at Shoprite or Balogun Market.',
      dos:              [
        'Use everyday Naija language — English, Pidgin, or a natural mix',
        'Centre the family and the kitchen as the heart of Nigerian life',
        'Be concrete: talk about taste, smell, value for money',
      ],
      donts:            [
        'No corporate speak or imported brand language',
        'Never claim perfection — honest brands admit trade-offs',
        'Do not over-hashtag or use empty buzzwords like "premium" without proof',
      ],
      signaturePhrases: [
        'Rice wey make sense.',
        'Na Jara be that.',
        'Cook with love. Eat with pride.',
      ],
      kapferer_prism: {
        physique:     'Bold Jara wordmark in deep red-orange. 5kg bag is recognisable on shelf and in hand. Warm earthy colours throughout — nothing clinical or sterile.',
        personality:  'The friendly, knowledgeable food auntie. Confident but never arrogant. Has opinions. Makes you laugh.',
        culture:      'Deeply Nigerian. Family gatherings, real kitchens, real women, real food. Values: community, nourishment, pride in local produce.',
        relationship: 'Peer — not instructor. Jara does not lecture about nutrition; it talks to you like someone who genuinely loves food and wants you to eat well.',
        reflection:   'The savvy Nigerian homemaker who knows quality from quantity. She is educated, value-conscious, and proud of her table.',
        self_image:   'Using Jara means I feed my family well. I am not compromising on quality to save money — I am being smart about it.',
      },
    },
  }).eq('id', brandId)

  /* ── Done ─────────────────────────────────────────────────────────────── */
  /* ── 37. Field Intelligence — FSO teams, reports, outlets ───────────── */

  // 3 FSO teams covering different regions
  const { data: lagosTeam } = await sb.from('fso_teams').insert({
    brand_id: brandId, workspace_id: wsId, name: 'Lagos & South-West FSO', active: true,
    notes: 'Covers Lagos, Ogun, Oyo, Ondo, Osun. Lead: Adebola Adeyemi',
  }).select('id').single()

  const { data: northTeam } = await sb.from('fso_teams').insert({
    brand_id: brandId, workspace_id: wsId, name: 'North & FCT FSO', active: true,
    notes: 'Covers Abuja, Kano, Kaduna, Katsina. Lead: Musa Aliyu',
  }).select('id').single()

  const { data: seTeam } = await sb.from('fso_teams').insert({
    brand_id: brandId, workspace_id: wsId, name: 'South-East & South-South FSO', active: true,
    notes: 'Covers Rivers, Enugu, Anambra, Delta, Cross River. Lead: Chidi Okechi',
  }).select('id').single()

  // Field reports: 25 reports across 30 days, 3 regions
  type TeamLiteral = 'lagos' | 'north' | 'se'
  const reportDefs: Array<{
    team: TeamLiteral; fso: string; code: string; d: number; state: string; lga: string; notes: string
  }> = [
    { team: 'lagos', fso: 'Adebola Adeyemi',    code: 'FSO-L01', d: 1,  state: 'Lagos',  lga: 'Ikeja',       notes: 'Good visibility in supermarkets. Competitor shelf next to ours in 3 locations.' },
    { team: 'lagos', fso: 'Chukwuemeka Obi',    code: 'FSO-L02', d: 1,  state: 'Lagos',  lga: 'Lekki',       notes: 'Strong Jara presence. Festival season stocking noted at ShopRite.' },
    { team: 'north', fso: 'Musa Aliyu',          code: 'FSO-N01', d: 1,  state: 'Kano',   lga: 'Kano Municipal', notes: 'Stock running low at 2 major distributors. Reorder triggered.' },
    { team: 'north', fso: 'Halima Sule',         code: 'FSO-N02', d: 2,  state: 'FCT',    lga: 'Garki',       notes: 'Abuja coverage solid. Maitama supermarkets well-stocked.' },
    { team: 'se',    fso: 'Chidi Okechi',        code: 'FSO-SE1', d: 2,  state: 'Rivers', lga: 'Port Harcourt', notes: 'Mama\'s Pride very aggressive with promos this week.' },
    { team: 'lagos', fso: 'Adebola Adeyemi',    code: 'FSO-L01', d: 3,  state: 'Lagos',  lga: 'Surulere',    notes: 'Open market coverage. Traders asking for credit terms.' },
    { team: 'lagos', fso: 'Blessing Akande',     code: 'FSO-L03', d: 3,  state: 'Lagos',  lga: 'Alimosho',    notes: 'Alimosho market huge volume opportunity. Route under-covered historically.' },
    { team: 'north', fso: 'Musa Aliyu',          code: 'FSO-N01', d: 4,  state: 'Kano',   lga: 'Nassarawa',   notes: 'POSM compliance improving after last month\'s team training.' },
    { team: 'se',    fso: 'Ngozi Anyanwu',       code: 'FSO-SE2', d: 4,  state: 'Enugu',  lga: 'Enugu North', notes: 'Local brands (Enugu Best Rice) undercutting on price by ₦300.' },
    { team: 'lagos', fso: 'Chukwuemeka Obi',    code: 'FSO-L02', d: 5,  state: 'Lagos',  lga: 'Victoria Island', notes: 'Premium stores stocked well. Observed premium competitor Uncle Ben\'s promo stand.' },
    { team: 'north', fso: 'Halima Sule',         code: 'FSO-N02', d: 6,  state: 'FCT',    lga: 'Wuse',        notes: 'Wuse market visit — 8 of 10 outlets stocked. Good penetration.' },
    { team: 'se',    fso: 'Chidi Okechi',        code: 'FSO-SE1', d: 6,  state: 'Rivers', lga: 'Obio-Akpor',  notes: 'New distributor onboarded — Dike Stores, GRA. Very promising outlet.' },
    { team: 'lagos', fso: 'Adebola Adeyemi',    code: 'FSO-L01', d: 7,  state: 'Lagos',  lga: 'Badagry',     notes: 'Border town — import-brand competition from Ghana Obroni Rice noted. Need attention.' },
    { team: 'north', fso: 'Musa Aliyu',          code: 'FSO-N01', d: 8,  state: 'Kaduna', lga: 'Kaduna North', notes: 'First visit to Kaduna route. Awareness low, distribution thin. Opportunity.' },
    { team: 'lagos', fso: 'Blessing Akande',     code: 'FSO-L03', d: 9,  state: 'Ogun',   lga: 'Sagamu',      notes: 'Route expansion into Ogun. Pharmacies stocking Jara Oats surprisingly well.' },
    { team: 'se',    fso: 'Ngozi Anyanwu',       code: 'FSO-SE2', d: 10, state: 'Anambra', lga: 'Onitsha',    notes: 'Onitsha main market — high footfall. ChowMate has strong presence here.' },
    { team: 'lagos', fso: 'Chukwuemeka Obi',    code: 'FSO-L02', d: 11, state: 'Lagos',  lga: 'Yaba',        notes: 'Student zone. Jara Oats 500g doing well. Request for smaller SKU (200g).' },
    { team: 'north', fso: 'Halima Sule',         code: 'FSO-N02', d: 12, state: 'Kano',   lga: 'Fagge',       notes: 'Fagge market strong. 3 new outlets onboarded. POSM material needed.' },
    { team: 'se',    fso: 'Chidi Okechi',        code: 'FSO-SE1', d: 13, state: 'Rivers', lga: 'Port Harcourt', notes: 'Follow-up visit. Mama\'s Pride running buy-2-get-1 promo at Rumuola outlets.' },
    { team: 'lagos', fso: 'Adebola Adeyemi',    code: 'FSO-L01', d: 14, state: 'Lagos',  lga: 'Ikeja',       notes: 'Restock confirmed at key Ikeja accounts. Promo display set up at 4 supermarkets.' },
    { team: 'north', fso: 'Musa Aliyu',          code: 'FSO-N01', d: 15, state: 'FCT',    lga: 'Maitama',     notes: 'Premium FCT outlets. Price compliance good. All RRP-aligned.' },
    { team: 'se',    fso: 'Ngozi Anyanwu',       code: 'FSO-SE2', d: 16, state: 'Delta',  lga: 'Asaba',       notes: 'New territory — Delta state. Awareness building needed. Distributed 50 sample packs.' },
    { team: 'lagos', fso: 'Blessing Akande',     code: 'FSO-L03', d: 18, state: 'Lagos',  lga: 'Mushin',      notes: 'Price sensitivity high in Mushin. Traders requesting smaller wholesale pack.' },
    { team: 'north', fso: 'Halima Sule',         code: 'FSO-N02', d: 20, state: 'Kano',   lga: 'Kano Municipal', notes: 'Restocked 2 distributors. Noted ChowMate field team in area — very active.' },
    { team: 'lagos', fso: 'Chukwuemeka Obi',    code: 'FSO-L02', d: 22, state: 'Lagos',  lga: 'Ajah',        notes: 'Lekki-Ajah corridor. New Shoprite branch — Jara Rice on shelf from day 1.' },
  ]

  const teamMap: Record<TeamLiteral, string | undefined> = {
    lagos: lagosTeam?.id,
    north: northTeam?.id,
    se:    seTeam?.id,
  }

  // Outlet data templates per area
  type OutletTemplate = {
    outlet_name: string; outlet_type: 'supermarket' | 'neighbourhood_shop' | 'pharmacy' | 'open_market' | 'petrol_station' | 'hospital' | 'other'
    product_available: boolean; facings_count: number; stock_level: 'full' | 'partial' | 'out_of_stock'
    observed_price_ngn: number; rrp_ngn: number; posm_present: boolean; posm_condition: 'good' | 'damaged' | 'absent'
    competitor_name: string | null; competitor_activity: string | null; lat: number; lng: number
  }

  const lagosOutlets: OutletTemplate[] = [
    { outlet_name: 'ShopRite Ikeja',           outlet_type: 'supermarket',        product_available: true,  facings_count: 8,  stock_level: 'full',         observed_price_ngn: 4500,  rrp_ngn: 4500,  posm_present: true,  posm_condition: 'good',    competitor_name: 'Golden Penny', competitor_activity: 'Promo standee beside Jara shelf', lat: 6.6018, lng: 3.3515 },
    { outlet_name: 'Justrite Superstore Yaba', outlet_type: 'supermarket',        product_available: true,  facings_count: 6,  stock_level: 'full',         observed_price_ngn: 4500,  rrp_ngn: 4500,  posm_present: true,  posm_condition: 'good',    competitor_name: null,           competitor_activity: null,                               lat: 6.5095, lng: 3.3779 },
    { outlet_name: 'Mama Titi Provision Store',outlet_type: 'neighbourhood_shop', product_available: true,  facings_count: 3,  stock_level: 'partial',      observed_price_ngn: 4600,  rrp_ngn: 4500,  posm_present: false, posm_condition: 'absent',  competitor_name: 'Uncle Ben\'s', competitor_activity: 'Placed next to Jara, same shelf', lat: 6.5244, lng: 3.3792 },
    { outlet_name: 'Conoil Filling Station Shop',outlet_type: 'petrol_station',   product_available: true,  facings_count: 2,  stock_level: 'partial',      observed_price_ngn: 4750,  rrp_ngn: 4500,  posm_present: false, posm_condition: 'absent',  competitor_name: null,           competitor_activity: null,                               lat: 6.4350, lng: 3.4168 },
    { outlet_name: 'Eko Supermarket Lekki',    outlet_type: 'supermarket',        product_available: true,  facings_count: 10, stock_level: 'full',         observed_price_ngn: 4500,  rrp_ngn: 4500,  posm_present: true,  posm_condition: 'good',    competitor_name: 'ChowMate',     competitor_activity: 'End-of-aisle display, large promo', lat: 6.4698, lng: 3.5852 },
    { outlet_name: 'Bigi Market Surulere',     outlet_type: 'open_market',        product_available: true,  facings_count: 4,  stock_level: 'partial',      observed_price_ngn: 4400,  rrp_ngn: 4500,  posm_present: false, posm_condition: 'absent',  competitor_name: 'Mama\'s Pride', competitor_activity: 'Trader selling side by side',     lat: 6.5023, lng: 3.3578 },
    { outlet_name: 'Ruff n Tumble Pharmacy',   outlet_type: 'pharmacy',           product_available: true,  facings_count: 2,  stock_level: 'full',         observed_price_ngn: 4500,  rrp_ngn: 4500,  posm_present: true,  posm_condition: 'damaged', competitor_name: null,           competitor_activity: null,                               lat: 6.4281, lng: 3.4219 },
    { outlet_name: 'SPAR Maryland',            outlet_type: 'supermarket',        product_available: true,  facings_count: 12, stock_level: 'full',         observed_price_ngn: 4500,  rrp_ngn: 4500,  posm_present: true,  posm_condition: 'good',    competitor_name: 'Uncle Ben\'s', competitor_activity: 'Premium shelf positioning',        lat: 6.5683, lng: 3.3574 },
  ]

  const northOutlets: OutletTemplate[] = [
    { outlet_name: 'Sani Abacha Way Provision', outlet_type: 'neighbourhood_shop', product_available: true,  facings_count: 3,  stock_level: 'partial',      observed_price_ngn: 4500,  rrp_ngn: 4500,  posm_present: true,  posm_condition: 'good',    competitor_name: null,       competitor_activity: null,                                    lat: 12.0022, lng: 8.5920 },
    { outlet_name: 'Kano Central Market',       outlet_type: 'open_market',        product_available: true,  facings_count: 5,  stock_level: 'partial',      observed_price_ngn: 4300,  rrp_ngn: 4500,  posm_present: false, posm_condition: 'absent',  competitor_name: 'ChowMate', competitor_activity: 'Bulk discount offers from ChowMate agent', lat: 12.0011, lng: 8.6135 },
    { outlet_name: 'Maiduguri Road Supermarket',outlet_type: 'supermarket',        product_available: false, facings_count: 0,  stock_level: 'out_of_stock', observed_price_ngn: 0,     rrp_ngn: 4500,  posm_present: false, posm_condition: 'absent',  competitor_name: 'Golden Penny', competitor_activity: 'Took Jara shelf space during stockout', lat: 12.0118, lng: 8.5800 },
    { outlet_name: 'Wuse Zone 4 Provision',    outlet_type: 'neighbourhood_shop', product_available: true,  facings_count: 4,  stock_level: 'full',         observed_price_ngn: 4500,  rrp_ngn: 4500,  posm_present: true,  posm_condition: 'good',    competitor_name: null,       competitor_activity: null,                                    lat: 9.0625,  lng: 7.4836 },
    { outlet_name: 'Game Stores Abuja',         outlet_type: 'supermarket',        product_available: true,  facings_count: 8,  stock_level: 'full',         observed_price_ngn: 4500,  rrp_ngn: 4500,  posm_present: true,  posm_condition: 'good',    competitor_name: 'Uncle Ben\'s', competitor_activity: 'Special promotion with recipe card', lat: 9.0735, lng: 7.4905 },
    { outlet_name: 'Nassarawa Bulk Store',      outlet_type: 'neighbourhood_shop', product_available: true,  facings_count: 6,  stock_level: 'full',         observed_price_ngn: 4500,  rrp_ngn: 4500,  posm_present: false, posm_condition: 'absent',  competitor_name: null,       competitor_activity: null,                                    lat: 11.9980, lng: 8.5958 },
    { outlet_name: 'Apo Mechanic Open Market',  outlet_type: 'open_market',        product_available: true,  facings_count: 2,  stock_level: 'partial',      observed_price_ngn: 4200,  rrp_ngn: 4500,  posm_present: false, posm_condition: 'absent',  competitor_name: 'Mama\'s Pride', competitor_activity: 'Competing at ₦3,800 — undercutting by ₦700', lat: 9.0217, lng: 7.5188 },
  ]

  const seOutlets: OutletTemplate[] = [
    { outlet_name: 'Rumuola Fresh Mart',        outlet_type: 'supermarket',        product_available: true,  facings_count: 6,  stock_level: 'full',         observed_price_ngn: 4500,  rrp_ngn: 4500,  posm_present: true,  posm_condition: 'good',    competitor_name: "Mama's Pride", competitor_activity: "Buy-2-get-1 promotion board outside", lat: 4.8396,  lng: 7.0085 },
    { outlet_name: 'Mile 1 Market Diobu',       outlet_type: 'open_market',        product_available: true,  facings_count: 4,  stock_level: 'partial',      observed_price_ngn: 4350,  rrp_ngn: 4500,  posm_present: false, posm_condition: 'absent',  competitor_name: "Mama's Pride", competitor_activity: 'Very visible with red branded sacks', lat: 4.8143,  lng: 6.9825 },
    { outlet_name: 'Enugu Coal Camp Provision', outlet_type: 'neighbourhood_shop', product_available: true,  facings_count: 3,  stock_level: 'partial',      observed_price_ngn: 4500,  rrp_ngn: 4500,  posm_present: false, posm_condition: 'absent',  competitor_name: 'Enugu Best Rice', competitor_activity: 'Local brand at ₦4,100 — big price gap', lat: 6.4507,  lng: 7.5128 },
    { outlet_name: 'Shoprite Enugu',            outlet_type: 'supermarket',        product_available: true,  facings_count: 10, stock_level: 'full',         observed_price_ngn: 4500,  rrp_ngn: 4500,  posm_present: true,  posm_condition: 'good',    competitor_name: 'Golden Penny', competitor_activity: 'Standard shelf, no promo',           lat: 6.4698,  lng: 7.5093 },
    { outlet_name: 'Onitsha Head Bridge Market', outlet_type: 'open_market',       product_available: false, facings_count: 0,  stock_level: 'out_of_stock', observed_price_ngn: 0,     rrp_ngn: 4500,  posm_present: false, posm_condition: 'absent',  competitor_name: 'ChowMate',     competitor_activity: 'ChowMate dominant at Head Bridge — 60% of rice shelf', lat: 6.1478, lng: 6.7836 },
    { outlet_name: 'GRA Pharmacy & Store PH',   outlet_type: 'pharmacy',           product_available: true,  facings_count: 2,  stock_level: 'full',         observed_price_ngn: 4500,  rrp_ngn: 4500,  posm_present: true,  posm_condition: 'good',    competitor_name: null,           competitor_activity: null,                                   lat: 4.8156,  lng: 7.0498 },
    { outlet_name: 'Asaba Mall Superstore',     outlet_type: 'supermarket',        product_available: true,  facings_count: 5,  stock_level: 'partial',      observed_price_ngn: 4500,  rrp_ngn: 4500,  posm_present: true,  posm_condition: 'damaged', competitor_name: 'Uncle Ben\'s', competitor_activity: 'Better positioned at eye level',     lat: 6.1835,  lng: 6.7341 },
  ]

  const outletsByTeam: Record<TeamLiteral, OutletTemplate[]> = {
    lagos: lagosOutlets,
    north: northOutlets,
    se:    seOutlets,
  }

  let fieldReportCount = 0
  let fieldOutletCount = 0

  for (const rd of reportDefs) {
    const teamId = teamMap[rd.team]
    if (!teamId) continue

    const { data: fr } = await sb.from('field_reports').insert({
      brand_id: brandId, workspace_id: wsId, fso_team_id: teamId,
      fso_name: rd.fso, fso_id_code: rd.code,
      report_date: dAgo(rd.d), submitted_at: tsAgo(rd.d, 17),
      state: rd.state, lga: rd.lga, notes: rd.notes,
    }).select('id').single()

    if (!fr?.id) continue
    fieldReportCount++

    // Sample 4-6 outlets from the team's territory
    const pool = outletsByTeam[rd.team]
    const count = 4 + (fieldReportCount % 3)
    const slice = pool.slice(0, count)

    for (const o of slice) {
      await sb.from('field_report_outlets').insert({
        field_report_id: fr.id, brand_id: brandId,
        outlet_name: o.outlet_name, outlet_type: o.outlet_type,
        product_available: o.product_available, facings_count: o.facings_count,
        stock_level: o.stock_level, observed_price_ngn: o.observed_price_ngn || null,
        rrp_ngn: o.rrp_ngn, posm_present: o.posm_present, posm_condition: o.posm_condition,
        competitor_name: o.competitor_name, competitor_activity: o.competitor_activity,
        lat: o.lat, lng: o.lng,
      })
      fieldOutletCount++
    }
  }

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
      geoAudiences:        2,
      oohSearchUplift:     8,
      mentions:            mentionInserts.length,
      surveyResponses:     npsScores.length + 15 + 20 + 25 + 10,  // BH + perception + awareness + postNPS + recall
      npsRecords:          100,
      perceptionSurvey:    1,
      awarenessSurvey:     1,
      postNpsSurvey:       1,
      surveyPanels:        2,
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
      geoLiftStudies:      7,  // 3 historical + 4 OOH-linked Summer Vibes
      pressMentions:       12,
      marketplaceProducts: 5,
      marketplaceSnapshots: 40,
      marketplaceReviews:  4,
      budgetPlan:          1,
      budgetLineItems:     7,
      budgetActuals:       9,
      loyaltyProgram:      1,
      loyaltyTiers:        3,
      loyaltyMembers:      10,
      loyaltyRewards:      4,
      abExperiments:       3,
      advocacyScores:      12,
      promoters:           4,
      customerProfiles:    10,
      creativeAssets:      13,
      brandVoiceUpdated:   true,
      extraSocialPosts:    20,
      fsoTeams:            3,
      fieldReports:        fieldReportCount,
      fieldOutlets:        fieldOutletCount,
    },
  })
}
