import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Invitation tokens.
 *
 * The token goes out in the email and only its hash is stored, so the table
 * holds nothing that could be replayed if it leaked. These are plain helpers
 * rather than server actions, because a 'use server' module may export async
 * functions only and these have no business being callable from a browser.
 */

export const INVITE_TTL_HOURS = 72

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function newInviteToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashInviteToken(token) }
}

/** Constant-time compare, so a near-miss token cannot be found by timing. */
export function tokenHashMatches(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export function inviteExpiry(): string {
  return new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000).toISOString()
}
