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

export type CancelResult =
  | { cancelled: true }
  | { cancelled: false; reason: string }

/**
 * Pulling back a message sent with a future `scheduledAt`, before Resend
 * actually dispatches it. Refuses cleanly rather than throwing once that
 * moment has passed — the caller reads `cancelled: false` as "it already
 * went out," not as a crash.
 */
export async function cancelMail(resendId: string): Promise<CancelResult> {
  if (!emailConfigured()) return { cancelled: false, reason: 'email is not configured' }
  try {
    const { error } = await mailer().emails.cancel(resendId)
    if (error) return { cancelled: false, reason: explain(error.name, error.message) }
    return { cancelled: true }
  } catch (err) {
    return { cancelled: false, reason: err instanceof Error ? err.message : 'the request to Resend failed' }
  }
}

export type BulkResult =
  | { sent: number; failed: 0 }
  | { sent: number; failed: number; reason: string; configured: boolean }

/**
 * One message, sent separately to each person on a list.
 *
 * Never put a list of outside recipients in one `to`. Every address in that
 * header is shown to every recipient, so a survey invitation to 50 customers
 * handed each of them the other 49 addresses. That is a data exposure under
 * the NDPR, and it shipped in both survey senders. This sends one email per
 * address through Resend's batch endpoint, up to 100 per call, so nobody sees
 * anybody else.
 *
 * It stops at the first refused chunk and reports how many went out before
 * it, so a caller can say "40 of 120 sent" rather than "sent" or "failed".
 */
export async function sendEach(
  base: Omit<CreateEmailOptions, 'to' | 'cc' | 'bcc' | 'attachments' | 'scheduledAt'>,
  recipients: string[],
): Promise<BulkResult> {
  const to = [...new Set(recipients.map(r => r.trim().toLowerCase()).filter(Boolean))]
  if (!to.length) return { sent: 0, failed: 0 }
  if (!emailConfigured()) {
    return { sent: 0, failed: to.length, configured: false, reason: 'no RESEND_API_KEY is set, so no email can go out' }
  }

  let sent = 0
  for (let i = 0; i < to.length; i += 100) {
    const chunk = to.slice(i, i + 100)
    try {
      const { error } = await mailer().batch.send(chunk.map(address => ({ ...base, to: address } as CreateEmailOptions)))
      if (error) {
        console.error('[email] batch refused', { subject: base.subject, count: chunk.length, code: error.name, message: error.message })
        return { sent, failed: to.length - sent, configured: true, reason: explain(error.name, error.message) }
      }
      sent += chunk.length
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'the request to Resend failed'
      console.error('[email] batch threw', { subject: base.subject, count: chunk.length, reason })
      return { sent, failed: to.length - sent, configured: true, reason }
    }
  }
  return { sent, failed: 0 }
}
