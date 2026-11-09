/**
 * The support assistant's fixed settings.
 *
 * Nothing here reads a request, a cookie or the database, so the eval script
 * can import it without a Next runtime.
 */

export type AssistantMode = 'off' | 'suggest' | 'live'

/**
 * SUPPORT_ASSISTANT_MODE, server side only. Unset or anything unrecognised is
 * 'off', which is the kill switch: the job reads this on every run, so setting
 * it to off stops new replies from the next event.
 */
export function assistantMode(): AssistantMode {
  const raw = (process.env.SUPPORT_ASSISTANT_MODE ?? '').trim().toLowerCase()
  return raw === 'suggest' || raw === 'live' ? raw : 'off'
}

/** One per thread, picked on the first reply and never changed. Never a staff row. */
export const PERSONAS = ['Bode', 'Biodun', 'Boma', 'Hauwa', 'Ifeoma', 'Sade'] as const
export type Persona = (typeof PERSONAS)[number]

export function pickPersona(random: () => number = Math.random): Persona {
  return PERSONAS[Math.floor(random() * PERSONAS.length) % PERSONAS.length]
}

export function isPersona(value: unknown): value is Persona {
  return typeof value === 'string' && (PERSONAS as readonly string[]).includes(value)
}

/** How the chat shows the assistant to a customer. */
export function personaDisplayName(persona: string | null | undefined): string {
  return isPersona(persona) ? `${persona} from BrandGauge` : 'BrandGauge'
}

export const LIMITS = {
  /** Assistant replies on one thread before an automatic handoff. */
  maxRepliesPerThread: 6,
  /** Replies the customer says did not help before an automatic handoff. */
  maxUnhelpful: 2,
  /** callAi calls per conversation per Lagos day. */
  maxCallsPerDay: 20,
  /** A person posted this recently, so the assistant stays out. */
  staffQuietMs: 30 * 60 * 1000,
  /** A burst of customer messages gets one reply. */
  debounce: '8s',
  /** SIL-01 goes out once, after this much silence following a step. */
  silenceMs: 10 * 60 * 1000,
  /** The PND-03 chase threshold. */
  chaseWorkingHours: 4,
  /** "About 60 words" unless the customer asked for the full picture. */
  maxWords: 60,
} as const

/**
 * Working hours: Monday to Friday, 09:00 to 17:00 Africa/Lagos, confirmed by
 * the owner on 9 Nov 2026. Lagos is UTC+1 all year with no daylight saving,
 * so the arithmetic below is exact without a timezone library.
 */
export const WORKING_HOURS = { tz: 'Africa/Lagos', utcOffsetHours: 1, startHour: 9, endHour: 17, days: [1, 2, 3, 4, 5] } as const

function lagos(date: Date): Date {
  return new Date(date.getTime() + WORKING_HOURS.utcOffsetHours * 3_600_000)
}

export function isWorkingTime(at: Date = new Date()): boolean {
  const local = lagos(at)
  const day = local.getUTCDay()
  const hour = local.getUTCHours()
  return (WORKING_HOURS.days as readonly number[]).includes(day)
    && hour >= WORKING_HOURS.startHour && hour < WORKING_HOURS.endHour
}

/** Working milliseconds between two instants, counted in 1-minute steps' worth of exact intervals. */
export function workingMsBetween(from: Date, to: Date): number {
  if (to <= from) return 0
  let total = 0
  // Walk day by day in Lagos time, adding the overlap with each working window.
  const startLocal = lagos(from)
  const endLocal   = lagos(to)
  const cursor = new Date(Date.UTC(startLocal.getUTCFullYear(), startLocal.getUTCMonth(), startLocal.getUTCDate()))
  while (cursor <= endLocal) {
    if ((WORKING_HOURS.days as readonly number[]).includes(cursor.getUTCDay())) {
      const winStart = cursor.getTime() + WORKING_HOURS.startHour * 3_600_000
      const winEnd   = cursor.getTime() + WORKING_HOURS.endHour * 3_600_000
      const a = Math.max(winStart, startLocal.getTime())
      const b = Math.min(winEnd, endLocal.getTime())
      if (b > a) total += b - a
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return total
}

/** The Lagos calendar day, for the daily call cap. */
export function lagosDay(at: Date = new Date()): string {
  return lagos(at).toISOString().slice(0, 10)
}

export const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const
export type Priority = (typeof PRIORITIES)[number]

export function raisePriority(p: string | null | undefined): Priority {
  const i = PRIORITIES.indexOf((p ?? 'normal') as Priority)
  return PRIORITIES[Math.min(PRIORITIES.length - 1, (i < 0 ? 1 : i) + 1)]
}

export function maxPriority(a: string | null | undefined, b: string | null | undefined): Priority {
  const ia = PRIORITIES.indexOf((a ?? 'low') as Priority)
  const ib = PRIORITIES.indexOf((b ?? 'low') as Priority)
  return PRIORITIES[Math.max(ia < 0 ? 0 : ia, ib < 0 ? 0 : ib)]
}
