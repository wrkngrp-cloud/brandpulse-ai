/**
 * A `?next=` destination we are willing to follow.
 *
 * The free tools hand a report token through sign-up as a `next` path, so this
 * parameter now survives a round trip through auth. That makes it an open
 * redirect unless it is checked: anything with a scheme, a protocol-relative
 * `//host` or a backslash is refused, and what is left is a path on this site.
 */
export function safeNext(value: unknown, fallback = '/dashboard'): string {
  if (typeof value !== 'string') return fallback
  const next = value.trim()
  if (!next.startsWith('/')) return fallback
  if (next.startsWith('//') || next.startsWith('/\\')) return fallback
  if (next.includes('\\')) return fallback
  return next
}
