import { Resend } from 'resend'
import type { CreateEmailOptions } from 'resend'

/**
 * Every email in the product goes out through here.
 *
 * The reason this module exists: the Resend SDK does not throw when the API
 * refuses a message. `emails.send()` resolves with `{ data: null, error }`, so
 * `await send(...)` inside a try/catch looks like it worked and the catch block
 * never runs. Twelve call sites were written that way, which is how an
 * invitation could report itself as sent while Resend had rejected it for an
 * unverified sending domain.
 *
 * So `sendMail` never throws and never lies. It answers whether the message
 * was accepted, and when it was not it answers why in words a person can act
 * on. Callers that face a human show the reason; background jobs log it.
 */

export type MailResult =
  | { sent: true; id: string | null }
  | { sent: false; reason: string; configured: boolean }

let client: Resend | null = null
const mailer = () => (client ??= new Resend(process.env.RESEND_API_KEY))

/** Whether email is configured at all. Use it to choose a fallback up front. */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

/**
 * Turn Resend's error codes into something the person reading it can fix.
 * The code is kept in the text because it is what Resend's own dashboard and
 * docs use, and an unfamiliar code is more useful than a guess at its meaning.
 */
function explain(name: string | undefined, message: string): string {
  switch (name) {
    case 'missing_api_key':
    case 'invalid_api_key':
    case 'restricted_api_key':
      return 'the Resend API key is missing, wrong, or not allowed to send'
    case 'invalid_from_address':
      return 'Resend rejected the sending address. The domain is probably not verified yet'
    case 'validation_error':
      return `Resend rejected the message: ${message}`
    case 'daily_quota_exceeded':
    case 'monthly_quota_exceeded':
      return 'the Resend sending quota is used up'
    case 'rate_limit_exceeded':
      return 'Resend is rate limiting us. Try again in a moment'
    default:
      return message || 'Resend refused the message and gave no reason'
  }
}

export async function sendMail(payload: CreateEmailOptions): Promise<MailResult> {
  if (!emailConfigured()) {
    return { sent: false, configured: false, reason: 'no RESEND_API_KEY is set, so no email can go out' }
  }

  try {
    const { data, error } = await mailer().emails.send(payload)
    if (error) {
      const reason = explain(error.name, error.message)
      console.error('[email] refused', { to: payload.to, subject: payload.subject, code: error.name, message: error.message })
      return { sent: false, configured: true, reason }
    }
    return { sent: true, id: data?.id ?? null }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'the request to Resend failed'
    console.error('[email] threw', { to: payload.to, subject: payload.subject, reason })
    return { sent: false, configured: true, reason }
  }
}
