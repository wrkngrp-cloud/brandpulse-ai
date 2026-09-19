/**
 * The modules every demo account was missing.
 *
 * AI visibility, marketing mix modelling and WhatsApp were empty in all four
 * accounts. TV, radio, print and field intelligence existed only for Jara
 * Foods. Surveys were six for Jara and one for everyone else.
 *
 * One pack, called at the end of each seed, so the four accounts stay in step
 * instead of drifting apart the way they already did once. What a brand gets
 * is decided by its vertical: a B2B SaaS brand has no radio spots and no
 * market field reports, and pretending otherwise would be worse than a gap.
 *
 * Every row links to the brand, and to a campaign where the schema has the
 * foreign key, so no module shows an orphaned entry.
 */
import { aiVisibilityRows, mmmRow, whatsAppRows } from './modules'
import { generateDigitalDays } from './digital-performance'
import { dateDaysAgo, monthLabel } from './seasonality'

/* Structural, so both the raw Supabase client and the trackErrors proxy fit.
   The client's own generics reject `unknown` rows, and typing this against the
   generated database types would couple the demo pack to them for no gain. */
/* eslint-disable @typescript-eslint/no-explicit-any */
type Sb = { from: (table: string) => any }

const iso = (d: Date) => d.toISOString().slice(0, 10)
const ts  = (d: Date) => d.toISOString()

export interface ModulePackConfig {
  brandId:     string
  workspaceId: string
  brandName:   string
  /** decides which vertical modules apply */
  brandType:   'fmcg' | 'fintech' | 'b2b_saas' | 'agency' | 'venue' | 'marketplace' | 'beverage_alcohol' | 'b2b_distribution'
  competitors: string[]
  /** existing campaign ids to link broadcast and print against */
  campaignIds: (string | null | undefined)[]
  /** category questions a buyer would ask an AI assistant */
  aiQuestions: string[]
  aiMentionFrom: number
  aiMentionTo:   number
  /** channel -> [share of contribution, spend NGN] */
  mmmChannels: Record<string, [number, number]>
  mmmOutcomes: number
  mmmSummary:  string
  mmmRecommendations: string[]
  base?: Date
}

/** Verticals that genuinely buy broadcast and print in this market. */
const USES_BROADCAST = new Set(['fmcg', 'fintech', 'beverage_alcohol', 'agency', 'marketplace'])
/** Verticals with a physical trade or agent network worth visiting. */
const USES_FIELD     = new Set(['fmcg', 'fintech', 'beverage_alcohol', 'b2b_distribution'])

