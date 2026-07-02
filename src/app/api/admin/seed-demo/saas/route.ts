import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'

/* ─────────────────────────────────────────────────────────────────────────────
   Demo account: Bridger CRM — Nigerian B2B SaaS brand
   Story arc: solid baseline → Zoho Nigeria launch dip (d~260-220) →
              Built for Nigeria campaign recovery (d~220-150) →
              Enterprise tier announcement lift (d~150-70) →
              Recent position: strong, stable ~78
───────────────────────────────────────────────────────────────────────────── */

const DEMO_EMAIL    = 'demo@bridgercrm.brandpulse.ai'
const DEMO_PASSWORD = 'Demo@Bridger2026!'
const SEED_SECRET   = 'seed-bridger-demo-2026'
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

/* ── Sentiment arc ───────────────────────────────────────────────────────── */

function sentScore(d: number): number {
  let base: number
  if      (d >= 260) base = 68
  else if (d >= 220) base = 68 - (d - 220) / 40 * 7
  else if (d >= 150) base = 61 + (220 - d) / 70 * 9
  else if (d >= 70)  base = 70 + (150 - d) / 80 * 7
  else               base = 77 + (70 - d) * 0.04
  const noise = Math.sin(d * 1.3) * 2.1 + Math.cos(d * 0.9) * 1.4
  return +(Math.min(95, Math.max(18, base + noise)).toFixed(1))
}

