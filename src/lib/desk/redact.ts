/**
 * Redaction, where a screen is not allowed the real value.
 *
 * Pure and dependency-free so the data layer, a component and the offline
 * check can all use the same function. A masked value is deliberately still
 * recognisable as an address: a support agent needs to be able to say "the one
 * ending brandgauge.app" without being handed the whole thing.
 */

export const MASKED = '•••'

export function maskEmail(email: string | null | undefined): string {
  if (!email) return ''
  const [local, domain] = email.split('@')
  if (!domain) return MASKED
  return `${local.slice(0, 1)}${MASKED}@${domain}`
}
