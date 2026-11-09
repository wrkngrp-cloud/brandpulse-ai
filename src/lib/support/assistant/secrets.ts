/**
 * Does a customer message hold something nobody should paste into a chat?
 *
 * Deliberately eager. A false positive costs one urgent handoff and a person
 * glancing at a message; a false negative leaves a live key in a support
 * thread. The match is never echoed back: callers get a boolean and the kinds.
 */

export type SecretKind = 'api_key' | 'token' | 'password' | 'card'

const PATTERNS: { kind: SecretKind; re: RegExp }[] = [
  // Paystack, Stripe-style and generic live/test secret keys.
  { kind: 'api_key', re: /\b(sk|pk|rk)_(live|test)_[A-Za-z0-9]{8,}/ },
  // Flutterwave.
  { kind: 'api_key', re: /\bFLW(SECK|PUBK)(_TEST)?-[A-Za-z0-9-]{10,}/i },
  // Mailchimp keys end in a datacentre suffix.
  { kind: 'api_key', re: /\b[a-f0-9]{32}-us\d{1,2}\b/i },
  // Brevo.
  { kind: 'api_key', re: /\bxkeysib-[A-Za-z0-9-]{20,}/i },
  // Google, AWS, GitHub, Slack.
  { kind: 'api_key', re: /\bAIza[0-9A-Za-z_-]{30,}/ },
  { kind: 'api_key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { kind: 'token',   re: /\bgh[pousr]_[A-Za-z0-9]{30,}/ },
  { kind: 'token',   re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/ },
  // Meta access tokens.
  { kind: 'token',   re: /\bEAA[A-Za-z0-9]{40,}/ },
  // A JWT.
  { kind: 'token',   re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/ },
  // "Bearer xxxxx" or a labelled secret.
  { kind: 'token',   re: /\bbearer\s+[A-Za-z0-9._-]{20,}/i },
  { kind: 'api_key', re: /\b(api[\s_-]?key|secret([\s_-]?key)?|webhook[\s_-]?(secret|hash)|access[\s_-]?token|client[\s_-]?secret)\b\s*(is|=|:)?\s*["']?[A-Za-z0-9._\-+/=]{12,}/i },
  { kind: 'password', re: /\b(password|passcode|pwd|pass)\b\s*(is|=|:)\s*["']?\S{4,}/i },
  { kind: 'password', re: /\bmy\s+(password|passcode)\s+(is|was)\s+\S{4,}/i },
]

function luhnValid(digits: string): boolean {
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48
    if (double) { d *= 2; if (d > 9) d -= 9 }
    sum += d
    double = !double
  }
  return sum % 10 === 0
}

function hasCard(text: string): boolean {
  // 13 to 19 digits, optionally grouped by spaces or dashes.
  const candidates = text.match(/\b(?:\d[ -]?){12,18}\d\b/g) ?? []
  return candidates.some(c => {
    const digits = c.replace(/[ -]/g, '')
    return digits.length >= 13 && digits.length <= 19 && !/^(\d)\1+$/.test(digits) && luhnValid(digits)
  })
}

export function findSecrets(text: string): SecretKind[] {
  const kinds = new Set<SecretKind>()
  for (const { kind, re } of PATTERNS) if (re.test(text)) kinds.add(kind)
  if (hasCard(text)) kinds.add('card')
  return [...kinds]
}

export function containsSecret(text: string): boolean {
  return findSecrets(text).length > 0
}
