import { workingMsBetween } from './assistant/config'

/**
 * The team's reply targets: maximums, counted in working time only (Monday to
 * Friday, 09:00 to 17:00 Lagos). Confirmed by the owner on 9 Nov 2026.
 *
 * Internal. Never quoted to a customer: in the chat the promise stays "within
 * 4 working hours". The assistant's job uses these to decide when a handed-off
 * case is overdue and staff are notified again, and the Desk inbox uses them
 * to mark the row.
 */
export const REPLY_TARGET_MINUTES = {
  urgent: 15,
  high:   60,
  normal: 90,
  /** One working day. */
  low:    8 * 60,
} as const

export type TargetPriority = keyof typeof REPLY_TARGET_MINUTES

export function targetMinutes(priority: string | null | undefined): number {
  return REPLY_TARGET_MINUTES[(priority ?? 'normal') as TargetPriority] ?? REPLY_TARGET_MINUTES.normal
}

/** Working minutes a case has waited since it was handed to the team. */
export function waitedWorkingMinutes(since: string | Date, now: Date = new Date()): number {
  return Math.floor(workingMsBetween(new Date(since), now) / 60_000)
}

export function isOverdue(priority: string | null | undefined, since: string | Date | null, now: Date = new Date()): boolean {
  if (!since) return false
  return waitedWorkingMinutes(since, now) > targetMinutes(priority)
}
