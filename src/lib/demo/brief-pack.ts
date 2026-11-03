/**
 * The Monday Brief, seeded for a demo account.
 *
 * Eight weeks of the brand's weekly check-in number, three moments, and last
 * week's brief. The brief is written here rather than by the model, because a
 * seed must not spend AI calls or change on every run. It follows the same
 * rules the live job enforces: the change is the arithmetic of the seeded
 * numbers, every reason cites a seeded moment, and every link is labelled
 * "moved together", never a cause.
 *
 * No '@/' imports, so npm run demo:check can compile and run it standalone.
 */
import { checkinMetricFor, lastWeek, addDays, weekLabel, MOMENT_KINDS, type BriefBrandType } from '../brief/metrics'
import type { BriefContent, BriefSource } from '../brief/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any

export interface BriefPackConfig {
  brandId:   string
  brandName: string
  brandType: BriefBrandType
  /** Seeded competitors, so a reason can name one. */
  competitors?: string[]
  /** Fixed "now", for the checker. Defaults to the real date. */
  now?: Date
}

/** A typical week for each vertical, at the scale its check-in asks about. */
const BASE: Record<BriefBrandType, number> = {
  fintech: 4200, fmcg: 18500, beverage_alcohol: 920, venue: 640,
  b2b_saas: 85, marketplace: 3100, b2b_distribution: 410, agency: 12,
}

/** What happened, per vertical: one thing that lifted the number three weeks
 *  ago, one PR moment, and the thing that ended last week, which is the
 *  story the brief tells. */
const MOMENTS: Record<BriefBrandType, { lift: string; pr: string; ended: string }> = {
  fintech:          { lift: 'Launched ₦1,000 referral bonus',        pr: 'Founder interview on TechCabal',          ended: 'Weekend cashback promo ended' },
  fmcg:             { lift: 'Started buy-2-get-1 at Shoprite',        pr: 'Featured in BusinessDay food column',     ended: 'Buy-2-get-1 promo ended' },
  beverage_alcohol: { lift: 'Launched festive gift pack',             pr: 'Sponsored Lagos food festival',           ended: 'Festive gift pack sold out' },
  venue:            { lift: 'Added Sunday brunch',                    pr: 'Reviewed by Guardian Life',               ended: 'Happy hour discount ended' },
  b2b_saas:         { lift: 'Opened free 30-day trial',               pr: 'Spoke at Techpoint Build',                ended: 'Free trial offer closed' },
  marketplace:      { lift: 'Cut seller fees to 3%',                  pr: 'Featured in Nairametrics',                ended: 'Free delivery week ended' },
  b2b_distribution: { lift: 'Added same-day delivery in Ikeja',       pr: 'Trade press feature in BusinessDay',      ended: 'Bulk-order discount ended' },
  agency:           { lift: 'Published Nigeria media cost report',    pr: 'Won a Lagos Advertising award',           ended: 'Free audit offer closed' },
}

export async function seedBriefPack(sb: Sb, cfg: BriefPackConfig): Promise<string[]> {
  const added: string[] = []
  const metric = checkinMetricFor(cfg.brandType)
  const { start: last } = lastWeek(cfg.now)
  const base = BASE[cfg.brandType] ?? 1000
  const m = MOMENTS[cfg.brandType] ?? MOMENTS.fmcg

  // ── Eight weeks of the number ─────────────────────────────────────────────
  // Flat, then a lift from the week the referral/promo starts, then a dip
  // last week when the promo ends. Deterministic, so reruns match.
  const shape = [1.00, 0.98, 1.02, 1.00, 1.08, 1.12, 1.11, 1.01]
  const weeks = shape.map((f, i) => ({ week: addDays(last, -7 * (shape.length - 1 - i)), value: Math.round(base * f) }))
  const rows = weeks.map(w => ({
    brand_id: cfg.brandId, metric_key: metric.key, value: w.value, is_index: false,
    period_start: w.week, period_end: addDays(w.week, 6), currency: 'NGN',
  }))
  const { error: mErr } = await sb.from('metric_manual').insert(rows)
  if (!mErr) added.push(`metric_manual ×${rows.length}`)

  // ── Three moments ─────────────────────────────────────────────────────────
  const liftDay  = addDays(last, -21 + 1)   // Tuesday, three weeks before
  const prDay    = addDays(last, -14 + 3)   // Thursday, two weeks before
  const endedDay = addDays(last, 0)         // Monday of last week
  const moments = [
    { brand_id: cfg.brandId, happened_on: liftDay,  kind: 'promo',  title: m.lift },
    { brand_id: cfg.brandId, happened_on: prDay,    kind: 'pr',     title: m.pr },
    { brand_id: cfg.brandId, happened_on: endedDay, kind: 'promo',  title: m.ended },
  ]
  const { error: moErr } = await sb.from('brand_moments').insert(moments)
  if (!moErr) added.push(`brand_moments ×${moments.length}`)

  // ── Last week's brief ─────────────────────────────────────────────────────
  const value = weeks[weeks.length - 1].value
  const previous = weeks[weeks.length - 2].value
  const changePct = Math.round(((value - previous) / previous) * 1000) / 10
  const src = (id: string, kind: keyof typeof MOMENT_KINDS, title: string, date: string): BriefSource =>
    ({ id, kind: 'moment', title: `${MOMENT_KINDS[kind]}: ${title}`, date })
  const ended = src('S1', 'promo', m.ended, endedDay)
  const lift  = src('S2', 'promo', m.lift, liftDay)
  const rival = cfg.competitors?.[0]

  const content: BriefContent = {
    weekStart: last,
    weekLabel: weekLabel(last),
    metric: { key: metric.key, label: metric.label, isIndex: false, value, previous, changePct, history: weeks },
    headline: `${metric.label} fell ${Math.abs(changePct)}% as your promo ended`,
    summary: `${metric.label} came in at ${value.toLocaleString('en-NG')}, down from ${previous.toLocaleString('en-NG')}. That is back to roughly where you were before the lift that started three weeks ago, so this looks like the promo wearing off rather than a new problem.`,
    causes: [
      { text: `"${m.ended}" happened at the start of the same week.`, label: 'moved_together', sources: [ended] },
      { text: `The three weeks of growth before this lined up with "${m.lift}". Last week brought you back to your usual level.`, label: 'moved_together', sources: [lift] },
    ],
    watchNext: rival
      ? `Whether ${rival} picks up the customers your promo was bringing in. If next week drops again, it is more than the promo ending.`
      : 'Whether next week settles at this level. If it drops again, it is more than the promo ending.',
    counts: { campaigns: 0, moments: 3, press: 0, competitorMoves: 0 },
    generatedAt: new Date(Date.parse(last + 'T00:00:00Z') + 7 * 86_400_000 + 8 * 3_600_000).toISOString(),
  }
  const { error: bErr } = await sb.from('weekly_briefs').insert({
    brand_id: cfg.brandId, week_start: last, status: 'ready', content,
    emailed_at: content.generatedAt,
  })
  if (!bErr) added.push('weekly_briefs ×1')

  return added
}