export async function seedModulePack(sb: Sb, cfg: ModulePackConfig) {
  const { brandId, workspaceId, brandName, brandType, competitors, campaignIds, base } = cfg
  const campaignId = campaignIds.find(Boolean) ?? null
  const added: string[] = []

  /* ── Paid media performance ───────────────────────────────────────────── */
  await sb.from('digital_performance_daily').insert(generateDigitalDays(brandId, brandName))
  added.push('digital_performance_daily')

  /* ── AI visibility ────────────────────────────────────────────────────── */
  const ai = aiVisibilityRows({
    brandId, brandName,
    questions: cfg.aiQuestions,
    competitors,
    mentionRateFrom: cfg.aiMentionFrom,
    mentionRateTo:   cfg.aiMentionTo,
    base,
  })
  await sb.from('ai_visibility_checks').insert(ai.checks)
  await sb.from('ai_visibility_scores').insert(ai.scores)
  added.push('ai_visibility_checks', 'ai_visibility_scores')

  /* ── Marketing mix modelling ──────────────────────────────────────────── */
  await sb.from('mmm_runs').insert(mmmRow({
    brandId, workspaceId,
    channels: cfg.mmmChannels,
    outcomes: cfg.mmmOutcomes,
    summary:  cfg.mmmSummary,
    recommendations: cfg.mmmRecommendations,
    base,
  }))
  added.push('mmm_runs')

  /* ── WhatsApp ─────────────────────────────────────────────────────────── */
  const contacts = [
    { name: 'Amaka Nwosu',    phone: '+2348030000101', optedIn: true  },
    { name: 'Tunde Bakare',   phone: '+2348030000102', optedIn: true  },
    { name: 'Fatima Yusuf',   phone: '+2348030000103', optedIn: true  },
    { name: 'Chinedu Obi',    phone: '+2348030000104', optedIn: true  },
    { name: 'Ngozi Eze',      phone: '+2348030000105', optedIn: true  },
    { name: 'Segun Adeyemi',  phone: '+2348030000106', optedIn: true  },
    { name: 'Hauwa Abubakar', phone: '+2348030000107', optedIn: true  },
    { name: 'Emeka Okafor',   phone: '+2348030000108', optedIn: false },
  ]
  const wa = whatsAppRows({
    brandId, brandName, contacts, base,
    campaigns: [
      { name: `${brandName} NPS pulse`,      objective: 'nps',     template: 'nps_pulse_v2',   daysAgo: 12, listSize: 7 },
      { name: `${brandName} quick pulse`,    objective: 'survey',  template: 'quick_pulse_v1', daysAgo: 40, listSize: 7 },
    ],
  })
  await sb.from('whatsapp_contacts').insert(wa.contactRows)
  for (const campaign of wa.campaignRows) {
    const { data: row } = await sb.from('whatsapp_campaigns').insert(campaign).select('id').single()
    if (row?.id) {
      const daysAgo = campaign.name.includes('NPS') ? 12 : 40
      await sb.from('whatsapp_send_log').insert(wa.logRowsFor(row.id, daysAgo))
    }
  }
  added.push('whatsapp_contacts', 'whatsapp_campaigns', 'whatsapp_send_log')

  /* ── Broadcast and print, for the verticals that buy them ─────────────── */
  if (USES_BROADCAST.has(brandType)) {
    const { data: tvCh } = await sb.from('tv_channels').insert({
      name: 'Channels TV', type: 'news', platform: 'free_to_air',
      reach_prime: 4_200_000, reach_day: 1_800_000,
    }).select('id').single()

    if (tvCh?.id) {
      await sb.from('tv_schedules').insert([30, 23, 16, 9].map((d, i) => ({
        brand_id: brandId, campaign_id: campaignId, channel_id: tvCh.id,
        channel_name: 'Channels TV', programme: 'Sunrise Daily', daypart: 'breakfast',
        spot_date: iso(dateDaysAgo(d, base)), tx_time: '07:4' + i, duration_sec: 30,
        spots_planned: 6, spots_aired: 6 - (i % 2),
        grp_planned: 22.5, grp_delivered: +(22.5 - i * 0.8).toFixed(1),
        material_name: `${brandName} 30s`, rate_card: 1_850_000, discount_pct: 18,
        net_cost: 1_517_000, currency: 'NGN', status: 'aired',
      })))
      added.push('tv_channels', 'tv_schedules')
    }

    const { data: station } = await sb.from('radio_stations').insert({
      name: 'Beat FM', frequency: '99.9', city: 'Lagos', state: 'Lagos',
      reach_am: 900_000, reach_pm: 1_250_000, reach_day: 2_100_000,
      network: 'Megalectrics', is_national: false,
    }).select('id').single()

    if (station?.id) {
      await sb.from('radio_schedules').insert([28, 21, 14, 7].map((d, i) => ({
        brand_id: brandId, campaign_id: campaignId, station_id: station.id,
        station_name: 'Beat FM', daypart: i % 2 ? 'drive_pm' : 'drive_am',
        spot_date: iso(dateDaysAgo(d, base)), spot_time: i % 2 ? '17:20' : '07:30',
        duration_sec: 45, spots_planned: 10, spots_aired: 10 - (i % 3),
        material_name: `${brandName} 45s`, rate_card: 320_000, discount_pct: 25,
        net_cost: 240_000, currency: 'NGN', status: 'aired',
      })))
      added.push('radio_stations', 'radio_schedules')
    }

    const { data: pub } = await sb.from('print_publications').insert({
      name: 'BusinessDay', type: 'newspaper', circulation: 32_000,
      readership_mult: 3.4, primary_demo: 'ABC1 business decision makers',
    }).select('id').single()

    if (pub?.id) {
      await sb.from('print_placements').insert([34, 20, 6].map((d, i) => ({
        brand_id: brandId, campaign_id: campaignId, publication_id: pub.id,
        publication_name: 'BusinessDay', edition_date: iso(dateDaysAgo(d, base)),
        position: i === 0 ? 'back_page' : 'inside_right', size: 'half_page',
        colour: true, rate_card: 1_200_000, discount_pct: 20, net_cost: 960_000,
        insertions: 1, currency: 'NGN',
        vanity_slug: `${brandName.toLowerCase().replace(/\s+/g, '')}-bd-${i + 1}`,
        qr_scan_count: 0, status: 'published',
      })))
      added.push('print_publications', 'print_placements')
    }
  }

  /* ── Field intelligence, for verticals with a trade or agent network ──── */
  if (USES_FIELD.has(brandType)) {
    const { data: team } = await sb.from('fso_teams').insert({
      brand_id: brandId, workspace_id: workspaceId,
      name: brandType === 'fintech' ? 'Lagos agent network team' : 'Lagos trade team',
      token: `fso-${brandId.slice(0, 8)}`, active: true,
    }).select('id').single()

    if (team?.id) {
      for (const [i, d] of [24, 17, 10, 3].entries()) {
        const { data: report } = await sb.from('field_reports').insert({
          brand_id: brandId, workspace_id: workspaceId, fso_team_id: team.id,
          fso_name: ['Bayo Ade', 'Ifeoma Nnamdi', 'Musa Danjuma', 'Kemi Alabi'][i],
          fso_id_code: `FSO-${100 + i}`,
          report_date: iso(dateDaysAgo(d, base)),
          state: 'Lagos', lga: ['Ikeja', 'Surulere', 'Alimosho', 'Eti-Osa'][i],
          submitted_at: ts(dateDaysAgo(d, base)),
          notes: `Route completed. ${brandName} visibility steady, competitor pressure noted at two outlets.`,
        }).select('id').single()

        if (report?.id) {
          await sb.from('field_report_outlets').insert([0, 1].map(k => ({
            field_report_id: report.id, brand_id: brandId,
            outlet_name: `${['Mile 12', 'Oshodi', 'Balogun', 'Lekki'][i]} outlet ${k + 1}`,
            outlet_type: brandType === 'fintech' ? 'agent_kiosk' : 'open_market',
            product_available: k === 0, facings_count: k === 0 ? 6 : 0,
            stock_level: k === 0 ? 'healthy' : 'out_of_stock',
            observed_price_ngn: 1_450, rrp_ngn: 1_400,
            posm_present: k === 0, posm_condition: k === 0 ? 'good' : null,
            competitor_activity: k === 1, competitor_name: k === 1 ? competitors[0] : null,
            lat: 6.52 + i * 0.01, lng: 3.37 + i * 0.01,
          })))
        }
      }
      added.push('fso_teams', 'field_reports', 'field_report_outlets')
    }
  }

  /* ── Extra surveys, so every account has more than one ─────────────────── */
  const surveyDefs = [
    {
      name: `${brandName} brand awareness check`, type: 'awareness_check',
      questions: [
        { id: 'q1', text: `Have you heard of ${brandName}?`, type: 'single', options: ['Yes, I know them well', 'I have heard of them', 'No'] },
        { id: 'q2', text: 'Where did you first hear about them?', type: 'single', options: ['Social media', 'A friend', 'Radio or TV', 'Outdoor', 'Other'] },
      ],
      answers: () => ({ q1: Math.random() < 0.72 ? 'Yes, I know them well' : 'I have heard of them', q2: 'Social media' }),
    },
    {
      name: `${brandName} perception audit`, type: 'perception_audit',
      questions: [
        { id: 'q1', text: 'How much do you trust this brand?', type: 'scale', scale: 5 },
        { id: 'q2', text: 'How would you rate the quality?',   type: 'scale', scale: 5 },
        { id: 'q3', text: 'Does it feel made for people like you?', type: 'scale', scale: 5 },
      ],
      answers: () => ({ q1: 3 + Math.round(Math.random() * 2), q2: 3 + Math.round(Math.random() * 2), q3: 3 + Math.round(Math.random() * 2) }),
    },
  ]

  for (const [si, def] of surveyDefs.entries()) {
    const { data: survey } = await sb.from('surveys').insert({
      brand_id: brandId, name: def.name, type: def.type,
      questions: def.questions,
      deploy_channels: ['link', 'whatsapp', 'in_app'],
      languages: ['en', 'pcm'], status: 'active',
    }).select('id').single()

    if (survey?.id) {
      await sb.from('survey_responses').insert(
        Array.from({ length: 28 }, (_, i) => ({
          survey_id: survey.id,
          answers: def.answers(),
          source: i % 3 === 0 ? 'whatsapp' : 'link',
          language: i % 5 === 0 ? 'pcm' : 'en',
          quality_flag: 'ok',
          collected_at: ts(dateDaysAgo(60 - i * 2 - si, base)),
        })),
      )
    }
  }
  added.push('surveys', 'survey_responses')

  return { added, since: monthLabel(12, base) }
}