/* ───────────────────────────────────────────────────────────────────────────
   POST /api/admin/seed-demo/saas
   Header: x-seed-secret: seed-bridger-demo-2026
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
    const { data: mems } = await sb.from('workspace_members').select('workspace_id').eq('user_id', userId)
    for (const m of mems ?? []) {
      await sb.from('workspaces').delete().eq('id', m.workspace_id)
    }
  } else {
    const { data: created, error: authErr } = await sb.auth.admin.createUser({
      email:         DEMO_EMAIL,
      password:      DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { name: 'Emeka Okonkwo', role: 'Head of Marketing' },
    })
    if (authErr || !created?.user) {
      return NextResponse.json({ error: authErr?.message ?? 'User creation failed' }, { status: 500 })
    }
    userId = created.user.id
  }

  /* ── 2. Workspace ─────────────────────────────────────────────────────── */
  const { data: ws, error: wsErr } = await sb.from('workspaces').insert({
    name: 'Bridger (Pro plan)', plan: 'pro', type: 'brand',
    industry: 'SaaS / Technology', base_currency: 'NGN',
  }).select('id').single()
  if (wsErr) return NextResponse.json({ error: wsErr.message }, { status: 500 })
  const wsId = ws.id

  await sb.from('workspace_members').insert({ workspace_id: wsId, user_id: userId, role: 'owner' })

  /* ── 3. Brand ─────────────────────────────────────────────────────────── */
  const { data: brand, error: brandErr } = await sb.from('brands').insert({
    workspace_id:    wsId,
    name:            'Bridger CRM',
    category:        'SaaS / Technology',
    primary_color:   '#0F4C81',
    secondary_color: '#00C6A7',
    brand_values:    ['Built for Nigeria', 'Simplicity', 'Reliability', 'Local First'],
    cultural_profile: {
      community_corporate: 60,
      traditional_modern:  70,
      religious_secular:   20,
      mass_premium:        65,
      local_global:        55,
    },
    target_segments: [
      { name: 'Nigerian SMEs',        size: '50-200 employees', income: 'growth-stage',  location: 'Lagos / Abuja' },
      { name: 'Growing Sales Teams',  size: '10-50 reps',       income: 'mid-market',    location: 'Pan-Nigeria'   },
      { name: 'Enterprise Accounts',  size: '200+ employees',   income: 'enterprise',    location: 'Lagos / Abuja' },
    ],
    brand_voice: {
      tone:          'practical, knowledgeable, friendly, empowering',
      personality:   'The local expert who understands Nigerian business better than any imported tool',
      language_mix:  { english: 85, pidgin: 10, yoruba: 3, igbo: 2 },
    },
    bhi_weights: {
      awareness: 0.20, consideration: 0.15, preference: 0.20,
      advocacy: 0.15, nps: 0.15, sentiment: 0.10, sov: 0.05,
    },
  }).select('id').single()
  if (brandErr) return NextResponse.json({ error: brandErr.message }, { status: 500 })
  const brandId = brand.id

  /* ── 4. Competitors ───────────────────────────────────────────────────── */
  await sb.from('competitors').insert([
    {
      brand_id: brandId, name: 'HubSpot Nigeria',
      social_handles: { twitter: '@HubSpotNigeria', linkedin: 'hubspot' },
      website_url: 'https://hubspot.com',
    },
    {
      brand_id: brandId, name: 'Zoho CRM',
      social_handles: { twitter: '@ZohoCRM', linkedin: 'zoho-crm' },
      website_url: 'https://zoho.com/crm',
    },
    {
      brand_id: brandId, name: 'Salesforce Essentials',
      social_handles: { twitter: '@SalesforceNG', linkedin: 'salesforce' },
      website_url: 'https://salesforce.com/essentials',
    },
    {
      brand_id: brandId, name: 'Freshsales',
      social_handles: { twitter: '@freshsales', linkedin: 'freshsales' },
      website_url: 'https://freshworks.com/crm',
    },
    {
      brand_id: brandId, name: 'Odoo',
      social_handles: { twitter: '@odoo', linkedin: 'odoo' },
      website_url: 'https://odoo.com',
    },
  ])

  /* ── 5. Campaigns ─────────────────────────────────────────────────────── */
  const { data: camp1 } = await sb.from('campaigns').insert({
    brand_id: brandId, name: 'Built for Nigeria',
    description: 'Integrated awareness campaign celebrating Bridger CRM built for Nigerian SMEs. Digital + PR + content.',
    objective: 'awareness', status: 'completed',
    start_date: dAgo(180), end_date: dAgo(120),
    total_budget: 14_000_000, currency: 'NGN',
    ai_summary: 'The Built for Nigeria campaign drove a 9-point sentiment uplift over 60 days. LinkedIn and Twitter thought leadership content generated 3.8M impressions. Product demo signups increased 41% above baseline. Sentiment climbed from 65 to 74 during the campaign window.',
  }).select('id').single()

  const { data: camp2 } = await sb.from('campaigns').insert({
    brand_id: brandId, name: 'Enterprise Tier Launch',
    description: 'Awareness and demand generation push for the new Bridger Enterprise tier. Digital + events.',
    objective: 'awareness', status: 'active',
    start_date: dAgo(30), end_date: dAgo(-60),
    total_budget: 22_000_000, currency: 'NGN',
    ai_summary: null,
  }).select('id').single()

  const { data: camp3 } = await sb.from('campaigns').insert({
    brand_id: brandId, name: 'SME Growth Webinar Series',
    description: 'Consideration campaign targeting Nigerian SME founders and sales leads through educational webinars.',
    objective: 'consideration', status: 'completed',
    start_date: dAgo(90), end_date: dAgo(50),
    total_budget: 3_500_000, currency: 'NGN',
    ai_summary: 'Webinar series delivered 2,400 registrations across 4 sessions. 38% of attendees converted to free trial. Content marketing drove 62% lower CAC vs paid digital. Recommend quarterly cadence.',
  }).select('id').single()

  const { data: camp4 } = await sb.from('campaigns').insert({
    brand_id: brandId, name: 'Q3 LinkedIn B2B Push',
    description: 'LinkedIn-first acquisition campaign targeting Nigerian sales directors and business owners.',
    objective: 'acquisition', status: 'planned',
    start_date: dAgo(-7), end_date: dAgo(-67),
    total_budget: 8_000_000, currency: 'NGN',
    ai_summary: null,
  }).select('id').single()

  const camp1Id = camp1?.id
  const camp2Id = camp2?.id
  const camp3Id = camp3?.id
  const camp4Id = camp4?.id

  if (camp1Id) await sb.from('campaign_channels').insert([
    { campaign_id: camp1Id, channel: 'digital', budget_allocation: 6_000_000, notes: 'LinkedIn + Twitter awareness' },
    { campaign_id: camp1Id, channel: 'pr',       budget_allocation: 4_000_000, notes: 'TechCabal, Techpoint, BusinessDay PR' },
    { campaign_id: camp1Id, channel: 'content',  budget_allocation: 4_000_000, notes: 'SEO blog content + case studies' },
  ])
  if (camp2Id) await sb.from('campaign_channels').insert([
    { campaign_id: camp2Id, channel: 'digital', budget_allocation: 16_000_000, notes: 'LinkedIn + Google Ads enterprise targeting' },
    { campaign_id: camp2Id, channel: 'events',  budget_allocation: 6_000_000,  notes: 'Demo Day + roadshow activations' },
  ])
  if (camp3Id) await sb.from('campaign_channels').insert([
    { campaign_id: camp3Id, channel: 'digital', budget_allocation: 3_500_000, notes: 'Email + LinkedIn webinar promotion' },
  ])
  if (camp4Id) await sb.from('campaign_channels').insert([
    { campaign_id: camp4Id, channel: 'digital', budget_allocation: 8_000_000, notes: 'LinkedIn Sponsored Content + InMail' },
  ])

  /* ── 6. Sentiment daily — 365 days ───────────────────────────────────── */
  const sentRows = []
  for (let d = 364; d >= 0; d--) {
    const score = sentScore(d)
    const pos   = +(Math.min(94, score * 0.82 + 8 + Math.sin(d * 0.7) * 2.5)).toFixed(1)
    const neg   = +(Math.max(2, 100 - pos - (18 + Math.cos(d * 0.5) * 3))).toFixed(1)
    const neu   = +(Math.max(1, 100 - pos - neg)).toFixed(1)
    const themes = score < 55
      ? ['pricing concerns', 'competitor comparison', 'support response time', 'feature gaps']
      : score > 72
      ? ['CRM features', 'Nigerian support team', 'SME productivity', 'ease of use', 'built for Nigeria']
      : ['onboarding experience', 'data migration', 'integrations', 'pricing tiers']
    sentRows.push({
      brand_id: brandId, day: dAgo(d),
      social_score: score, offline_score: +(score * 0.94 + Math.sin(d) * 1.5).toFixed(1),
      blended_score: score,
      positive_pct: pos, neutral_pct: neu, negative_pct: neg,
      top_themes: themes,
      emotion_distribution: {
        joy:          +(pos * 0.55).toFixed(1),
        trust:        +(pos * 0.32).toFixed(1),
        anticipation: +(pos * 0.13).toFixed(1),
        sadness:      +(neg * 0.38).toFixed(1),
        anger:        +(neg * 0.38).toFixed(1),
        fear:         +(neg * 0.24).toFixed(1),
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
      awareness:     +(42 + t * 40).toFixed(1),
      consideration: +(35 + t * 42).toFixed(1),
      preference:    +(28 + t * 44).toFixed(1),
      advocacy:      +(24 + t * 48).toFixed(1),
      nps:           +(30 + t * 46).toFixed(1),
      sentiment:     ss,
      sov:           +(22 + t * 32).toFixed(1),
    }
    const bhiVal = +(
      comps.awareness * 0.20 + comps.consideration * 0.15 + comps.preference * 0.20 +
      comps.advocacy  * 0.15 + comps.nps          * 0.15 + comps.sentiment  * 0.10 +
      comps.sov       * 0.05
    ).toFixed(1)
    bhiRows.push({
      brand_id: brandId, snapshot_date: dAgo(d),
      bhi: bhiVal, components: comps,
      data_coverage_pct: +(82 + Math.sin(d * 0.3) * 7).toFixed(1),
    })
  }
  await sb.from('brand_health_snapshots').insert(bhiRows)

  /* ── 8. SOV snapshots — weekly, 25 snapshots ─────────────────────────── */
  const sovRows = []
  for (let d = 175; d >= 7; d -= 7) {
    const ss = sentScore(d)
    sovRows.push({
      brand_id: brandId, snapshot_date: dAgo(d),
      social_sov:  +(8 + (ss / 100) * 7 + Math.sin(d * 0.25) * 1.0).toFixed(1),
      paid_sov:    +(6 + (ss / 100) * 5).toFixed(1),
      press_sov:   +(4 + (ss / 100) * 3).toFixed(1),
      search_sov:  +(9 + (ss / 100) * 6).toFixed(1),
      blended_sov: +(8 + (ss / 100) * 6).toFixed(1),
      esov:        +((8 + (ss / 100) * 6) - 12.0).toFixed(2),
      competitor_data: {
        brand_volume: Math.round(3000 + (ss / 100) * 2000),
        competitor_volumes: {
          'HubSpot Nigeria':       Math.round(8000 - (ss / 100) * 1000),
          'Zoho CRM':              Math.round(6000 - (ss / 100) * 800),
          'Salesforce Essentials': Math.round(4000 + Math.sin(d * 0.1) * 300),
        },
      },
    })
  }
  await sb.from('sov_snapshots').insert(sovRows)

  /* ── 9. Events ────────────────────────────────────────────────────────── */

  // evt1 — Bridger Lagos SME Summit (closed, 45 days ago)
  const { data: evt1 } = await sb.from('events').insert({
    brand_id: brandId, campaign_id: camp2Id,
    name: 'Bridger Lagos SME Summit',
    event_type: 'brand_activation',
    city: 'Lagos', state: 'Lagos',
    date_start: dAgo(45), date_end: dAgo(45),
    expected_attendance: 400,
    objectives:           { primary: 'Enterprise pipeline generation', secondary: 'Brand awareness among Nigerian SMEs', tertiary: 'Product demo conversions' },
    activation_mechanics: ['Live CRM demo stations', 'Panel discussion with SME founders', 'Bridger product trial signup', 'Networking session'],
    kpi_targets:          { expected_leads: 120, expected_demos: 60 },
    budget: 4_500_000, currency: 'NGN',
    hashtags: ['BridgerCRM', 'NigerianSME', 'BridgerSummit2026'],
    status: 'closed',
    debrief: {
      actual_attendance: 487, leads_captured: 148, demos_delivered: 72, trial_signups: 31,
      nps_achieved: 78, social_impressions: 1_200_000,
      highlights: [
        'Live Bridger demo drew a crowd: 72 product demos delivered vs 60 target',
        'CEO of Chams Holdings signed up for enterprise pilot on site',
        '31 same-day trial activations from attendees',
        'TechCabal covered the event: 45,000 article views in 48 hours',
      ],
    },
  }).select('id').single()

  // evt2 — Bridger Enterprise Demo Day (live, today)
  const { data: evt2 } = await sb.from('events').insert({
    brand_id: brandId, campaign_id: camp2Id,
    name: 'Bridger Enterprise Demo Day',
    event_type: 'brand_activation',
    city: 'Lagos', state: 'Lagos',
    date_start: dAgo(0), date_end: dAgo(0),
    expected_attendance: 200,
    objectives:           { primary: 'Enterprise account demo and pipeline', secondary: 'Decision-maker engagement' },
    activation_mechanics: ['1-on-1 enterprise demos', 'ROI calculator sessions', 'Integration showcase', 'Trial activation desk'],
    kpi_targets:          { expected_leads: 60, expected_demos: 40 },
    budget: 2_800_000, currency: 'NGN',
    hashtags: ['BridgerEnterprise', 'BridgerCRM', 'BridgerDemoDay'],
    status: 'live',
  }).select('id').single()

  const evt1Id = evt1?.id
  const evt2Id = evt2?.id

  /* ── Event ambassadors + interactions ──────────────────────────────────── */

  // ── EVT1: Bridger Lagos SME Summit — 3 ambassadors, 20 interactions each ──
  if (evt1Id) {
    const [{ data: a1 }, { data: a2 }, { data: a3 }] = await Promise.all([
      sb.from('event_ambassadors').insert({ event_id: evt1Id, name: 'Chike Okonkwo',   phone: '+2348012301001', session_token: 'amb-bridger-summit-chike-2026'  }).select('id').single(),
      sb.from('event_ambassadors').insert({ event_id: evt1Id, name: 'Amara Nwachukwu', phone: '+2348023402002', session_token: 'amb-bridger-summit-amara-2026'  }).select('id').single(),
      sb.from('event_ambassadors').insert({ event_id: evt1Id, name: 'Bisi Adeleke',    phone: '+2348034503003', session_token: 'amb-bridger-summit-bisi-2026'   }).select('id').single(),
    ])

    const summitLeads = [
      'Tunde Adesanya', 'Ngozi Okonkwo', 'Emeka Eze', 'Fatima Bello', 'Seun Adeyemi',
      'Chioma Obi', 'Hakeem Aliyu', 'Adaeze Nwosu', 'Babatunde Lawal', 'Jumoke Williams',
      'Chukwuemeka Nze', 'Remi Coker', 'Zainab Umar', 'Kola Adewale', 'Nkiruka Eze',
      'Tijani Abubakar', 'Olumide Coker', 'Adaora Nwosu', 'Femi Olatunji', 'Ngozi Ibe',
    ]

    // Chike: 20 interactions
    const chikeRows = [
      ...Array.from({ length: 7 }, (_, i) => ({ itype: 'new_lead',     ambId: a1?.id, li: i      })),
      ...Array.from({ length: 5 }, ()      => ({ itype: 'engaged',      ambId: a1?.id, li: null   })),
      ...Array.from({ length: 4 }, (_, i) => ({ itype: 'new_customer', ambId: a1?.id, li: i + 7  })),
      ...Array.from({ length: 3 }, ()      => ({ itype: 'photo',        ambId: a1?.id, li: null   })),
      ...Array.from({ length: 1 }, ()      => ({ itype: 'engaged',      ambId: a1?.id, li: null   })),
    ]

    // Amara: 20 interactions
    const amaraRows = [
      ...Array.from({ length: 8 }, (_, i) => ({ itype: 'new_lead',     ambId: a2?.id, li: i + 11 })),
      ...Array.from({ length: 5 }, ()      => ({ itype: 'engaged',      ambId: a2?.id, li: null   })),
      ...Array.from({ length: 3 }, (_, i) => ({ itype: 'new_customer', ambId: a2?.id, li: i + 15 })),
      ...Array.from({ length: 3 }, ()      => ({ itype: 'photo',        ambId: a2?.id, li: null   })),
      ...Array.from({ length: 1 }, ()      => ({ itype: 'new_lead',     ambId: a2?.id, li: null   })),
    ]

    // Bisi: 20 interactions
    const bisiRows = [
      ...Array.from({ length: 6 }, (_, i) => ({ itype: 'new_lead',     ambId: a3?.id, li: i      })),
      ...Array.from({ length: 6 }, ()      => ({ itype: 'engaged',      ambId: a3?.id, li: null   })),
      ...Array.from({ length: 4 }, (_, i) => ({ itype: 'new_customer', ambId: a3?.id, li: i + 6  })),
      ...Array.from({ length: 3 }, ()      => ({ itype: 'photo',        ambId: a3?.id, li: null   })),
      ...Array.from({ length: 1 }, ()      => ({ itype: 'engaged',      ambId: a3?.id, li: null   })),
    ]

    const allEvt1Rows = [...chikeRows, ...amaraRows, ...bisiRows]
    const int1 = allEvt1Rows.map(({ itype, ambId, li }, idx) => ({
      event_id:         evt1Id,
      ambassador_id:    ambId,
      interaction_type: itype,
      customer_type:    ['new_prospect', 'existing_customer', 'new_prospect', 'new_prospect'][idx % 4],
      lead_name:        li != null ? (summitLeads[li % summitLeads.length] ?? `Guest ${li + 1}`) : null,
      lead_phone:       li != null ? `+23480${String(50000000 + (li * 7)).slice(0, 8)}` : null,
      lead_interest:    ['Bridger Pro', 'Enterprise Tier', 'Bridger Starter', 'Full Demo'][idx % 4],
      capture_method:   'ambassador' as const,
      client_uuid:      `evt1-bridger-${idx + 1}`,
      occurred_at:      tsAgo(45, 9 + (idx % 9)),
    }))
    await sb.from('event_interactions').insert(int1)

    // ROI report for evt1
    await sb.from('event_roi_reports').insert({
      event_id:     evt1Id,
      generated_at: tsAgo(43, 9),
      narrative: `The Bridger Lagos SME Summit exceeded all key performance targets, delivering a strong pipeline for the Enterprise tier launch. Total attendance of 487 surpassed the 400-person target by 22%, and the team captured 148 qualified leads against a 120 target.

The live product demo stations were the standout driver: 72 demos delivered (vs 60 target) with a 43% same-day trial activation rate among demo attendees. The CRM ROI calculator proved particularly compelling for SME founders who could immediately see their pipeline value.

Pipeline quality was exceptional: Chike Okonkwo secured an on-site enterprise pilot commitment from the CEO of Chams Holdings, representing an estimated pipeline value of NGN 8.4M ARR at current enterprise pricing. A total of 7 decision-level contacts were captured across attendees with 200+ employee companies.

TechCabal event coverage drove 45,000 article views within 48 hours, contributing an estimated NGN 680,000 in earned media value. The event generated 1.2M social impressions across LinkedIn and Twitter, with BridgerCRM trending briefly in Lagos tech circles on the day.

Recommend Chike Okonkwo for the Enterprise Demo Day ambassador team given his exceptional demo conversion rate of 57%.`,
      metrics: {
        total_interactions:  60,
        total_leads:         21,
        total_new_customers: 11,
        event_emv:           680_000,
        cost_per_lead:       303_371,
        cost_per_account:    409_091,
        event_roi:           0.52,
        new_customer_ratio:  0.183,
        leads_vs_target:     null,
        customers_vs_target: null,
        ambassador_breakdown: [
          { name: 'Chike Okonkwo',   total: 20, leads: 11, customers: 4, photo_moments: 3, demos: 8 },
          { name: 'Amara Nwachukwu', total: 20, leads: 9,  customers: 3, photo_moments: 3, demos: 7 },
          { name: 'Bisi Adeleke',    total: 20, leads: 7,  customers: 4, photo_moments: 3, demos: 6 },
        ],
      },
    })
  }

  // ── EVT2: Bridger Enterprise Demo Day — 3 ambassadors, 15 interactions each, LIVE
  if (evt2Id) {
    const [{ data: a4 }, { data: a5 }, { data: a6 }] = await Promise.all([
      sb.from('event_ambassadors').insert({ event_id: evt2Id, name: 'Taiwo Adesanya', phone: '+2348045604004', session_token: 'amb-bridger-demo-taiwo-2026' }).select('id').single(),
      sb.from('event_ambassadors').insert({ event_id: evt2Id, name: 'Ngozi Ibe',      phone: '+2348056705005', session_token: 'amb-bridger-demo-ngozi-2026' }).select('id').single(),
      sb.from('event_ambassadors').insert({ event_id: evt2Id, name: 'Femi Olatunji',  phone: '+2348067806006', session_token: 'amb-bridger-demo-femi-2026'  }).select('id').single(),
    ])

    const demoLeads = [
      'Chidi Okonkwo', 'Bimpe Lawal', 'Musa Ibrahim', 'Adaeze Ilo', 'Segun Adeyinka',
      'Hauwa Musa', 'Dele Adeyemi', 'Priscilla Eze', 'Bashir Mustapha', 'Ify Nwosu',
      'Damilola Bello', 'Chibuzor Eze', 'Tolu Fashola',
    ]

    // Taiwo: 15 interactions
    const taiwoRows = [
      ...Array.from({ length: 6 }, (_, i) => ({ itype: 'new_lead',     ambId: a4?.id, li: i     })),
      ...Array.from({ length: 5 }, ()      => ({ itype: 'engaged',      ambId: a4?.id, li: null  })),
      ...Array.from({ length: 4 }, (_, i) => ({ itype: 'new_customer', ambId: a4?.id, li: i + 6 })),
    ]

    // Ngozi: 15 interactions
    const ngoziRows = [
      ...Array.from({ length: 5 }, (_, i) => ({ itype: 'new_lead',     ambId: a5?.id, li: i + 8  })),
      ...Array.from({ length: 5 }, ()      => ({ itype: 'engaged',      ambId: a5?.id, li: null   })),
      ...Array.from({ length: 3 }, (_, i) => ({ itype: 'new_customer', ambId: a5?.id, li: i + 10 })),
      ...Array.from({ length: 2 }, ()      => ({ itype: 'new_lead',     ambId: a5?.id, li: null   })),
    ]

    // Femi: 15 interactions
    const femiRows = [
      ...Array.from({ length: 5 }, (_, i) => ({ itype: 'new_lead',     ambId: a6?.id, li: i     })),
      ...Array.from({ length: 5 }, ()      => ({ itype: 'engaged',      ambId: a6?.id, li: null  })),
      ...Array.from({ length: 3 }, (_, i) => ({ itype: 'new_customer', ambId: a6?.id, li: i + 5 })),
      ...Array.from({ length: 2 }, ()      => ({ itype: 'new_lead',     ambId: a6?.id, li: null  })),
    ]

    const allEvt2Rows = [...taiwoRows, ...ngoziRows, ...femiRows]
    const int2 = allEvt2Rows.map(({ itype, ambId, li }, idx) => ({
      event_id:         evt2Id,
      ambassador_id:    ambId,
      interaction_type: itype,
      customer_type:    ['new_prospect', 'new_prospect', 'new_prospect'][idx % 3],
      lead_name:        li != null ? (demoLeads[li % demoLeads.length] ?? `Guest ${li + 1}`) : null,
      lead_phone:       li != null ? `+23481${String(20000000 + (li * 11)).slice(0, 8)}` : null,
      lead_interest:    ['Enterprise Tier', 'Bridger Pro', 'Full Demo', 'Integration Showcase'][idx % 4],
      capture_method:   'ambassador' as const,
      client_uuid:      `evt2-bridger-${idx + 1}`,
      occurred_at:      tsAgo(0, 9 + Math.floor(idx * 0.4)),
    }))
    await sb.from('event_interactions').insert(int2)
  }

  /* ── 10. Influencers + influencer_campaigns ───────────────────────────── */
  const influencerDefs = [
    { name: 'Taiwo Oyedele',   handle: '@taiwo.crm',      platform: 'twitter'   as const, followers: 680000, niche: 'B2B tech/SME',          status: 'active'   as const, campId: camp1Id },
    { name: 'Chioma Obi',      handle: '@chiomaobi',       platform: 'instagram' as const, followers: 390000, niche: 'entrepreneur/startup',   status: 'active'   as const, campId: camp1Id },
    { name: 'Segun Adeyinka',  handle: '@seguntech',       platform: 'twitter'   as const, followers: 145000, niche: 'Nigerian tech ecosystem', status: 'active'   as const, campId: camp2Id },
    { name: 'Adaeze Ilo',      handle: '@adaezeilo',       platform: 'instagram' as const, followers: 78000,  niche: 'women in business',      status: 'prospect' as const, campId: null    },
    { name: 'Babatunde Lawal', handle: '@btlawal',         platform: 'twitter'   as const, followers: 32000,  niche: 'SME growth',             status: 'prospect' as const, campId: null    },
    { name: 'Jumoke Williams', handle: '@jumokewilliams',  platform: 'instagram' as const, followers: 18000,  niche: 'startup founder',        status: 'prospect' as const, campId: null    },
  ]

  for (const inf of influencerDefs) {
    const { data: infRow } = await sb.from('influencers').insert({
      brand_id:    brandId,
      campaign_id: inf.campId ?? null,
      name:        inf.name,
      handle:      inf.handle,
      platform:    inf.platform,
      category:    inf.niche,
      followers:   inf.followers,
      cultural_iq:  +(72 + (inf.followers / 100000) * 3 + Math.sin(inf.followers * 0.001) * 4).toFixed(1),
      risk_score:   +(10 + Math.abs(Math.sin(inf.followers * 0.002)) * 12).toFixed(1),
      status:      inf.status,
      ai_notes:    `B2B tech voice in Nigerian professional circles. ${inf.niche} niche. Audience is sales leaders and SME founders.`,
      social_urls: [{ platform: inf.platform, handle: inf.handle, url: `https://${inf.platform}.com/${inf.handle.replace('@', '')}` }],
      profile_data: {
        content_types:   ['Thought leadership', 'Product reviews', 'Business tips', 'Startup stories'],
        posting_frequency: '3-5x per week',
        audience_demographics: {
          age_range: '28-45', primary_location: 'Lagos, Nigeria',
          interests: ['B2B software', 'Sales', 'SME growth', 'Nigerian tech'],
        },
        engagement_rate_estimate: +(0.028 + (1 / (inf.followers || 1)) * 100000 * 0.018).toFixed(3),
      },
      brand_fit: {
        score: Math.round(68 + (inf.followers > 100000 ? 15 : 5)),
        audience_overlap: Math.round(70 + Math.sin(inf.followers * 0.001) * 10),
        value_alignment: 'Strong B2B alignment. Nigerian professional audience matches Bridger CRM target buyer.',
        recommendation: inf.followers > 100000 ? 'strong_fit' : 'potential_fit',
      },
    }).select('id').single()

    if (!infRow?.id) continue

    // 2-3 influencer_campaigns per influencer
    const numCamps = inf.followers > 100000 ? 3 : 2
    const campNames = [
      `${inf.name} x Built for Nigeria`,
      `${inf.name} x Enterprise Launch`,
      `${inf.name} x SME Thought Leadership`,
    ]
    for (let ci = 0; ci < numCamps; ci++) {
      const impressions = Math.round(inf.followers * (0.15 + ci * 0.04))
      const engagements = Math.round(impressions * (0.028 + ci * 0.004))
      const fee         = Math.round((inf.followers / 1000) * 800 * (1 - ci * 0.15))
      const emv         = Math.round(impressions * 1200 / 1000 + engagements * 65)
      await sb.from('influencer_campaigns').insert({
        brand_id:               brandId,
        name:                   campNames[ci],
        promo_code:             `BRIDGER${inf.name.split(' ')[0].toUpperCase()}${ci + 1}`,
        utm_campaign:           `bridger-${inf.platform}-${ci + 1}`,
        reach:                  Math.round(impressions * 0.8),
        impressions,
        engagements,
        emv,
        attributed_clicks:      Math.round(engagements * 0.18),
        attributed_conversions: Math.round(engagements * 0.04),
        fee,
        currency:               'NGN',
      })
    }
  }

  /* ── 11. Mentions — 70 rows ───────────────────────────────────────────── */
  const mentionData: Array<{ c: string; p: string; sl: string; ss: number; f: number; d: number; ic?: boolean }> = [
    // Positive (58% of 70 = ~41)
    { c: 'Bridger CRM pipeline view is genuinely the clearest I have seen for Nigerian sales teams. No bloat, just what you need.',  p: 'twitter',   sl: 'positive', ss: 88, f: 12400, d: 4   },
    { c: 'We switched our 40-person sales team to Bridger 3 months ago. Churn threat eliminated. Productivity up 31%.',             p: 'twitter',   sl: 'positive', ss: 92, f: 8200,  d: 8   },
    { c: 'Bridger CRM customer support responds in less than 2 hours. Try getting that from HubSpot in Nigeria.',                   p: 'twitter',   sl: 'positive', ss: 89, f: 5600,  d: 12  },
    { c: 'Built for Nigeria is not just a slogan for Bridger. They actually understand how Nigerian SME sales cycles work.',        p: 'twitter',   sl: 'positive', ss: 91, f: 9100,  d: 18  },
    { c: 'Bridger CRM WhatsApp integration is exactly what Nigerian businesses needed. Deals closed faster. Period.',              p: 'instagram', sl: 'positive', ss: 87, f: 3400,  d: 20  },
    { c: 'The Enterprise tier demo blew our procurement team away. Bridger CRM is ready for the big leagues.',                     p: 'twitter',   sl: 'positive', ss: 93, f: 14200, d: 1   },
    { c: 'Bridger CRM vs HubSpot comparison done. For Nigerian teams HubSpot pricing makes zero sense. Bridger wins on ROI.',      p: 'twitter',   sl: 'positive', ss: 86, f: 7800,  d: 25  },
    { c: 'Onboarded our Abuja and Lagos teams to Bridger CRM last week. Took 2 days. Migration was painless.',                     p: 'twitter',   sl: 'positive', ss: 84, f: 4200,  d: 30  },
    { c: 'Bridger CRM dashboard actually makes sense for how we work. Not built for Silicon Valley, built for us.',                p: 'instagram', sl: 'positive', ss: 90, f: 2800,  d: 35  },
    { c: 'Attended the Bridger SME Summit today. Product demo was impressive. Signing up for Pro plan tomorrow.',                  p: 'twitter',   sl: 'positive', ss: 95, f: 18000, d: 45  },
    { c: 'Bridger CRM reporting features are exactly what I needed to show the board. Clear, Nigeria-specific metrics.',           p: 'twitter',   sl: 'positive', ss: 88, f: 6200,  d: 50  },
    { c: 'Referral management in Bridger is a gem for B2B. Tracked 12 referral deals last month. Paid for itself.',               p: 'instagram', sl: 'positive', ss: 86, f: 1900,  d: 55  },
    { c: 'Finally a CRM that does not need 6 consultants to set up. Bridger CRM is genuinely simple and powerful.',               p: 'twitter',   sl: 'positive', ss: 82, f: 3100,  d: 60  },
    { c: 'Bridger CRM SME Webinar was top-tier. Learned more about pipeline management in 1 hour than 3 months of HubSpot docs.', p: 'twitter',   sl: 'positive', ss: 87, f: 5400,  d: 62  },
    { c: 'Bridger CRM Built for Nigeria campaign was not marketing fluff. Product actually works for our use cases.',             p: 'twitter',   sl: 'positive', ss: 84, f: 4800,  d: 150 },
    { c: 'Bridger CRM is the best investment we made in 2025. Team adoption rate 94%. That never happens with software.',         p: 'twitter',   sl: 'positive', ss: 91, f: 7200,  d: 70  },
    { c: 'Switched from Zoho to Bridger CRM last quarter. Support quality and local understanding is night and day.',             p: 'twitter',   sl: 'positive', ss: 89, f: 9800,  d: 80  },
    { c: 'Bridger CRM enterprise tier has custom reporting that our CFO actually understands. ROI visible in 30 days.',           p: 'instagram', sl: 'positive', ss: 85, f: 2200,  d: 22  },
    { c: 'Bridger CRM handles USSD and WhatsApp deal tracking. That alone is worth the switch from imported CRMs.',              p: 'twitter',   sl: 'positive', ss: 90, f: 6700,  d: 15  },
    { c: 'Bridger CRM sales team is responsive and knows our industry. That personal touch makes all the difference.',            p: 'instagram', sl: 'positive', ss: 83, f: 1400,  d: 95  },
    { c: 'Bridger CRM product roadmap is ambitious. They are building what Nigerian B2B actually needs.',                         p: 'twitter',   sl: 'positive', ss: 85, f: 4100,  d: 110 },
    { c: 'Bridger CRM SME Summit was eye-opening. Nigerian SaaS has arrived.',                                                    p: 'twitter',   sl: 'positive', ss: 88, f: 11200, d: 44  },
    { c: 'Data residency in Nigeria matters for us. Bridger CRM is the only CRM that gets this right.',                          p: 'twitter',   sl: 'positive', ss: 92, f: 8400,  d: 28  },
    { c: 'Bridger CRM forecasting tool saved our sales director 3 hours of spreadsheet work every week. Brilliant.',             p: 'instagram', sl: 'positive', ss: 86, f: 2600,  d: 40  },
    { c: 'Bridger CRM is not just a product. It is a statement that Nigerian tech can compete globally.',                         p: 'twitter',   sl: 'positive', ss: 94, f: 22000, d: 170 },
    { c: 'Bridger CRM mobile app works on 3G. In Nigeria that is not optional. That is a necessity.',                             p: 'twitter',   sl: 'positive', ss: 87, f: 5200,  d: 33  },
    { c: 'Bridger Enterprise is exactly what our 400-person company needed. Zoho could not handle our complexity.',              p: 'twitter',   sl: 'positive', ss: 90, f: 13400, d: 5   },
    { c: 'Bridger CRM team genuinely listens to product feedback. Feature I requested 2 months ago is now live.',               p: 'twitter',   sl: 'positive', ss: 84, f: 3900,  d: 48  },
    { c: 'SME productivity platform of the year. Bridger CRM is changing how Nigerian businesses close deals.',                  p: 'instagram', sl: 'positive', ss: 91, f: 4800,  d: 130 },
    { c: 'Bridger CRM email sequences + WhatsApp automation = Nigerian sales stack fully sorted.',                               p: 'twitter',   sl: 'positive', ss: 88, f: 6100,  d: 42  },
    { c: 'Migrated 5,000 contacts from Salesforce to Bridger CRM in one afternoon. Impressed.',                                  p: 'twitter',   sl: 'positive', ss: 83, f: 4400,  d: 58  },
    { c: 'Bridger CRM dashboard is clean enough that our non-technical CFO uses it daily. Rare.',                                p: 'instagram', sl: 'positive', ss: 86, f: 1800,  d: 75  },
    { c: 'Bridger CRM helped us land our biggest enterprise client by tracking their full buying journey. ROI proven.',          p: 'twitter',   sl: 'positive', ss: 93, f: 9600,  d: 10  },
    { c: 'Built for Nigeria campaign felt authentic. Bridger team understands our business environment deeply.',                 p: 'twitter',   sl: 'positive', ss: 85, f: 5800,  d: 155 },
    { c: 'Bridger CRM pipeline automation saved our 15-person team 8 hours a week. At Nigerian pricing, it pays for itself.',   p: 'twitter',   sl: 'positive', ss: 90, f: 7200,  d: 38  },
    { c: 'Bridger CRM handles multi-currency deals natively. Naira and USD quotes in same deal. That is a lifesaver.',          p: 'twitter',   sl: 'positive', ss: 87, f: 4600,  d: 52  },
    { c: 'Bridger CRM handles contract management for Nigerian SMEs better than anything I have tested.',                        p: 'instagram', sl: 'positive', ss: 84, f: 2100,  d: 88  },
    { c: 'Bridger CRM customer success team proactively reached out when my usage dropped. That care is rare in SaaS.',         p: 'twitter',   sl: 'positive', ss: 89, f: 6800,  d: 18  },
    { c: 'Bridger CRM Startup plan pricing is the only CRM our bootstrapped startup can afford without guilt.',                  p: 'twitter',   sl: 'positive', ss: 82, f: 3200,  d: 65  },
    { c: 'Bridger CRM API is clean and documented in plain English. Nigerian dev team can integrate in a day.',                  p: 'twitter',   sl: 'positive', ss: 88, f: 5100,  d: 22  },
    // Neutral (32% of 70 = ~22)
    { c: 'Comparing Bridger CRM vs HubSpot for our 80-person team. Both have merit depending on what you need.',                p: 'twitter',   sl: 'neutral',  ss: 55, f: 4200,  d: 14  },
    { c: 'Bridger CRM onboarding is smooth but the advanced reporting took a while to figure out.',                             p: 'twitter',   sl: 'neutral',  ss: 52, f: 2100,  d: 20  },
    { c: 'Enterprise tier pricing is fair for what you get. Wish there was a mid-tier option.',                                 p: 'instagram', sl: 'neutral',  ss: 56, f: 1600,  d: 7   },
    { c: 'Bridger CRM does most things well. Still lacks the ecosystem of Salesforce integrations.',                            p: 'twitter',   sl: 'neutral',  ss: 50, f: 3800,  d: 28  },
    { c: 'Bridger CRM vs Zoho CRM: Bridger wins on UX, Zoho wins on integrations. Depends on your team needs.', p: 'twitter', sl: 'neutral', ss: 54, f: 5200, d: 35, ic: true },
    { c: 'Bridger CRM sales team is helpful. Product is good. Evaluation continues.',                                           p: 'instagram', sl: 'neutral',  ss: 58, f: 900,   d: 10  },
    { c: 'Attended the Enterprise Demo Day. Professional product. Need to discuss pricing with management.',                    p: 'twitter',   sl: 'neutral',  ss: 55, f: 2900,  d: 1   },
    { c: 'Bridger CRM has improved a lot but still misses some HubSpot Marketing Hub features we depend on.', p: 'twitter', sl: 'neutral', ss: 48, f: 4100, d: 40, ic: true },
    { c: 'Bridger CRM is good for SMEs. For complex enterprise workflows it needs a bit more customisation depth.',             p: 'twitter',   sl: 'neutral',  ss: 52, f: 6200,  d: 16  },
    { c: 'Bridger CRM pricing is transparent. Still evaluating whether the Pro plan covers all our team needs.',               p: 'twitter',   sl: 'neutral',  ss: 56, f: 3400,  d: 22  },
    { c: 'SME Webinar content was solid. Would like deeper dives on specific integrations in future sessions.',                 p: 'instagram', sl: 'neutral',  ss: 54, f: 1200,  d: 60  },
    { c: 'Bridger CRM pipeline management is solid. Reporting depth needs work for boardroom presentations.',                  p: 'twitter',   sl: 'neutral',  ss: 50, f: 2700,  d: 45  },
    { c: 'Bridger CRM is a credible HubSpot alternative for Nigerian teams. Not a full replacement yet but close.', p: 'twitter', sl: 'neutral', ss: 55, f: 5900, d: 32, ic: true },
    { c: 'Built for Nigeria campaign landed well but Bridger CRM needs more case studies for the finance sector.',             p: 'twitter',   sl: 'neutral',  ss: 52, f: 3100,  d: 158 },
    { c: 'Bridger CRM mobile app needs more offline functionality for reps in areas with poor connectivity.',                  p: 'twitter',   sl: 'neutral',  ss: 48, f: 4400,  d: 27  },
    { c: 'Bridger CRM is growing fast. Hope the product quality stays consistent as they scale.',                              p: 'twitter',   sl: 'neutral',  ss: 55, f: 2200,  d: 72  },
    { c: 'Decent onboarding but Salesforce had more structured implementation support for enterprise.',                         p: 'twitter',   sl: 'neutral',  ss: 50, f: 3600,  d: 18  },
    { c: 'Bridger CRM UI is cleaner than Zoho. Feature parity with Freshsales at better pricing for Nigeria.',                 p: 'twitter',   sl: 'neutral',  ss: 58, f: 4800,  d: 38  },
    { c: 'Bridger SME Summit was well run. Would attend again. Still evaluating the Pro plan.',                                p: 'twitter',   sl: 'neutral',  ss: 54, f: 1900,  d: 44  },
    { c: 'Bridger CRM has the right idea but their iOS app crashes occasionally. Android version is more stable.',             p: 'twitter',   sl: 'neutral',  ss: 46, f: 2400,  d: 28  },
    { c: 'Zoho CRM price cut this week makes it a closer comparison with Bridger Pro. Worth re-evaluating.',                   p: 'twitter',   sl: 'neutral',  ss: 52, f: 3300,  d: 224, ic: true },
    { c: 'Bridger CRM built for Nigeria narrative resonates. The startup ecosystem needs more companies like this.',           p: 'instagram', sl: 'neutral',  ss: 60, f: 1700,  d: 165 },
    // Negative (10% of 70 = 7)
    { c: 'Bridger CRM bulk import broke our 12,000-contact database. Support has not resolved it in 4 days.',                 p: 'twitter',   sl: 'negative', ss: 18, f: 6200,  d: 30  },
    { c: 'Bridger CRM went down for 2 hours on Monday morning. For a sales CRM that is costly downtime.',                     p: 'twitter',   sl: 'negative', ss: 22, f: 8900,  d: 18  },
    { c: 'Zoho CRM still has better Outlook and Gmail integration than Bridger. Deal-breaker for our team.', p: 'twitter', sl: 'negative', ss: 28, f: 4800, d: 40, ic: true },
    { c: 'Bridger CRM Enterprise pricing jumped 35% with no notice. Disappointing for a company that claims to back SMEs.',   p: 'twitter',   sl: 'negative', ss: 20, f: 11200, d: 22  },
    { c: 'HubSpot launched a West Africa pricing tier. Bridger CRM now has a real competitor at similar price point.', p: 'twitter', sl: 'negative', ss: 25, f: 14800, d: 220, ic: true },
    { c: 'Bridger CRM API rate limits are too aggressive for our integration use case. Needs to be addressed.',               p: 'twitter',   sl: 'negative', ss: 24, f: 3200,  d: 55  },
    { c: 'Lost 3 weeks of activity history in Bridger CRM after a sync bug. Data integrity is non-negotiable.',               p: 'twitter',   sl: 'negative', ss: 16, f: 5400,  d: 35  },
  ]

  const mentionInserts = mentionData.map((m, i) => ({
    brand_id:        brandId,
    platform:        m.p,
    external_id:     `bridger-mention-${i + 1}`,
    content:         m.c,
    author_handle:   `@b2b_user_${2000 + i}`,
    author_followers: m.f,
    reach:           Math.round(m.f * 0.10),
    sentiment_label: m.sl,
    sentiment_score: m.ss,
    emotion_tags:    m.ss > 70 ? ['trust', 'joy'] : m.ss < 35 ? ['anger', 'frustration'] : ['anticipation', 'surprise'],
    topics:          m.ss > 70 ? ['CRM features', 'SME productivity', 'Nigerian tech'] : m.ss < 35 ? ['complaint', 'support', 'downtime'] : ['comparison', 'evaluation'],
    language_tag:    'en',
    is_competitor:   m.ic ?? false,
    created_at:      tsAgo(m.d, 8 + (i % 12)),
  }))
  await sb.from('mentions').insert(mentionInserts)

  /* ── 12. Social posts — 25 rows ──────────────────────────────────────── */
  const postData = [
    { c: 'Bridger CRM is Built for Nigeria. Your pipeline. Your rules. Your team. Start free today. #BridgerCRM #NigerianSME',                                                    p: 'twitter',   fs: 'awareness',     li: 2841,  co: 312,  sh: 891,  er: 4.8,  ai: 85, d: 150, cmp: camp1Id },
    { c: 'How do Nigerian sales teams close 40% more deals? Meet Bridger CRM. Built for how you actually sell. #BuiltForNigeria',                                                   p: 'twitter',   fs: 'awareness',     li: 3210,  co: 445,  sh: 1102, er: 5.9,  ai: 88, d: 165, cmp: camp1Id },
    { c: 'Introducing Bridger Enterprise. For Nigerian businesses that have outgrown basic CRMs. Learn more at bridgercrm.ng #BridgerEnterprise',                                    p: 'twitter',   fs: 'awareness',     li: 4820,  co: 621,  sh: 1843, er: 7.2,  ai: 92, d: 28,  cmp: camp2Id },
    { c: 'The Bridger Lagos SME Summit was exactly what Nigerian B2B needed. 487 founders, 72 live demos, real conversations. Thank you Lagos.',                                     p: 'instagram', fs: 'advocacy',      li: 6340,  co: 892,  sh: 2104, er: 9.1,  ai: 94, d: 44,  cmp: camp2Id },
    { c: 'Your sales team deserves a CRM that speaks their language. Bridger CRM supports English, Pidgin, and multi-currency NGN + USD deals. #BridgerCRM',                        p: 'twitter',   fs: 'consideration', li: 2180,  co: 287,  sh: 712,  er: 4.1,  ai: 80, d: 12,  cmp: camp2Id },
    { c: 'Webinar recap: 5 ways Nigerian SMEs can double pipeline velocity with CRM automation. Watch replay. #BridgerWebinar #SMEGrowth',                                           p: 'twitter',   fs: 'consideration', li: 1920,  co: 341,  sh: 560,  er: 3.8,  ai: 78, d: 60,  cmp: camp3Id },
    { c: 'Bridger CRM vs HubSpot: an honest comparison for Nigerian sales teams. We looked at pricing, features, and Nigeria-fit. Thread below.',                                   p: 'twitter',   fs: 'consideration', li: 5640,  co: 890,  sh: 2310, er: 8.4,  ai: 90, d: 45,  cmp: camp1Id },
    { c: 'Case study: How Zenith Logistics cut their sales cycle by 28% with Bridger CRM in 90 days. Read the full story. #BridgerCRM',                                            p: 'twitter',   fs: 'preference',    li: 3120,  co: 412,  sh: 1020, er: 5.5,  ai: 85, d: 35,  cmp: camp1Id },
    { c: 'Bridger CRM customers close deals faster. Fact. Average deal cycle for Pro customers: 18 days vs 31 days industry average. #BuiltForNigeria',                             p: 'twitter',   fs: 'preference',    li: 4480,  co: 623,  sh: 1640, er: 7.0,  ai: 88, d: 20,  cmp: camp2Id },
    { c: '1,200 Nigerian businesses trust Bridger CRM to manage their pipeline. Join them. First 30 days free. #BridgerCRM #NigerianB2B',                                           p: 'twitter',   fs: 'action',        li: 2890,  co: 234,  sh: 780,  er: 4.2,  ai: 82, d: 8,   cmp: camp2Id },
    { c: 'Bridger Enterprise is live. Unlimited contacts. Custom workflows. Dedicated CSM. Pricing that makes sense in Nigeria. #BridgerEnterprise',                                p: 'twitter',   fs: 'action',        li: 5120,  co: 712,  sh: 2200, er: 8.0,  ai: 91, d: 5,   cmp: camp2Id },
    { c: 'Our customers close more deals with Bridger CRM. Here is what they say. Thread of unfiltered reviews below. #BridgerCRM #NigerianSME',                                   p: 'twitter',   fs: 'advocacy',      li: 3840,  co: 541,  sh: 1480, er: 6.2,  ai: 89, d: 15,  cmp: camp2Id },
    { c: 'SME Webinar Series recap. Session 3 was our best yet: 820 live attendees, 38% trial conversion. Next session in 2 weeks. #BridgerWebinar',                               p: 'instagram', fs: 'advocacy',      li: 2140,  co: 312,  sh: 620,  er: 4.5,  ai: 83, d: 55,  cmp: camp3Id },
    { c: 'Q3 LinkedIn B2B Push is coming. Nigerian sales leaders: we have something big planned. Stay tuned. #BridgerCRM #LinkedInNigeria',                                         p: 'twitter',   fs: 'awareness',     li: 1680,  co: 198,  sh: 420,  er: 2.8,  ai: 75, d: 2,   cmp: camp4Id },
    { c: 'Bridger CRM is the only CRM with a local support team in Lagos. Real humans. Real Nigerians. Real fast. #BuiltForNigeria #BridgerCRM',                                   p: 'twitter',   fs: 'consideration', li: 3920,  co: 498,  sh: 1310, er: 6.1,  ai: 87, d: 18,  cmp: camp2Id },
    { c: 'Enterprise CRM without the enterprise nonsense. Bridger Enterprise is live. Book your demo this week. #BridgerEnterprise',                                                p: 'instagram', fs: 'action',        li: 4200,  co: 580,  sh: 1820, er: 7.4,  ai: 90, d: 10,  cmp: camp2Id },
    { c: 'Nigerian founders: your sales pipeline deserves better. Bridger CRM trial is free for 30 days. No credit card. No jargon. #BridgerCRM',                                  p: 'twitter',   fs: 'action',        li: 2640,  co: 310,  sh: 820,  er: 4.0,  ai: 81, d: 22,  cmp: camp2Id },
    { c: 'The Built for Nigeria campaign was not an ad. It was a declaration. Bridger CRM was built by Nigerians, for Nigerian businesses. #BuiltForNigeria',                       p: 'twitter',   fs: 'awareness',     li: 7840,  co: 1120, sh: 3400, er: 11.2, ai: 96, d: 180, cmp: camp1Id },
    { c: 'Bridger CRM helped us track 3,200 active prospects with a 12-person team. That would have needed 20 reps before. #BridgerCRM #NigerianB2B',                              p: 'twitter',   fs: 'advocacy',      li: 4980,  co: 720,  sh: 2100, er: 8.0,  ai: 92, d: 32,  cmp: camp1Id },
    { c: 'SME Growth Webinar replay is live. Catch the full 60-minute session on pipeline velocity for Nigerian sales teams. Link in bio. #BridgerWebinar',                        p: 'instagram', fs: 'consideration', li: 1840,  co: 218,  sh: 490,  er: 3.2,  ai: 77, d: 52,  cmp: camp3Id },
    { c: 'Bridger Enterprise launch exceeded all expectations. 140 decision-makers at Demo Day. Pipeline generated in one afternoon. Details below.',                               p: 'twitter',   fs: 'advocacy',      li: 6120,  co: 880,  sh: 2540, er: 9.5,  ai: 93, d: 0,   cmp: camp2Id },
    { c: 'CRM built for the way Nigerian businesses actually run. Multi-location teams, Naira invoicing, WhatsApp deals. All in one place. #BridgerCRM',                           p: 'twitter',   fs: 'preference',    li: 3480,  co: 412,  sh: 1120, er: 5.7,  ai: 86, d: 27,  cmp: camp1Id },
    { c: 'Bridger CRM 1,200 customers milestone. From 3 beta users in 2024 to 1,200 paying Nigerian businesses. This is just the beginning.',                                      p: 'twitter',   fs: 'advocacy',      li: 9820,  co: 1480, sh: 4200, er: 13.1, ai: 97, d: 6,   cmp: camp2Id },
    { c: 'Nigerian startup ecosystem tip: stop paying dollar prices for CRM tools. Bridger CRM NGN pricing. Local support. Full features.',                                         p: 'twitter',   fs: 'awareness',     li: 5240,  co: 640,  sh: 2010, er: 8.3,  ai: 89, d: 38,  cmp: camp1Id },
    { c: 'Bridger CRM mobile app update is live. Offline deal logging, push notifications, voice note for call logs. Nigerian field teams rejoice.',                                p: 'twitter',   fs: 'preference',    li: 3980,  co: 520,  sh: 1380, er: 6.5,  ai: 88, d: 14,  cmp: camp2Id },
  ]

  const postInserts = postData.map((p, i) => ({
    brand_id:             brandId,
    platform:             p.p,
    external_id:          `bridger-post-${i + 1}`,
    content:              p.c,
    content_type:         i % 4 === 0 ? 'video' : 'image',
    reach:                Math.round((p.li + p.co + p.sh) * 6),
    impressions:          Math.round((p.li + p.co + p.sh) * 10),
    likes: p.li, comments: p.co, shares: p.sh,
    saves:                Math.round(p.li * 0.08),
    video_views:          i % 4 === 0 ? Math.round(p.li * 1.8) : 0,
    engagement_rate:      p.er,
    funnel_stage:         p.fs,
    campaign_id:          p.cmp,
    sentiment_score:      +(p.ai * 0.88).toFixed(1),
    sentiment_label:      p.ai > 80 ? 'positive' : 'neutral',
    emotion_tags:         p.ai > 85 ? ['trust', 'joy'] : ['anticipation', 'trust'],
    language_tag:         'en',
    ai_performance_score: p.ai,
    ai_diagnosis:         p.ai > 88
      ? 'High B2B resonance. Professional credibility signals driving strong organic sharing in Nigerian tech circles.'
      : 'Solid performance. More concrete ROI data and customer social proof could lift engagement.',
    posted_at:            tsAgo(p.d, 9 + (i % 10)),
  }))
  await sb.from('social_posts').insert(postInserts)

  /* ── 13. NPS survey + 50 responses ───────────────────────────────────── */
  const { data: survey } = await sb.from('surveys').insert({
    brand_id: brandId,
    name: 'Bridger CRM Customer NPS Survey Q2 2026',
    type: 'nps',
    questions: [
      { id: 'q1', type: 'single_choice', text: 'How did you first discover Bridger CRM?', options: ['LinkedIn', 'Referral / Word of mouth', 'Google Search', 'Event / Webinar', 'Tech Media (TechCabal / Techpoint)'] },
      { id: 'q2', type: 'nps',           text: 'How likely are you to recommend Bridger CRM to a fellow Nigerian business owner?', scale: 10 },
      { id: 'q3', type: 'text',          text: 'What is one feature you wish Bridger CRM had?' },
      { id: 'q4', type: 'single_choice', text: 'Which Bridger CRM plan are you on?', options: ['Starter', 'Pro', 'Enterprise', 'Trial'] },
    ],
    deploy_channels: ['email', 'in-app'],
    languages: ['english'],
    status: 'live',
  }).select('id').single()

  const surveyId = survey?.id

  // 40% promoters (9-10), 40% passives (7-8), 20% detractors (0-6) — 50 responses
  const npsScores: number[] = [
    // 20 promoters (9-10)
    10, 9, 10, 9, 10, 10, 9, 10, 9, 9, 10, 9, 10, 9, 10, 9, 9, 10, 9, 10,
    // 20 passives (7-8)
     8, 7,  8, 8,  7,  8, 7,  8, 8, 7,  8, 7,  8, 7,  8, 8, 7,  8, 7,  8,
    // 10 detractors (0-6)
     5, 4,  6, 3,  5,  6, 4,  5, 3, 6,
  ]

  const b2bSegs = [
    { plan: 'Pro',        city: 'Lagos',  sector: 'fintech'       },
    { plan: 'Enterprise', city: 'Lagos',  sector: 'logistics'     },
    { plan: 'Starter',    city: 'Abuja',  sector: 'consulting'    },
    { plan: 'Pro',        city: 'Lagos',  sector: 'ecommerce'     },
    { plan: 'Enterprise', city: 'Abuja',  sector: 'manufacturing' },
  ]
  const b2bChannels = ['email', 'in-app', 'email', 'in-app']
  const verbatimMapNPS: Record<number, string> = {
    10: 'Bridger CRM transformed how our team sells. Would recommend to every Nigerian B2B founder.',
    9:  'Best CRM investment we made. The local support team is a genuine differentiator.',
    8:  'Very good product. The enterprise tier met almost all our requirements.',
    7:  'Good overall. Some advanced automation features could be deeper.',
    6:  'Decent CRM. Integration with our accounting system needs improvement.',
    5:  'Good concept but had stability issues in the first month.',
    4:  'Support response times need to improve for enterprise customers.',
    3:  'Product has potential but onboarding was more difficult than expected.',
  }
  const b2bLats = [6.5244, 9.0579, 6.3350, 4.8242, 6.4281]
  const b2bLngs = [3.3792, 7.4898, 5.6237, 7.0336, 3.4219]

  if (surveyId) {
    const respInserts = npsScores.map((score, i) => ({
      survey_id: surveyId,
      answers: {
        q1: ['LinkedIn', 'Referral / Word of mouth', 'Google Search', 'Event / Webinar', 'Tech Media (TechCabal / Techpoint)'][i % 5],
        q2: score,
        q3: verbatimMapNPS[score] ?? 'Good product overall. Would recommend.',
        q4: ['Starter', 'Pro', 'Enterprise', 'Trial'][i % 4],
      },
      respondent_profile: b2bSegs[i % 5],
      source:       b2bChannels[i % 4],
      language:     'english',
      quality_flag: 'ok',
      location_lat: b2bLats[i % 5],
      location_lng: b2bLngs[i % 5],
      collected_at: tsAgo(Math.floor(i * 1.4), 9 + (i % 10)),
    }))
    await sb.from('survey_responses').insert(respInserts)
  }

  /* ── 14. NPS records for chart data ──────────────────────────────────── */
  const npsRecordInserts = Array.from({ length: 50 }, (_, i) => {
    const r = (Math.sin(i * 7.1) + 1) / 2
    let score: number
    if      (r < 0.40) score = 9 + (i % 2 === 0 ? 1 : 0)
    else if (r < 0.80) score = 7 + (i % 2 === 0 ? 1 : 0)
    else               score = Math.floor(r * 7)
    return {
      brand_id:      brandId,
      score,
      verbatim:      score >= 9 ? 'Bridger CRM is the best CRM for Nigerian B2B. Highly recommend.' : score >= 7 ? 'Good product with strong local support. Room to grow.' : 'Has potential but needs improvement in key areas.',
      segment:       { channel: b2bChannels[i % 4], city: b2bSegs[i % 5].city, plan: b2bSegs[i % 5].plan },
      channel:       b2bChannels[i % 4],
      promoter_type: score >= 9 ? 'promoter' : score >= 7 ? 'passive' : 'detractor',
      created_at:    tsAgo(Math.floor(i * 2.1), 8 + (i % 12)),
    }
  })
  await sb.from('nps_records').insert(npsRecordInserts)

  /* ── 15. Weekly AI briefings — 4 ─────────────────────────────────────── */
  const briefings = [
    {
      daysBack: 28,
      content: {
        title: 'Bridger CRM Competitive Briefing — Enterprise Tier Pre-Launch',
        executive_summary: 'Enterprise tier launch is 2 weeks away. Sentiment at 72/100, rising. HubSpot has quietly announced West Africa pricing adjustments requiring an accelerated launch communications plan.',
        sov_analysis: 'Bridger CRM holds 14.2% share of voice in Nigerian B2B SaaS conversation, up 2.4 points from last month. HubSpot Nigeria leads at 32.1%, Zoho CRM at 24.8%, Salesforce at 18.6%. Bridger ESOV of +2.2% signals investment efficiency ahead of the Enterprise launch.',
        sentiment_vs_market: 'Bridger CRM 14-day average sentiment (72.1/100) is 9.8 points above estimated B2B SaaS category average. The Built for Nigeria campaign content is still generating trust signals 3 months after launch. HubSpot West Africa pricing announcement has generated neutral-to-negative reaction from Nigerian SaaS Twitter.',
        brand_strengths: [
          'Growing SOV momentum: +2.4 points in 30 days driven by Built for Nigeria content',
          'Sentiment premium of 9.8 points above category average',
          'SME Webinar Series established Bridger as thought leader: 2,400 registrations, 38% trial conversion',
        ],
        brand_vulnerabilities: [
          'HubSpot West Africa pricing reduces the cost advantage narrative',
          'Enterprise feature parity gap vs Salesforce for complex workflow automation',
          'Limited brand presence outside Lagos and Abuja',
        ],
        competitor_threats: [
          'HubSpot West Africa pricing announcement targets the same SME segment Bridger owns',
          'Zoho CRM Nigeria partner network expanding to 8 new cities in Q3',
          'Freshsales running aggressive LinkedIn campaigns targeting Nigerian HR and sales directors',
        ],
        opportunities: [
          'Enterprise launch window: HubSpot pricing backlash creates natural switching conversation to join',
          'Port Harcourt and Kano are underserved by all competitors: first-mover advantage available',
          'Partner channel: onboard 5 top Nigerian IT consultancies as Bridger resellers before Q4',
        ],
        recommendations: [
          { action: 'Brief @taiwo.crm and @seguntech to post Enterprise launch content on day 1', rationale: 'Influencer seeding at launch historically reduces enterprise CPL by 35% for Bridger. B2B Twitter influencers drive demo requests faster than paid ads.', priority: 'High' as const },
          { action: 'Prepare HubSpot pricing counter-narrative content pack for launch week', rationale: 'HubSpot West Africa announcement is generating organic comparison searches. Bridger should own the HubSpot alternative Nigeria keyword this week.', priority: 'High' as const },
          { action: 'Identify 3 Lagos enterprise case studies for launch week press outreach', rationale: 'Enterprise buyers trust peer proof above all. TechCabal and BusinessDay coverage requires concrete customer ROI stories.', priority: 'Medium' as const },
        ],
        data_gaps: [
          'No Zoho CRM spend data: partner channel expansion timing is inferred',
          'LinkedIn impression share not tracked: B2B paid SOV incomplete',
        ],
        confidence: 'Medium' as const,
      },
    },
    {
      daysBack: 21,
      content: {
        title: 'Bridger CRM Competitive Briefing — Enterprise Launch Week',
        executive_summary: 'Enterprise tier launched. Sentiment climbed to 73.5/100. @taiwo.crm launch post generated 18,400 impressions and 24 inbound demo requests. TechCabal coverage is live.',
        sov_analysis: 'Bridger CRM SOV surged to 16.8% on launch day on the back of influencer seeding, PR, and paid LinkedIn. HubSpot Nigeria at 30.4%, Zoho CRM at 23.1%. Bridger ESOV climbed to +4.8%, approaching the growth threshold.',
        sentiment_vs_market: 'Bridger CRM 14-day average sentiment (73.5/100) is at a 6-month high. The Enterprise launch content is generating strong trust and anticipation signals on B2B Twitter. Decision-maker audience is responding well to the ROI-first messaging.',
        brand_strengths: [
          'SOV at 16.8%, highest since brand launch',
          'TechCabal coverage generated 52,000 article views in 72 hours',
          '@taiwo.crm launch post: 18,400 impressions, 24 demo requests, 6.2% engagement rate',
          'Enterprise landing page: 340 sign-ups in first 3 days',
        ],
        brand_vulnerabilities: [
          'Demo capacity may be stretched: 24 inbound requests, 6-person solutions team',
          'HubSpot counter-messaging launching next week based on social listening signals',
          'Enterprise pricing FAQ missing from landing page: causing support ticket volume',
        ],
        competitor_threats: [
          'HubSpot Nigeria preparing counter-campaign based on tracked influencer brief activity',
          'Zoho CRM activated 3 new Lagos resellers this week: distribution threat in mid-market',
        ],
        opportunities: [
          'Lagos SME Summit follow-up: 87 leads not yet re-engaged with Enterprise launch content',
          'Fintech sector is underserved in CRM: targeted LinkedIn content for fintech founders',
          'Enterprise pricing FAQ content would convert fence-sitters: high search intent, zero supply',
        ],
        recommendations: [
          { action: 'Deploy Enterprise pricing FAQ content on website and LinkedIn today', rationale: 'Top Google query from Enterprise landing page visitors is Bridger CRM Enterprise pricing. Friction at pricing page is losing 40% of inbound.', priority: 'High' as const },
          { action: 'Re-engage 87 Lagos Summit leads with personalised Enterprise launch outreach', rationale: 'Summit attendees are warm leads with product awareness. Cost-per-demo from warm outreach is 80% lower than cold LinkedIn.', priority: 'High' as const },
          { action: 'Increase demo team capacity from 6 to 10 for the next 4 weeks', rationale: 'Demo conversion to paid is 58%. With 24 inbound requests in 3 days, a capacity bottleneck will cost revenue and damage launch momentum.', priority: 'Medium' as const },
        ],
        data_gaps: [
          'HubSpot counter-campaign timing unknown',
          'Demo completion rate post-sign-up not tracked in current analytics setup',
        ],
        confidence: 'High' as const,
      },
    },
    {
      daysBack: 14,
      content: {
        title: 'Bridger CRM Competitive Briefing — Enterprise Launch Week 2',
        executive_summary: 'Week 2 of Enterprise launch. Sentiment stable at 73.8/100. 31 Enterprise trials active. HubSpot Nigeria has launched a counter-campaign on LinkedIn targeting Bridger CRM comparison keywords.',
        sov_analysis: 'Bridger CRM SOV holds at 16.1% as HubSpot Nigeria counter-spend begins to moderate the gap. Zoho CRM at 23.4%. Bridger ESOV at +4.1%, above the critical +2% threshold.',
        sentiment_vs_market: 'Bridger CRM 14-day average sentiment (73.8/100) remains at a 6-month high. HubSpot Nigeria counter-campaign has not moved the needle on Bridger sentiment: authenticity of Built for Nigeria positioning is providing insulation.',
        brand_strengths: [
          'SOV at 16.1% sustained into Week 2',
          '31 active Enterprise trials: highest pipeline in company history',
          'Sentiment at 73.8/100, insulated from HubSpot counter-campaign noise',
          'SME Summit warm leads re-engaged: 22 of 87 have booked demos this week',
        ],
        brand_vulnerabilities: [
          'HubSpot Nigeria LinkedIn spend is targeting Bridger CRM alternative and CRM Nigeria keywords directly',
          'Enterprise trial-to-paid conversion window is 21 days: urgency required for 12 trials going stale',
          'Abuja, Port Harcourt, and Kano have no active Enterprise pipeline',
        ],
        competitor_threats: [
          'HubSpot Nigeria LinkedIn counter-campaign spending heavily on comparison keywords',
          'Zoho CRM new reseller in Abuja targeting the same government-linked SME segment as Bridger',
          'Freshsales offering 6-month free trial to Nigerian startups: targeting Bridger Starter segment',
        ],
        opportunities: [
          'Outmanoeuvre HubSpot: publish a transparent comparison blog post this week to own the conversation',
          '14 Enterprise trials at risk of going stale: targeted success outreach with ROI calculator session',
          'Nigerian fintech sector: no CRM brand owns this vertical. Bridger case study from a fintech would be market-defining',
        ],
        recommendations: [
          { action: 'Publish an honest Bridger CRM vs HubSpot comparison page this week', rationale: 'HubSpot Nigeria is spending on comparison keywords. A well-ranked honest comparison owned by Bridger converts 3x better than defensive ad spend.', priority: 'High' as const },
          { action: 'Activate Customer Success outreach on 14 stale Enterprise trials with personalised ROI session', rationale: 'Trials going quiet at day 14 have 12% unprompted conversion vs 58% with a live ROI session. This is the highest-ROI action this week.', priority: 'High' as const },
          { action: 'Brief @chiomaobi for a Lagos fintech founder audience LinkedIn post on Bridger CRM', rationale: 'Fintech is the highest-value vertical with zero current CRM brand ownership. A single credible post targeting fintech founders unlocks a new pipeline stream.', priority: 'Medium' as const },
        ],
        data_gaps: [
          'HubSpot Nigeria LinkedIn spend amount unknown',
          'Enterprise trial activity data not yet integrated into brand dashboard',
        ],
        confidence: 'High' as const,
      },
    },
    {
      daysBack: 7,
      content: {
        title: 'Bridger CRM Competitive Briefing — Enterprise Launch Week 3',
        executive_summary: 'Enterprise launch Week 3. Sentiment at 74.2/100, new 6-month high. 8 Enterprise trials converted to paid this week. Bridger CRM vs HubSpot comparison page ranks number 2 on Google within 72 hours of publish.',
        sov_analysis: 'Bridger CRM SOV at 17.4%, highest in brand history. HubSpot Nigeria at 29.8%, Zoho CRM at 22.1%. Bridger ESOV +5.4%, firmly in growth territory and approaching parity with Zoho for the first time.',
        sentiment_vs_market: 'Bridger CRM 14-day average sentiment (74.2/100) sits 11.8 points above estimated B2B SaaS category average. The comparison page and ROI calculator content is generating strong trust and anticipation signals. Promoter conversation volume is at its highest since launch.',
        brand_strengths: [
          'SOV at 17.4%: brand-high, approaching Zoho CRM for the first time',
          '8 Enterprise conversions this week: NGN 28M ARR added in one week',
          'Comparison page ranking number 2 on Google CRM Nigeria within 72 hours',
          'Sentiment at 74.2/100, 11.8 points above category average',
        ],
        brand_vulnerabilities: [
          'Enterprise CSM team still at capacity: risk of post-sale churn if not expanded',
          'LinkedIn organic reach declining without paid amplification after launch spike',
          'North Nigeria has zero Bridger presence while HubSpot and Zoho resellers are active there',
        ],
        competitor_threats: [
          'HubSpot Nigeria is planning a Nigerian case study campaign: first credible content play for the local market',
          'Salesforce Essentials is reportedly reducing price by 20% for sub-50-seat teams next quarter',
          'Odoo implementing a Nigeria-specific onboarding track in Q3',
        ],
        opportunities: [
          'North Nigeria first-mover: Lagos success story is strong enough to expand. One Kano reseller could unlock the entire North',
          'Fintech sector: @chiomaobi post generated 1,200 impressions among fintech founders: warm audience to nurture',
          'Promoter programme: 8 new Enterprise customers are prime candidates for a case study and referral programme launch',
        ],
        recommendations: [
          { action: 'Launch Bridger CRM referral programme for existing customers this week', rationale: 'New Enterprise customers are at peak satisfaction post-conversion. Referral programmes activated within 30 days of onboarding have 3x higher participation rate. Target 20% of 1,200 customers for the launch cohort.', priority: 'High' as const },
          { action: 'Commission a Kano-based reseller partner to begin North Nigeria outreach', rationale: 'North Nigeria accounts for 28% of Nigerian SME GDP but zero Bridger CRM pipeline. One credible local reseller can open the market at low cost before HubSpot and Zoho lock in the distribution.', priority: 'Medium' as const },
          { action: 'Convert 3 of the 8 new Enterprise customers into published case studies', rationale: 'Enterprise buyers trust peer proof above all. Three Nigeria-specific case studies would outperform NGN 5M of paid advertising in enterprise conversion quality.', priority: 'Medium' as const },
        ],
        data_gaps: [
          'No North Nigeria market intelligence: reseller landscape and SME CRM adoption unknown',
          'Salesforce Essentials pricing change unconfirmed: based on partner channel rumour',
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

  /* ── 16. Cultural resonance scores — 10 weeks ───────────────────────── */
  const crsSegments = [
    { segment: 'Lagos Professional Enterprises',   crs: 80, auth: 85, lang: 88, vis: 76, sym: 82, comm: 78, drift: 'normal'  },
    { segment: 'Nigerian SME Owners',              crs: 76, auth: 80, lang: 82, vis: 72, sym: 78, comm: 74, drift: 'normal'  },
    { segment: 'Northern Nigeria B2B Market',      crs: 58, auth: 62, lang: 50, vis: 60, sym: 55, comm: 52, drift: 'watch'   },
    { segment: 'Abuja Government-linked Sector',   crs: 68, auth: 70, lang: 74, vis: 65, sym: 66, comm: 68, drift: 'normal'  },
  ]
  const crsInserts = []
  for (let w = 0; w < 10; w++) {
    for (const s of crsSegments) {
      const drift = w * 0.3
      crsInserts.push({
        brand_id: brandId, segment: s.segment, snapshot_date: dAgo(w * 7),
        crs:                +(s.crs  - drift + Math.sin(w * 0.7) * 1.4).toFixed(1),
        authenticity:       +(s.auth - drift * 0.4).toFixed(1),
        language_relevance: +(s.lang - drift * 0.3).toFixed(1),
        visual_rep:         +(s.vis  + drift * 0.2).toFixed(1),
        symbol_value:       +s.sym.toFixed(1),
        community_embed:    +(s.comm - drift * 0.3).toFixed(1),
        drift_flag:         s.drift,
      })
    }
  }
  await sb.from('cultural_resonance_scores').insert(crsInserts)

  /* ── 17. Manual metrics (SaaS-specific) ──────────────────────────────── */
  const today    = new Date()
  const mStart   = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  const mEnd     = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]

  const bridgerMetrics = [
    { metric_key: 'mrr',                   value: 4000000  },
    { metric_key: 'arr',                   value: 48000000 },
    { metric_key: 'paying_customers',      value: 1200     },
    { metric_key: 'churn_rate',            value: 0.018    },
    { metric_key: 'net_revenue_retention', value: 1.12     },
    { metric_key: 'cac',                   value: 35000    },
    { metric_key: 'ltv',                   value: 420000   },
    { metric_key: 'ltv_cac_ratio',         value: 12.0     },
    { metric_key: 'trial_to_paid_rate',    value: 0.28     },
  ]

  try {
    await sb.from('metric_manual').upsert(
      bridgerMetrics.map(m => ({
        brand_id:     brandId,
        metric_key:   m.metric_key,
        value:        m.value,
        currency:     'NGN',
        period_start: mStart,
        period_end:   mEnd,
        entered_by:   userId,
        updated_at:   new Date().toISOString(),
      })),
      { onConflict: 'brand_id,metric_key,period_start' }
    )
  } catch (_) { /* metric_manual table may not exist in all environments */ }

  /* ── Done ─────────────────────────────────────────────────────────────── */
  return NextResponse.json({
    success: true,
    credentials: { email: DEMO_EMAIL, password: DEMO_PASSWORD, note: 'Login at /auth/login' },
    brand: 'Bridger CRM',
    workspace: 'Bridger (Pro plan)',
    seeded: {
      sentimentDays: 365, bhiSnapshots: 180, sovSnapshots: 25,
      campaigns: 4, events: 2, influencers: 6, mentions: 70,
      socialPosts: 25, npsRecords: 50, metricManual: 9,
    },
  })
}
