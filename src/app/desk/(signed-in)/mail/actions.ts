'use server'

import { revalidatePath } from 'next/cache'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaffOrNull, writeAudit } from '@/lib/desk/auth'
import { myMailboxAddresses } from '@/lib/desk/mail'
import { emailReply } from '@/lib/support/customer-email'
import { sendMail, emailConfigured } from '@/lib/email/send'
import { findModelNames } from '@/lib/support/assistant/guard'

export type MailActionState = { error?: string; ok?: boolean; warning?: string } | null

const replySchema = z.object({
  conversation_id: z.string().uuid(),
  body:            z.string().trim().min(1, 'Type a reply').max(8000),
})

/**
 * Answering someone who replied to a cold-outreach email.
 *
 * The ownership check is the whole of the security model here: the
 * conversation is loaded scoped to the caller's own staff_mailboxes rows, so
 * a conversation_id for someone else's mailbox simply does not come back,
 * the same shape as every other service-client read in the Desk that takes
 * an id from a form.
 */
export async function replyMail(_prev: MailActionState, formData: FormData): Promise<MailActionState> {
  const session = await requireStaffOrNull('mail.use')
  if (!session) return { error: 'You do not have permission to use this.' }

  const parsed = replySchema.safeParse({
    conversation_id: formData.get('conversation_id'),
    body:            formData.get('body'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const named = findModelNames(parsed.data.body)
  if (named.length) {
    return { error: `Don't name an AI model or company (${named.join(', ')}). Say "BrandGauge's AI model" instead.` }
  }

  const addresses = await myMailboxAddresses(session)
  const service = await createServiceClient()
  const { data: conv } = await service
    .from('support_conversations')
    .select('id, email, name, subject, inbound_address, source, last_message_at')
    .eq('id', parsed.data.conversation_id)
    .in('inbound_address', addresses)
    .maybeSingle()
  if (!conv) return { error: 'That conversation no longer exists.' }

  const { error } = await service.from('support_messages').insert({
    conversation_id: conv.id, author_type: 'staff', author_id: session.userId, body: parsed.data.body,
  })
  if (error) return { error: 'Could not post that reply.' }

  await writeAudit({
    actorId: session.userId, action: 'mail.reply',
    targetType: 'conversation', targetId: conv.id, summary: 'Replied from a personal mailbox',
  })

  const mail = await emailReply(conv, parsed.data.body, session.fullName)
  revalidatePath(`/desk/mail/${conv.id}`)
  revalidatePath('/desk/mail')
  if (mail && !mail.sent) return { ok: true, warning: 'Your reply is in the thread, but the email did not go out.' }
  return { ok: true }
}

const composeSchema = z.object({
  from_address: z.string().email(),
  to:           z.string().email('Enter a valid email address'),
  subject:      z.string().trim().min(1, 'Give it a subject').max(200),
  body:         z.string().trim().min(1, 'Write something first').max(8000),
})

/**
 * Starting a conversation, rather than answering one — the one thing a
 * personal mailbox needs that the support inbox never did, because support
 * never speaks first.
 */
export async function composeMail(_prev: MailActionState, formData: FormData): Promise<MailActionState> {
  const session = await requireStaffOrNull('mail.use')
  if (!session) return { error: 'You do not have permission to use this.' }

  const parsed = composeSchema.safeParse({
    from_address: formData.get('from_address'),
    to:           formData.get('to'),
    subject:      formData.get('subject'),
    body:         formData.get('body'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const named = findModelNames(parsed.data.body)
  if (named.length) {
    return { error: `Don't name an AI model or company (${named.join(', ')}). Say "BrandGauge's AI model" instead.` }
  }

  const addresses = await myMailboxAddresses(session)
  if (!addresses.includes(parsed.data.from_address.toLowerCase())) {
    return { error: 'That is not one of your mailboxes.' }
  }

  const service = await createServiceClient()
  const { data: conv, error: createErr } = await service
    .from('support_conversations')
    .insert({
      visitor_token:   randomBytes(24).toString('base64url'),
      email:           parsed.data.to.toLowerCase(),
      subject:         parsed.data.subject,
      source:          'email',
      inbound_address: parsed.data.from_address.toLowerCase(),
    })
    .select('id').single()
  if (createErr || !conv) return { error: 'Could not start that conversation.' }

  const { error: msgErr } = await service.from('support_messages').insert({
    conversation_id: conv.id, author_type: 'staff', author_id: session.userId, body: parsed.data.body,
  })
  if (msgErr) return { error: 'Could not post that message.' }

  await writeAudit({
    actorId: session.userId, action: 'mail.compose',
    targetType: 'conversation', targetId: conv.id, summary: `Started a conversation with ${parsed.data.to}`,
  })

  let warning: string | undefined
  if (emailConfigured()) {
    const sent = await sendMail({
      from:    `${session.fullName} <${parsed.data.from_address}>`,
      to:      parsed.data.to,
      subject: parsed.data.subject,
      replyTo: parsed.data.from_address,
      text:    parsed.data.body,
    })
    if (!sent.sent) warning = 'Saved, but the email did not go out.'
  } else {
    warning = 'Saved, but email is not configured, so nothing was sent.'
  }

  revalidatePath('/desk/mail')
  return warning ? { ok: true, warning } : { ok: true }
}
