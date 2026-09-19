/**
 * Nigerian calendar seasonality for demo seed data.
 *
 * The seeds used to shape their story arc off fixed day offsets ("d >= 250 is
 * the festive peak"). That works on the day it is written and rotates out of
 * true every day after: by September 2026 the Detty December peak had drifted
 * into January to April, and the brand's worst month was landing on Christmas.
 *
 * Seasonality is a property of the calendar, not of how long ago the seed ran,
 * so it is anchored to month and day here. The result is stable forever: run
 * the seed in any month and December still reads as the festive peak.
 *
 * Returns roughly -1 (worst of the year) to +1 (best of the year).
 */

/** Monthly anchors, 1 = January. Interpolated smoothly between mid-months. */
const ANCHORS: Record<number, number> = {
  1:  -0.85, // "January is long": the post-festive spend hangover
  2:  -0.35, // recovery begins, salaries land
  3:   0.05, // steady
  4:   0.20, // Easter lift
  5:   0.10, // steady
  6:  -0.10, // rainy season, school fees
  7:  -0.20, // mid-year squeeze
  8:  -0.15, // New Yam in the South East lifts the floor a little
  9:  -0.30, // back-to-school spend competes with everything else
  10:  0.15, // Independence, and the ember months begin
  11:  0.55, // Black Friday, salary advances, pre-festive build
  12:  1.00, // Detty December, Christmas, weddings, homecoming
}

/**
 * Seasonal factor for a date, interpolating between mid-month anchors so the
 * curve is smooth rather than stepping on the 1st.
 */
export function nigeriaSeasonalFactor(date: Date): number {
  const month = date.getUTCMonth() + 1
  const day   = date.getUTCDate()
  const daysInMonth = new Date(Date.UTC(date.getUTCFullYear(), month, 0)).getUTCDate()

  // position within the month relative to its midpoint, -0.5 .. +0.5
  const pos = (day - 1) / (daysInMonth - 1) - 0.5

  const prev = month === 1  ? 12 : month - 1
  const next = month === 12 ? 1  : month + 1

  const here = ANCHORS[month]
  const other = pos < 0 ? ANCHORS[prev] : ANCHORS[next]
  const blend = Math.abs(pos)          // 0 at mid-month, 0.5 at the edges

  return here * (1 - blend) + other * blend
}

/** The date `daysAgo` days before `base`, as a UTC date. */
export function dateDaysAgo(daysAgo: number, base: Date = new Date()): Date {
  const d = new Date(base)
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return d
}

/**
 * Build a sentiment score for a demo brand.
 *
 * `trend`      the brand's own trajectory, 0 at the start of the window and 1
 *              today, so "we are improving" still reads on any run date.
 * `seasonality` how much this vertical actually moves with the calendar.
 *              FMCG and drinks live on it, B2B SaaS barely notices it.
 */
export function demoSentiment(opts: {
  daysAgo: number
  windowDays: number
  /** score at the start of the window */
  from: number
  /** score today, before seasonality */
  to: number
  /** points added at the top of the festive season, subtracted in January */
  seasonality: number
  /** deterministic wobble so the line is not a ruler */
  jitter?: [number, number]
  base?: Date
}): number {
  const { daysAgo, windowDays, from, to, seasonality, jitter = [1.7, 0.9], base } = opts

  const t     = Math.min(1, Math.max(0, (windowDays - daysAgo) / windowDays))
  const trend = from + (to - from) * t

  const season = nigeriaSeasonalFactor(dateDaysAgo(daysAgo, base)) * seasonality
  const noise  = Math.sin(daysAgo * jitter[0]) * 2.4 + Math.cos(daysAgo * jitter[1]) * 1.7

  return +(Math.min(95, Math.max(18, trend + season + noise)).toFixed(1))
}

/* ── Relative date labels ────────────────────────────────────────────────── */
/*
 * Seed narrative used to carry absolute labels ("the October 2025 stockout",
 * "Q2 2026 pipeline"). They were true on the day they were written and read as
 * stale the moment the calendar moved past them, which is how a demo seeded in
 * September ended up quoting signals from July. These compute the label from
 * the run date instead, so the prose always matches the rows.
 */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December']

/** "October 2025" for a date `monthsBack` months before the run date. */
export function monthLabel(monthsBack: number, base: Date = new Date()): string {
  const d = new Date(base)
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() - monthsBack)
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

/** Just the month name, no year. */
export function monthName(monthsBack: number, base: Date = new Date()): string {
  const d = new Date(base)
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() - monthsBack)
  return MONTHS[d.getUTCMonth()]
}

/** "Q2 2026" for the quarter `quartersBack` quarters before the run date. */
export function quarterLabel(quartersBack: number, base: Date = new Date()): string {
  const d = new Date(base)
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() - quartersBack * 3)
  return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`
}

/** The year `yearsBack` years before the run date, as a string. */
export function yearLabel(yearsBack = 0, base: Date = new Date()): string {
  return String(base.getUTCFullYear() - yearsBack)
}
