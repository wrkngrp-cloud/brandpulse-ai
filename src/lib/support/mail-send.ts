import { sendMail, emailConfigured, type MailResult } from '@/lib/email/send'
import { createServiceClient } from '@/lib/supabase/server'
import type { AttachmentRef } from './attachments'

/**
 * Sending from a personal @brandgauge.app mailbox.
 *
 * Deliberately separate from emailReply() in customer-email.ts rather than a
 * shared path with branches: a support reply is BrandGauge answering a
 * ticket with a canned sign-off, gated on the customer having gone quiet. A
 * personal mailbox is a person's own words, sent the moment they press send,
 * with no template wrapped around them — closer to composing in Gmail than
 * to a support macro.
 *
 * Every send here is scheduled a few seconds out rather than fired
 * immediately, which is the only thing that makes Undo Send real rather
 * than cosmetic: Resend has nothing to pull back once a message is actually
 * dispatched. UNDO_WINDOW_MS is shorter than SEND_DELAY_SECONDS on purpose —
 * the gap is the margin for a click-to-server round trip and Resend's own
 * cancel call to land before Resend's scheduled dispatch fires regardless.
 */
export const SEND_DELAY_SECONDS = 16
export const UNDO_WINDOW_MS = 12_000

/** A verified attachment ref, turned into Resend's own shape: a signed URL it
 *  fetches itself, so this route never reads the file bytes into memory. */
async function toResendAttachments(refs: AttachmentRef[]) {
  const service = await createServiceClient()
  const resolved = await Promise.all(refs.map(async ref => {
    const { data } = await service.storage.from('support-attachments').createSignedUrl(ref.path, 300)
    return data?.signedUrl ? { path: data.signedUrl, filename: ref.name } : null
  }))
  return resolved.filter((a): a is { path: string; filename: string } => a !== null)
}

export async function sendPersonalMail(opts: {
  from: string
  to: string
  subject: string
  body: string
  cc?: string[]
  bcc?: string[]
  inReplyTo?: string
  attachments?: AttachmentRef[]
}): Promise<MailResult> {
  if (!emailConfigured()) return { sent: false, configured: false, reason: 'no RESEND_API_KEY is set, so no email can go out' }

  return sendMail({
    from:    opts.from,
    to:      opts.to,
    ...(opts.cc?.length  ? { cc:  opts.cc }  : {}),
    ...(opts.bcc?.length ? { bcc: opts.bcc } : {}),
    subject: opts.subject,
    replyTo: opts.from,
    ...(opts.inReplyTo ? { headers: { 'In-Reply-To': opts.inReplyTo, References: opts.inReplyTo } } : {}),
    text: opts.body,
    ...(opts.attachments?.length ? { attachments: await toResendAttachments(opts.attachments) } : {}),
    scheduledAt: `in ${SEND_DELAY_SECONDS} seconds`,
  })
}
