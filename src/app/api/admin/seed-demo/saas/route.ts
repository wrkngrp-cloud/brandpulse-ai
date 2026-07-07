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
  const brandRow = {
    workspace_id:    wsId,
    name:            'Bridger CRM',
    category:        'SaaS / Technology',
    industry:        'b2b_saas',
    brand_type:      'b2b_saas',
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
    objective: 'conversion', status: 'planned',
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

  /* ── 17. Manual metrics (SaaS-specific) — 6 months, oldest first ──────── */
  // Canonical commercial keys: mrr, total_spend, new_customers (newly won
  // accounts this period, distinct from the paying_customers total base),
  // mql_count, churn_rate, plus explicit overrides cac / ltv / ltv_cac_ratio.
  // Series follow the Bridger arc: steady compounding growth through the
  // Enterprise tier launch. The last value in each series is the current month.
  const today = new Date()
  const monthBounds = (monthsAgo: number) => ({
    start: new Date(today.getFullYear(), today.getMonth() - monthsAgo, 1).toISOString().split('T')[0],
    end:   new Date(today.getFullYear(), today.getMonth() - monthsAgo + 1, 0).toISOString().split('T')[0],
  })

  const bridgerSeries: Record<string, number[]> = {
    mrr:                   [3_100_000, 3_300_000, 3_500_000, 3_700_000, 3_850_000, 4_000_000],
    arr:                   [37_200_000, 39_600_000, 42_000_000, 44_400_000, 46_200_000, 48_000_000],
    paying_customers:      [1005, 1050, 1095, 1140, 1172, 1200],
    new_customers:         [48, 55, 61, 70, 74, 78],
    total_spend:           [1_800_000, 2_000_000, 2_200_000, 2_500_000, 2_600_000, 2_700_000],
    mql_count:             [320, 360, 410, 470, 510, 540],
    churn_rate:            [0.024, 0.023, 0.021, 0.020, 0.019, 0.018],
    net_revenue_retention: [1.06, 1.07, 1.09, 1.10, 1.11, 1.12],
    cac:                   [39000, 38200, 37000, 36200, 35600, 35000],
    ltv:                   [350000, 365000, 380000, 395000, 408000, 420000],
    ltv_cac_ratio:         [9.0, 9.6, 10.3, 10.9, 11.5, 12.0],
    trial_to_paid_rate:    [0.22, 0.23, 0.25, 0.26, 0.27, 0.28],
  }

  try {
    const metricRows = []
    for (const [key, series] of Object.entries(bridgerSeries)) {
      for (let i = 0; i < series.length; i++) {
        const { start, end } = monthBounds(series.length - 1 - i)
        metricRows.push({
          brand_id: brandId, metric_key: key, value: series[i], currency: 'NGN',
          period_start: start, period_end: end, entered_by: userId, updated_at: new Date().toISOString(),
        })
      }
    }
    await sb.from('metric_manual').upsert(metricRows, { onConflict: 'brand_id,metric_key,period_start' })
  } catch (_) { /* metric_manual table may not exist in all environments */ }

  /* ── 18. Funnel snapshots — monthly, 12 months ────────────────────────── */
  const bgFunnelRows = []
  for (let m = 11; m >= 0; m--) {
    const d  = m * 30
    const ss = sentScore(d)
    const t  = ss / 100
    bgFunnelRows.push({
      brand_id: brandId, snapshot_date: dAgo(d), segment: 'all',
      awareness:     +(40 + t * 42).toFixed(1),
      consideration: +(32 + t * 44).toFixed(1),
      preference:    +(24 + t * 46).toFixed(1),
      action:        +(15 + t * 34).toFixed(1),
      loyalty:       +(20 + t * 40).toFixed(1),
      advocacy:      +(12 + t * 30).toFixed(1),
      dropoffs: {
        awareness_to_consideration:  +(38 - t * 14).toFixed(1),
        consideration_to_preference: +(30 - t * 12).toFixed(1),
        preference_to_action:        +(45 - t * 15).toFixed(1),
      },
    })
  }
  await sb.from('funnel_snapshots').insert(bgFunnelRows)

  /* ── 19. Competitor sightings ──────────────────────────────────────────── */
  await sb.from('competitor_sightings').insert([
    { brand_id: brandId, competitor_name: 'HubSpot Nigeria',       lat: 6.4550, lng: 3.3841, sighting_type: 'billboard',  city: 'Lagos', state: 'Lagos', spotted_at: dAgo(28), description: 'HubSpot Nigeria LinkedIn Sponsored Content targeting "CRM Nigeria" and "Bridger CRM alternative" comparison keywords — first direct-comparison paid push we have tracked from them.' },
    { brand_id: brandId, competitor_name: 'Zoho CRM',              lat: 9.0765, lng: 7.3986, sighting_type: 'activation', city: 'Abuja', state: 'FCT',   spotted_at: dAgo(21), description: 'Zoho CRM reseller signage spotted at a Wuse II business park, part of their newly announced Abuja partner network expansion.' },
    { brand_id: brandId, competitor_name: 'Salesforce Essentials', lat: 6.4281, lng: 3.4219, sighting_type: 'activation', city: 'Lagos', state: 'Lagos', spotted_at: dAgo(35), description: 'Salesforce Essentials booth at the Lagos SME Tech Expo, running live demos targeting sub-50-seat sales teams — Bridger\'s core Pro-tier segment.' },
    { brand_id: brandId, competitor_name: 'Freshsales',            lat: 6.5833, lng: 3.3500, sighting_type: 'activation', city: 'Lagos', state: 'Lagos', spotted_at: dAgo(14), description: 'Freshsales running a 6-month free trial promo targeted at Nigerian startup founders via LinkedIn DMs and founder Slack communities.' },
  ])

  /* ── 20. Press mentions (PR tracking) ─────────────────────────────────── */
  const bgPress = [
    { headline: 'Bridger CRM Launches "Built for Nigeria" Campaign for SME Sales Teams',    publication: 'TechCabal',    url: 'https://techcabal.com/bridger-built-for-nigeria-launch', pub_date: dAgo(178), sent_score: 0.80, sent_label: 'positive', reach: 140_000, emv:   770_000, is_comp: false, comp: null,               snippet: 'Bridger CRM has launched an integrated campaign positioning itself as the CRM built specifically for how Nigerian SME sales teams operate, with local currency support and WhatsApp-native workflows.' },
    { headline: 'Nigerian B2B SaaS Founders Push Back on Dollar-Denominated Pricing',        publication: 'Techpoint Africa', url: 'https://techpoint.africa/naira-pricing-b2b-saas', pub_date: dAgo(150), sent_score: 0.20, sent_label: 'neutral',  reach: 90_000,  emv:    45_000, is_comp: false, comp: null,               snippet: 'A growing number of Nigerian B2B software buyers are favouring naira-priced local alternatives over dollar-denominated global tools as forex volatility squeezes IT budgets.' },
    { headline: 'HubSpot Announces West Africa Pricing Tier',                                publication: 'BusinessDay',  url: 'https://businessday.ng/hubspot-west-africa-pricing',    pub_date: dAgo(30),  sent_score: 0.10, sent_label: 'neutral',  reach: 110_000, emv:   -55_000, is_comp: true,  comp: 'HubSpot Nigeria', snippet: 'HubSpot has introduced a discounted West Africa pricing tier, a move seen as a direct response to growing competition from locally built CRM alternatives such as Bridger CRM.' },
    { headline: 'Bridger CRM Launches Enterprise Tier at Lagos Demo Day',                     publication: 'TechCabal',    url: 'https://techcabal.com/bridger-enterprise-demo-day',      pub_date: dAgo(21),  sent_score: 0.88, sent_label: 'positive', reach: 180_000, emv: 1_260_000, is_comp: false, comp: null,               snippet: 'Bridger CRM used its Lagos Demo Day to launch an Enterprise tier aimed at Nigerian companies with 200 or more employees, drawing over 140 decision-makers to the event.' },
    { headline: 'Bridger CRM vs HubSpot: An Honest Comparison for Nigerian Sales Teams',      publication: 'Techpoint Africa', url: 'https://techpoint.africa/bridger-vs-hubspot-comparison', pub_date: dAgo(14),  sent_score: 0.72, sent_label: 'positive', reach: 95_000,  emv:   522_500, is_comp: true,  comp: 'HubSpot Nigeria', snippet: 'Bridger CRM has published a transparent comparison page against HubSpot, which within 72 hours was ranking on the first page of Google for "CRM Nigeria" searches.' },
    { headline: 'Zoho CRM Expands Partner Network to Eight Nigerian Cities',                  publication: 'BusinessDay',  url: 'https://businessday.ng/zoho-partner-network-expansion',  pub_date: dAgo(24),  sent_score: 0.15, sent_label: 'neutral',  reach: 85_000,  emv:   -42_500, is_comp: true,  comp: 'Zoho CRM',        snippet: 'Zoho CRM has signed reseller agreements in eight additional Nigerian cities, aiming to counter the distribution gap that has favoured Bridger CRM in mid-market accounts.' },
    { headline: 'Bridger CRM Passes 1,200 Paying Nigerian Businesses',                        publication: 'Nairametrics', url: 'https://nairametrics.com/bridger-crm-1200-customers',    pub_date: dAgo(8),   sent_score: 0.90, sent_label: 'positive', reach: 130_000, emv:   715_000, is_comp: false, comp: null,               snippet: 'Bridger CRM has crossed 1,200 paying customers, growing from 3 beta users in 2024, with the company crediting its local support model and naira-first pricing for the traction.' },
  ]
  await sb.from('press_mentions').insert(bgPress.map(m => ({
    brand_id: brandId, headline: m.headline, publication: m.publication, url: m.url,
    published_at: m.pub_date, sentiment_score: m.sent_score, sentiment_label: m.sent_label,
    estimated_reach: m.reach, emv: m.emv, mention_type: 'press' as const,
    is_competitor: m.is_comp, competitor_name: m.comp, raw_snippet: m.snippet, crawl_source: 'manual',
  })))

  /* ── 21. Creative analyses ────────────────────────────────────────────── */
  await sb.from('creative_analyses').insert([
    {
      brand_id: brandId, analysis_type: 'compare',
      input_data: { platform: 'linkedin', creativeA: 'Zenith Logistics customer case study post', creativeB: 'Enterprise tier feature-list carousel' },
      result: {
        winner: 'A',
        why_winner: 'The customer case study scores substantially higher on trust and conversion intent (90 vs 71) — a named Nigerian company with a concrete 28% sales-cycle reduction is exactly the peer proof B2B buyers look for before a demo request.',
        creative_a: { engagement: 82, cultural_resonance: 84, brand_fit: 88, tone: 85, clarity: 87, risk: 8,  summary: 'Named customer, concrete metric, and Nigerian context make this the highest-converting post format for Bridger. Extend to a short-form video version.' },
        creative_b: { engagement: 68, cultural_resonance: 60, brand_fit: 74, tone: 66, clarity: 90, risk: 15, summary: 'Clear and accurate but generic — feature carousels perform fine for consideration-stage retargeting, weak for cold LinkedIn reach.' },
      },
      created_at: tsAgo(30, 11),
    },
    {
      brand_id: brandId, analysis_type: 'identity',
      input_data: { captions: ['Bridger CRM is Built for Nigeria. Your pipeline. Your rules. Your team.', 'How do Nigerian sales teams close 40% more deals? Meet Bridger CRM.', 'Enterprise CRM without the enterprise nonsense.', '1,200 Nigerian businesses trust Bridger CRM to manage their pipeline.'], brandValues: ['Built for Nigeria', 'Simplicity', 'Reliability', 'Local First'] },
      result: {
        consistency_score: 88,
        strengths: ['"Built for Nigeria" is repeated and reinforced rather than diluted across captions — strong tagline discipline', 'Concrete numbers (40%, 1,200) appear consistently, matching the practical, credible brand voice', 'Short declarative sentences match the "practical, knowledgeable, friendly" tone'],
        drift_warnings: ['"Without the enterprise nonsense" is a sharper, more informal register than the other three captions — check it still reads as "practical" rather than dismissive of the category', 'No Pidgin or local-language texture despite it being part of the declared voice — English-only across all four'],
        adjustments: ['Keep the number-led format as the default template for new captions', 'Test one caption per month with light Pidgin texture to match the brand voice language mix', 'Standardise on either full sentences or fragments — currently mixed within the same content calendar'],
      },
      created_at: tsAgo(12, 14),
    },
    {
      brand_id: brandId, analysis_type: 'competitor',
      input_data: { competitorName: 'HubSpot Nigeria', content: 'HubSpot. The all-in-one CRM platform trusted by over 200,000 businesses worldwide. Start free today.' },
      result: {
        tone: 'Global / Authority-led',
        cultural_fit: 41,
        engagement_potential: 55,
        strategic_insights: ['"200,000 businesses worldwide" is a global proof point with zero Nigeria-specific relevance — a gap Bridger\'s local case studies directly exploit', 'No mention of local currency, local support, or Nigerian business context anywhere in the message', '"Start free today" pricing framing does not address the West Africa pricing tier HubSpot itself just announced — messaging and pricing are out of sync'],
        counter_positions: ['Bridger should keep leading with named Nigerian customers rather than global scale claims — authenticity beats scale in this category locally', 'Directly address the pricing confusion HubSpot has created with its new West Africa tier via the comparison page', 'Emphasise the local support team as a structural advantage global platforms cannot easily replicate'],
      },
      created_at: tsAgo(5, 9),
    },
  ])

  /* ── 22. Pre-post analyses ────────────────────────────────────────────── */
  await sb.from('pre_post_analyses').insert([
    {
      brand_id: brandId, created_by: userId,
      content_text: 'Enterprise tier is live. Book your demo this week and see why 1,200 Nigerian businesses trust Bridger CRM.',
      platform: 'linkedin', target_segment: 'Lagos Professional Enterprises', funnel_goal: 'action',
      engagement_score: 87, cultural_score: 78, tone_score: 84, clarity_score: 90, risk_score: 8,
      risk_flags: [],
      verdict: 'Approve',
      improvements: ['Add a specific decision-maker persona to the CTA ("Book a demo for your sales director")', 'Pair with a one-line ROI stat for scroll-stopping power'],
      suggested_rewrite: null,
    },
    {
      brand_id: brandId, created_by: userId,
      content_text: 'HubSpot is overpriced and out of touch with Nigerian business. Bridger CRM is simply better. Switch now.',
      platform: 'twitter', target_segment: 'Nigerian SME Owners', funnel_goal: 'preference',
      engagement_score: 54, cultural_score: 48, tone_score: 26, clarity_score: 78, risk_score: 70,
      risk_flags: [{ type: 'brand_risk', detail: 'Naming and disparaging HubSpot directly invites a defensive response and reads as insecure rather than confident' }, { type: 'tone_risk', detail: 'Blunt dismissal contradicts the "practical, knowledgeable, friendly" brand voice — the comparison page format is already working, this undercuts it' }],
      verdict: 'Reject — do not publish',
      improvements: ['Let the published comparison page carry the direct comparison — keep social posts values-led, not competitor-led', 'Replace the claim with a proof point: a named customer or a specific number'],
      suggested_rewrite: 'Naira pricing. Local support. Built for how Nigerian sales teams actually work. That is Bridger CRM.',
    },
    {
      brand_id: brandId, created_by: userId,
      content_text: 'Webinar recap: 5 ways Nigerian SMEs can double pipeline velocity with CRM automation. Watch the replay.',
      platform: 'linkedin', target_segment: 'Nigerian SME Owners', funnel_goal: 'consideration',
      engagement_score: 74, cultural_score: 70, tone_score: 80, clarity_score: 85, risk_score: 10,
      risk_flags: [],
      verdict: 'Approve — strong cultural fit',
      improvements: ['Pin a top comment with the replay link for LinkedIn algorithm visibility', 'Add one attendee quote to increase social proof'],
      suggested_rewrite: null,
    },
  ])

  /* ── 23. Crawl runs ────────────────────────────────────────────────────── */
  await sb.from('crawl_runs').insert(
    Array.from({ length: 10 }, (_, i) => ({
      brand_id:       brandId,
      trigger_type:   i % 3 === 0 ? 'manual' : 'cron',
      status:         'done',
      mentions_found: 16 + Math.round(Math.abs(Math.sin(i * 1.2)) * 18),
      classified:     14 + Math.round(Math.abs(Math.sin(i * 1.2)) * 15),
      started_at:     tsAgo(i * 3, 6),
      completed_at:   tsAgo(i * 3, 6),
    }))
  )

  /* ── 24. AI conversation sample ────────────────────────────────────────── */
  await sb.from('ai_conversations').insert({
    brand_id: brandId, user_id: userId,
    messages: [
      { role: 'user', content: 'Why did HubSpot\'s West Africa pricing announcement affect our share of voice?', timestamp: tsAgo(25) },
      { role: 'assistant', content: 'Bridger CRM\'s SOV dipped from 17.4% to 16.1% in the week following HubSpot\'s West Africa pricing announcement, then recovered. Two mechanics were at play:\n\n**1. Conversation volume shift, not sentiment shift.** HubSpot\'s announcement generated a spike in "CRM Nigeria pricing" conversation that HubSpot itself dominated for about five days — it is a volume story, not a quality-of-brand story. Your sentiment held steady at 73-74 throughout.\n\n**2. The comparison page absorbed the spillover.** Once your Bridger vs HubSpot comparison page started ranking on Google, a meaningful share of that new "CRM Nigeria pricing" search traffic redirected to your content instead of HubSpot\'s, which is why SOV recovered to 17.4% by week three.\n\nThe net effect of a competitor pricing announcement, if you have credible content already in place, tends to grow the total addressable conversation rather than simply take share from you.', timestamp: tsAgo(25) },
      { role: 'user', content: 'Should we worry about Zoho\'s new resellers in the North?', timestamp: tsAgo(10) },
      { role: 'assistant', content: 'Worth watching, not worrying yet. Two data points matter:\n\n**1. You have zero Enterprise pipeline in Kano, Kaduna, or Maiduguri today.** Zoho\'s reseller expansion is filling a gap you have not yet contested, not taking share from an existing Bridger position.\n\n**2. North Nigeria represents roughly 28% of Nigerian SME GDP by your own market sizing** — a real opportunity, not just defensive territory. The highest-leverage response is not matching Zoho\'s reseller count but securing one credible local partner in Kano before their network fully locks in distribution. First-mover credibility in an underserved region compounds faster than late competitive parity.', timestamp: tsAgo(10) },
    ],
    sources_cited: [
      { type: 'sov_snapshots',   period: 'Q2 2026', rows: 8 },
      { type: 'press_mentions',  keyword: 'HubSpot West Africa', count: 2 },
      { type: 'weekly_briefings', period: 'Enterprise launch', rows: 4 },
    ],
  })

  /* ── 25. Budget plan + line items + actuals (Enterprise Launch) ───────── */
  const { data: bgBudget } = await sb.from('budget_plans').insert({
    brand_id: brandId, name: 'Bridger Enterprise Tier Launch — Q2 2026',
    period_start: dAgo(30), period_end: dAgo(-60),
    total_budget: 22_000_000, currency: 'NGN',
    status: 'active', notes: 'Enterprise tier go-to-market. LinkedIn-weighted with a flagship Demo Day event.',
    created_by: userId,
  }).select('id').single()

  if (bgBudget?.id) {
    const { data: bgLi1 } = await sb.from('budget_line_items').insert({ brand_id: brandId, plan_id: bgBudget.id, channel: 'digital', label: 'LinkedIn + Google Ads — Enterprise targeting', planned_amount: 12_000_000, actual_amount: 8_420_000, currency: 'NGN', campaign_id: camp2Id }).select('id').single()
    const { data: bgLi2 } = await sb.from('budget_line_items').insert({ brand_id: brandId, plan_id: bgBudget.id, channel: 'events',  label: 'Enterprise Demo Day production',           planned_amount: 2_800_000,  actual_amount: 2_800_000, currency: 'NGN', campaign_id: camp2Id }).select('id').single()
    const { data: bgLi3 } = await sb.from('budget_line_items').insert({ brand_id: brandId, plan_id: bgBudget.id, channel: 'pr',      label: 'TechCabal + Techpoint launch coverage',      planned_amount: 1_800_000,  actual_amount: 1_800_000, currency: 'NGN' }).select('id').single()
    const { data: bgLi4 } = await sb.from('budget_line_items').insert({ brand_id: brandId, plan_id: bgBudget.id, channel: 'content', label: 'Comparison page + case study production',    planned_amount: 1_200_000,  actual_amount: 640_000,   currency: 'NGN' }).select('id').single()

    const bgActuals = [
      { li: bgLi1?.id, amount: 4_210_000, desc: 'LinkedIn Sponsored Content — Week 1-2', ref: 'LI-BG-101', spent_on: dAgo(24) },
      { li: bgLi1?.id, amount: 4_210_000, desc: 'Google Ads enterprise keywords — Week 3-4', ref: 'GGL-BG-102', spent_on: dAgo(10) },
      { li: bgLi2?.id, amount: 2_800_000, desc: 'Demo Day venue + production',            ref: 'EVT-BG-201', spent_on: dAgo(21) },
      { li: bgLi3?.id, amount: 1_800_000, desc: 'TechCabal + Techpoint launch feature',    ref: 'PR-BG-301',  spent_on: dAgo(21) },
      { li: bgLi4?.id, amount: 640_000,   desc: 'Bridger vs HubSpot comparison page build', ref: 'CNT-BG-401', spent_on: dAgo(14) },
    ]
    for (const a of bgActuals) {
      if (!a.li) continue
      await sb.from('budget_actuals').insert({ brand_id: brandId, line_item_id: a.li, amount: a.amount, currency: 'NGN', description: a.desc, reference: a.ref, spent_on: a.spent_on, created_by: userId })
    }
  }

  /* ── 26. A/B Experiments ───────────────────────────────────────────────── */
  const { data: bgExp1 } = await sb.from('ab_experiments').insert({
    brand_id: brandId, name: 'Enterprise Pricing Page CTA',
    hypothesis: 'A "Book a demo" CTA will convert better on the Enterprise pricing page than a "Contact sales" CTA, because it sets a clearer, lower-commitment next step',
    experiment_type: 'creative', metric_primary: 'click_through_rate', metrics_secondary: ['conversion_rate'],
    status: 'concluded', confidence_target: 95, min_sample_size: 400,
    started_at: tsAgo(35), concluded_at: tsAgo(18),
  }).select('id').single()

  const { data: bgExp2 } = await sb.from('ab_experiments').insert({
    brand_id: brandId, name: 'Trial Signup Form Length',
    hypothesis: 'A 3-field signup form (name, email, company) will convert more trials than the current 6-field form',
    experiment_type: 'creative', metric_primary: 'conversion_rate',
    status: 'running', confidence_target: 95, min_sample_size: 300,
    started_at: tsAgo(9),
  }).select('id').single()

  const { data: bgExp3 } = await sb.from('ab_experiments').insert({
    brand_id: brandId, name: 'Enterprise Trial Nurture Email Subject Line',
    hypothesis: 'A subject line referencing a named customer result ("How Zenith Logistics cut their sales cycle 28%") will lift open rate over a generic feature-benefit subject line',
    experiment_type: 'email', metric_primary: 'open_rate',
    status: 'draft', confidence_target: 90, min_sample_size: 250,
  }).select('id').single()

  if (bgExp1?.id) {
    await sb.from('ab_variants').insert({ brand_id: brandId, experiment_id: bgExp1.id, name: 'Control — Contact Sales', is_control: true, impressions: 8_400, conversions: 302, revenue: 0, sort_order: 1, content: { cta_text: 'Contact Sales' } })
    const { data: bgV1v } = await sb.from('ab_variants').insert({ brand_id: brandId, experiment_id: bgExp1.id, name: 'Variant — Book a Demo', is_control: false, impressions: 8_350, conversions: 461, revenue: 0, sort_order: 2, content: { cta_text: 'Book a Demo' } }).select('id').single()
    if (bgV1v?.id) await sb.from('ab_experiments').update({ winner_variant_id: bgV1v.id }).eq('id', bgExp1.id)
  }
  if (bgExp2?.id) {
    await sb.from('ab_variants').insert({ brand_id: brandId, experiment_id: bgExp2.id, name: 'Control — 6-field form', is_control: true, impressions: 2_100, conversions: 168, revenue: 0, sort_order: 1, content: { fields: ['name', 'email', 'company', 'phone', 'team_size', 'role'] } })
    await sb.from('ab_variants').insert({ brand_id: brandId, experiment_id: bgExp2.id, name: 'Variant — 3-field form',  is_control: false, impressions: 2_080, conversions: 249, revenue: 0, sort_order: 2, content: { fields: ['name', 'email', 'company'] } })
  }
  if (bgExp3?.id) {
    await sb.from('ab_variants').insert({ brand_id: brandId, experiment_id: bgExp3.id, name: 'Control — Feature-Benefit Subject', is_control: true, impressions: 0, conversions: 0, revenue: 0, sort_order: 1, content: { subject: 'Get more out of your Bridger CRM trial' } })
    await sb.from('ab_variants').insert({ brand_id: brandId, experiment_id: bgExp3.id, name: 'Variant — Customer Result Subject', is_control: false, impressions: 0, conversions: 0, revenue: 0, sort_order: 2, content: { subject: 'How Zenith Logistics cut their sales cycle 28% with Bridger' } })
  }

  /* ── 27. Advocacy scores (weekly for 12 weeks) ────────────────────────── */
  const bgAdvocacyRows = Array.from({ length: 12 }, (_, i) => {
    const w = 11 - i
    const ss = sentScore(w * 7)
    const vol = Math.round(18 + i * 2.4 + Math.sin(i * 0.7) * 3)
    const posVol = Math.round(vol * (0.60 + (ss / 100) * 0.18))
    const negVol = Math.round(vol * (0.08 - (ss / 100) * 0.03))
    const neuVol = vol - posVol - negVol
    const reach = Math.round(vol * (2200 + i * 160))
    const engagement = Math.round(reach * 0.045)
    const sentRatio = posVol / vol
    const volScore = Math.min(100, (vol / 45) * 100)
    const reachScore = Math.min(100, (reach / 90_000) * 100)
    const engmtScore = Math.min(100, (engagement / 4_500) * 100)
    const score = (sentRatio * 40) + ((volScore * 0.5 + reachScore * 0.5) * 0.4) + (engmtScore * 0.2)
    return {
      brand_id: brandId, week_start: dAgo(w * 7 + 6),
      ugc_mentions: vol, positive_mentions: posVol, neutral_mentions: neuVol, negative_mentions: negVol,
      avg_sentiment: +ss.toFixed(2), total_reach: reach, total_engagement: engagement,
      top_platforms: { twitter: Math.round(vol * 0.65), instagram: Math.round(vol * 0.20), linkedin: Math.round(vol * 0.15) },
      top_themes: ss > 70 ? ['built for Nigeria', 'local support', 'enterprise launch'] : ['pricing comparison', 'onboarding friction', 'competitor evaluation'],
      advocacy_score: +Math.min(100, score).toFixed(2),
      score_delta: i > 0 ? +(Math.sin(i * 0.5) * 2.6).toFixed(2) : 0,
      score_factors: { sentiment_contribution: +(sentRatio * 40).toFixed(1), volume_contribution: +((volScore * 0.5 + reachScore * 0.5) * 0.4).toFixed(1), engagement_contribution: +(engmtScore * 0.2).toFixed(1) },
    }
  })
  await sb.from('advocacy_scores').insert(bgAdvocacyRows)

  /* ── 28. Promoters + referral codes ───────────────────────────────────── */
  const bgPromoterData = [
    { name: 'Chike Okonkwo',   email: 'chike.o@zenithlogistics.ng', phone: '+2348012301001', nps: 10, city: 'Lagos', code: 'BP-BRG01', clicks: 38, conversions: 11 },
    { name: 'Amara Nwachukwu', email: 'amara.n@example.com',        phone: '+2348023402002', nps: 9,  city: 'Lagos', code: 'BP-BRG02', clicks: 26, conversions: 7  },
    { name: 'Taiwo Adesanya',  email: 'taiwo.a@example.com',        phone: '+2348045604004', nps: 10, city: 'Abuja', code: 'BP-BRG03', clicks: 19, conversions: 5  },
    { name: 'Ngozi Ibe',       email: 'ngozi.i@example.com',        phone: '+2348056705005', nps: 9,  city: 'Lagos', code: 'BP-BRG04', clicks: 14, conversions: 4  },
  ]
  for (const p of bgPromoterData) {
    const { data: bgProm } = await sb.from('promoters').insert({
      brand_id: brandId, name: p.name, email: p.email, phone: p.phone,
      nps_score: p.nps, source: 'nps', status: 'active',
    }).select('id').single()
    if (bgProm?.id) {
      await sb.from('referral_codes').insert({
        brand_id: brandId, promoter_id: bgProm.id, code: p.code,
        destination_url: 'https://bridgercrm.ng/refer',
        clicks: p.clicks, conversions: p.conversions, is_active: true,
      })
    }
  }

  /* ── 29. Customer profiles (CDP) ──────────────────────────────────────── */
  await sb.from('customer_profiles').insert([
    { brand_id: brandId, name: 'Chike Okonkwo',   email: 'chike.o@zenithlogistics.ng', phone: '+2348012301001', nps_score: 10, nps_label: 'promoter', last_seen_at: dAgo(1),  is_promoter: true,  segments: ['promoter', 'enterprise-tier', 'referrer'],       sources: { nps: true, referral: true },  retention_risk_score: 4,  acquisition_source: 'referral' },
    { brand_id: brandId, name: 'Amara Nwachukwu', email: 'amara.n@example.com',        phone: '+2348023402002', nps_score: 9,  nps_label: 'promoter', last_seen_at: dAgo(3),  is_promoter: true,  segments: ['promoter', 'pro-tier', 'referrer'],              sources: { nps: true, referral: true },  retention_risk_score: 8,  acquisition_source: 'event' },
    { brand_id: brandId, name: 'Taiwo Adesanya',  email: 'taiwo.a@example.com',        phone: '+2348045604004', nps_score: 10, nps_label: 'promoter', last_seen_at: dAgo(5),  is_promoter: true,  segments: ['promoter', 'enterprise-tier'],                   sources: { nps: true },                  retention_risk_score: 6,  acquisition_source: 'event' },
    { brand_id: brandId, name: 'Ngozi Ibe',       email: 'ngozi.i@example.com',        phone: '+2348056705005', nps_score: 9,  nps_label: 'promoter', last_seen_at: dAgo(7),  is_promoter: true,  segments: ['promoter', 'pro-tier'],                          sources: { nps: true },                  retention_risk_score: 11, acquisition_source: 'webinar' },
    { brand_id: brandId, name: 'Bimpe Lawal',     email: 'bimpe.l@example.com',        phone: '+2348034503003', nps_score: 7,  nps_label: 'passive',  last_seen_at: dAgo(16), is_promoter: false, segments: ['passive', 'pro-tier'],                           sources: { nps: true },                  retention_risk_score: 32, acquisition_source: 'linkedin' },
    { brand_id: brandId, name: 'Segun Adeyinka',  email: 'seguntech@example.com',      phone: '+2348067806006', nps_score: 8,  nps_label: 'passive',  last_seen_at: dAgo(20), is_promoter: false, segments: ['passive', 'starter-tier'],                       sources: { nps: true },                  retention_risk_score: 28, acquisition_source: 'linkedin' },
    { brand_id: brandId, name: 'Adaeze Ilo',      email: 'adaezeilo@example.com',      phone: '+2348078901007', nps_score: 5,  nps_label: 'detractor', last_seen_at: dAgo(38), is_promoter: false, segments: ['detractor', 'starter-tier', 'churn-risk'],       sources: { nps: true },                  retention_risk_score: 74, acquisition_source: 'trial' },
    { brand_id: brandId, name: 'Babatunde Lawal', email: 'btlawal@example.com',        phone: '+2348089012008', nps_score: 4,  nps_label: 'detractor', last_seen_at: dAgo(42), is_promoter: false, segments: ['detractor', 'starter-tier', 'support-issue'],    sources: { nps: true },                  retention_risk_score: 81, acquisition_source: 'trial' },
  ])

  /* ── 30. Creative assets (Creative Library vault) ─────────────────────── */
  const bgCreativeAssets = [
    { title: 'Zenith Logistics Case Study — LinkedIn Post', description: 'Named-customer case study: how Zenith Logistics cut sales cycle 28% in 90 days with Bridger CRM. Includes a pull-quote from their sales director.', asset_type: 'copy', format: 'LinkedIn Post', platform: 'LinkedIn', status: 'vetted', fit_for_ads: true, performance: { impressions: 620_000, clicks: 24_800, ctr: 4.0, conversions: 1_240, spend: 480_000, roas: 5.6 }, replication_elements: ['Named customer with a real, checkable metric', 'Direct quote from a decision-maker, not marketing copy', 'One number in the headline, not three'], tags: ['case-study', 'linkedin', 'top-performer'] },
    { title: 'Bridger vs HubSpot — Comparison Page', description: 'Long-form comparison page: pricing, features, and Nigeria-fit laid out side by side. Ranking on Google for "CRM Nigeria" searches.', asset_type: 'copy', format: 'Landing Page', platform: 'Web', status: 'vetted', fit_for_ads: false, performance: { impressions: 84_000, clicks: 12_600, ctr: 15.0, conversions: 890 }, replication_elements: ['Transparent about where the competitor genuinely wins, not just where Bridger wins', 'Naira pricing shown directly next to converted dollar pricing', 'FAQ section addresses the actual objections sales hears most'], tags: ['comparison', 'seo', 'top-performer'] },
    { title: 'Enterprise Tier Launch — LinkedIn Carousel', description: '6-slide carousel walking through Enterprise tier features: unlimited contacts, custom workflows, dedicated CSM, multi-currency support.', asset_type: 'carousel', format: 'LinkedIn Carousel', platform: 'LinkedIn', status: 'vetted', fit_for_ads: true, performance: { impressions: 340_000, clicks: 15_300, ctr: 4.5, conversions: 610, spend: 620_000, roas: 3.4 }, replication_elements: ['One feature per slide, no crowding', 'Final slide is always the demo-booking CTA', 'Multi-currency support slide consistently gets the highest dwell time'], tags: ['carousel', 'enterprise', 'linkedin'] },
    { title: 'Enterprise Demo Day — Event Recap Video', description: '60-second recap of the Enterprise Demo Day: crowd shots, live demo moments, attendee reactions. Used for post-event nurture and future event promotion.', asset_type: 'video', format: 'LinkedIn Video', platform: 'LinkedIn', status: 'vetted', fit_for_ads: false, performance: { impressions: 210_000, clicks: 8_400 }, replication_elements: ['Real attendee reactions outperform staged testimonials', 'Keep energy high in the first 5 seconds — event recaps lose viewers fast otherwise', 'End with next event date, even if not yet confirmed — keeps the pipeline warm'], tags: ['event', 'video', 'recap'] },
    { title: 'SME Webinar Registration Landing Page', description: 'Registration page for the quarterly SME Growth Webinar Series. Simple form, speaker bios, and past-session replay links.', asset_type: 'copy', format: 'Landing Page', platform: 'Web', status: 'active', fit_for_ads: false, performance: { impressions: 42_000, clicks: 6_300, ctr: 15.0, conversions: 2_400 }, replication_elements: ['Past-session replays build credibility for first-time registrants', 'Keep the form to name, email, company — anything more drops registrations', 'Speaker bio photos increase perceived legitimacy for a free webinar'], tags: ['webinar', 'landing-page', 'lead-gen'] },
  ]
  for (const asset of bgCreativeAssets) {
    await sb.from('creative_assets').insert({ brand_id: brandId, ...asset })
  }

  /* ── Done ─────────────────────────────────────────────────────────────── */
  return NextResponse.json({
    success: true,
    credentials: { email: DEMO_EMAIL, password: DEMO_PASSWORD, note: 'Login at /auth/login' },
    brand: 'Bridger CRM',
    workspace: 'Bridger (Pro plan)',
    seeded: {
      sentimentDays: 365, bhiSnapshots: 180, sovSnapshots: 25,
      campaigns: 4, events: 2, influencers: 6, mentions: 70,
      socialPosts: 25, npsRecords: 50, metricManual: Object.keys(bridgerSeries).length,
      funnelSnapshots: 12, competitorSightings: 4, pressMentions: bgPress.length,
      creativeAnalyses: 3, prePostAnalyses: 3, crawlRuns: 10, abExperiments: 3,
      advocacyWeeks: 12, promoters: 4, customerProfiles: 8, creativeAssets: bgCreativeAssets.length,
    },
  })
}
