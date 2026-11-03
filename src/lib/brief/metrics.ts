import type { BrandType } from '@/lib/bhi'

/**
 * The Monday Brief's weekly check-in: which number each kind of brand is
 * asked for, and how weeks are counted.
 *
 * Plain data and date maths, no server imports, so the home page, the API
 * and the weekly job all agree on the same question and the same week.
 * Keys are prefixed `wk_` so a weekly figure never collides with the monthly
 * ones already in metric_manual.
 */

export interface CheckinMetric {
  key:      string
  label:    string
  question: string
  /** Shown in the box. */
  example:  string
}

export const CHECKIN_METRICS: Record<BrandType, CheckinMetric> = {
  fintech:          { key: 'wk_new_accounts', label: 'New accounts',     question: 'How many new accounts did you get last week?',         example: 'e.g. 4210' },
  fmcg:             { key: 'wk_sales',        label: 'Units sold',       question: 'How many units did you sell last week?',                example: 'e.g. 18500' },
  beverage_alcohol: { key: 'wk_cases',        label: 'Cases sold',       question: 'How many cases did you sell last week?',                example: 'e.g. 920' },
  venue:            { key: 'wk_bookings',     label: 'Bookings',         question: 'How many bookings or covers did you have last week?',   example: 'e.g. 640' },
  b2b_saas:         { key: 'wk_signups',      label: 'New sign-ups',     question: 'How many new sign-ups or trials did you get last week?', example: 'e.g. 85' },
  marketplace:      { key: 'wk_orders',       label: 'Orders',           question: 'How many orders went through last week?',              example: 'e.g. 3100' },
  b2b_distribution: { key: 'wk_orders',       label: 'Orders',           question: 'How many orders did you fulfil last week?',            example: 'e.g. 410' },
  agency:           { key: 'wk_leads',        label: 'New client leads', question: 'How many new client leads came in last week?',         example: 'e.g. 12' },
}

export function checkinMetricFor(brandType: string | null | undefined): CheckinMetric {
  return CHECKIN_METRICS[(brandType ?? 'fmcg') as BrandType] ?? CHECKIN_METRICS.fmcg
}

// ── Weeks, counted Monday to Sunday in Lagos ────────────────────────────────
// Lagos has no daylight saving: it is UTC+1 all year, so the offset is fixed.

const LAGOS_OFFSET_MS = 60 * 60 * 1000
const DAY = 86_400_000

/** Today's date in Lagos, as YYYY-MM-DD. */
export function lagosToday(now = new Date()): string {
  return new Date(now.getTime() + LAGOS_OFFSET_MS).toISOString().slice(0, 10)
}

export function addDays(isoDate: string, days: number): string {
  return new Date(Date.parse(isoDate + 'T00:00:00Z') + days * DAY).toISOString().slice(0, 10)
}

/** The Monday of the week containing this date. */
export function mondayOf(isoDate: string): string {
  const dow = new Date(isoDate + 'T00:00:00Z').getUTCDay() // 0 = Sunday
  return addDays(isoDate, dow === 0 ? -6 : 1 - dow)
}

/** The week the brief is about: last Monday to last Sunday, seen from now. */
export function lastWeek(now = new Date()): { start: string; end: string } {
  const start = addDays(mondayOf(lagosToday(now)), -7)
  return { start, end: addDays(start, 6) }
}

/** The hour it is in Lagos, and whether it is Monday there. */
export function lagosClock(now = new Date()): { hour: number; isMonday: boolean } {
  const l = new Date(now.getTime() + LAGOS_OFFSET_MS)
  return { hour: l.getUTCHours(), isMonday: l.getUTCDay() === 1 }
}

/** "27 Oct to 2 Nov" */
export function weekLabel(start: string): string {
  const fmt = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return `${fmt(start)} to ${fmt(addDays(start, 6))}`
}

export const BRIEF_HOURS = [5, 6, 7, 8, 9, 10, 11, 12] as const

export function hourLabel(h: number): string {
  return h === 12 ? '12 noon' : h < 12 ? `${h}am` : `${h - 12}pm`
}

export const MOMENT_KINDS = {
  launch:       'Launch',
  price_change: 'Price change',
  promo:        'Promo or offer',
  pr:           'PR moment',
  outage:       'Outage or incident',
  other:        'Something else',
} as const
export type MomentKind = keyof typeof MOMENT_KINDS
