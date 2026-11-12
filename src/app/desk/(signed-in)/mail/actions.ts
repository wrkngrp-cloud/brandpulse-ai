'use server'

import { revalidatePath } from 'next/cache'
import { randomBytes, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaffOrNull, writeAudit } from '@/lib/desk/auth'
import { myMailboxAddresses } from '@/lib/desk/mail'
import { lastInboundRfcMessageId } from '@/lib/support/customer-email'
import { sendPersonalMail, UNDO_WINDOW_MS } from '@/lib/support/mail-send'
import { cancelMail } from '@/lib/email/send'
import { findModelNames } from '@/lib/support/assistant/guard'
import { verifyMailAttachment, signMailAttachment, type AttachmentRef } from '@/lib/support/attachments'
import { withinLimit } from '@/lib/support/limits'

export type MailActionState = {
  error?: string
  ok?: boolean
  warning?: string
  /** Set only when the send is still pending at Resend and so can still be
   *  pulled back — the signal the UI uses to show the Undo button at all. */
  messageId?: string
  cancellableUntil?: number
} | null

/** Comma- or newline-separated addresses, each checked. A typo here silently
 *  dropping the address would mean a BCC'd person never knowing they were
 *  meant to be on the thread, so a bad one fails the whole send rather than
 *  being swallowed. */
const EMAIL_LIST_MAX = 25
function parseAddressList(raw: FormDataEntryValue | null): string[] | { error: string } {
  const text = typeof raw === 'string' ? raw.trim() : ''
  if (!text) return []
  const parts = [...new Set(text.split(/[,\n]/).map(s => s.trim()).filter(Boolean))]
  if (parts.length > EMAIL_LIST_MAX) return { error: `That's more than ${EMAIL_LIST_MAX} addresses in one field.` }
  const bad = parts.find(p => !z.string().email().safeParse(p).success)
  if (bad) return { error: `"${bad}" isn't a valid email address.` }
  return parts.map(p => p.toLowerCase())
}

const AttachmentField = z.array(z.object({
  path: z.string(), name: z.string(), type: z.string(), size: z.number(), signature: z.string(),
})).max(10)

/** Verified, signed attachment refs off a form field — never trusted
 *  otherwise, same posture as the chat widget's own attachments. An
 *  attachment that fails to verify is dropped, not an error: losing one file
 *  is better than losing the whole message over it. */
function parseAttachments(userId: string, raw: FormDataEntryValue | null): AttachmentRef[] {
  if (typeof raw !== 'string' || !raw) return []
  let items: z.infer<typeof AttachmentField>
  try {
    items = AttachmentField.parse(JSON.parse(raw))
  } catch {
    return []
  }
  return items
    .filter(a => verifyMailAttachment(userId, a, a.signature))
    .map(({ path, name, type, size }) => ({ path, name, type, size }))
}

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

  const cc = parseAddressList(formData.get('cc'))
  if ('error' in cc) return { error: `CC: ${cc.error}` }
  const bcc = parseAddressList(formData.get('bcc'))
  if ('error' in bcc) return { error: `BCC: ${bcc.error}` }

  const named = findModelNames(parsed.data.body)
  if (named.length) {
    return { error: `Don't name an AI model or company (${named.join(', ')}). Say "BrandGauge's AI model" instead.` }
  }

  const addresses = await myMailboxAddresses(session)
  const service = await createServiceClient()
  const { data: conv } = await service
    .from('support_conversations')
    .select('id, email, name, subject, inbound_address')
    .eq('id', parsed.data.conversation_id)
    .in('inbound_address', addresses)
    .maybeSingle()
  if (!conv || !conv.email) return { error: 'That conversation no longer exists.' }

  const attachments = parseAttachments(session.userId, formData.get('attachments'))

  const { data: posted, error } = await service.from('support_messages').insert({
    conversation_id: conv.id, author_type: 'staff', author_id: session.userId,
    body: parsed.data.body, cc, bcc, attachments,
  }).select('id').single()
  if (error || !posted) return { error: 'Could not post that reply.' }

  await writeAudit({
    actorId: session.userId, action: 'mail.reply',
    targetType: 'conversation', targetId: conv.id, summary: 'Replied from a personal mailbox',
  })

  const mail = await sendPersonalMail({
    from: `${session.fullName} <${conv.inbound_address!}>`, to: conv.email,
    subject: conv.subject ? `Re: ${conv.subject}` : 'Re:',
    body: parsed.data.body, cc, bcc, attachments,
    inReplyTo: await lastInboundRfcMessageId(conv.id),
  })

  // The id Resend handed back is what cancelMail needs later. Nothing to
  // record if the send itself failed outright — there is nothing pending to
  // pull back.
  if (mail.sent && mail.id) {
    await service.from('support_messages').update({ resend_message_id: mail.id }).eq('id', posted.id)
  }

  // Sent — the draft this was answering, if any, is spent.
  await service.from('mail_drafts').delete().eq('user_id', session.userId).eq('conversation_id', conv.id)

  revalidatePath(`/desk/mail/${conv.id}`)
  revalidatePath('/desk/mail')
  revalidatePath('/desk/mail/drafts')
  if (!mail.sent) return { ok: true, warning: 'Your reply is in the thread, but the email did not go out.' }
  if (!mail.id) {
    console.error('[mail] reply sent with no Resend id back — cannot offer Undo', { conversationId: conv.id })
    return { ok: true, warning: 'Sent — Undo is not available for this message.' }
  }
  return { ok: true, messageId: posted.id, cancellableUntil: Date.now() + UNDO_WINDOW_MS }
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

  const cc = parseAddressList(formData.get('cc'))
  if ('error' in cc) return { error: `CC: ${cc.error}` }
  const bcc = parseAddressList(formData.get('bcc'))
  if ('error' in bcc) return { error: `BCC: ${bcc.error}` }

  const named = findModelNames(parsed.data.body)
  if (named.length) {
    return { error: `Don't name an AI model or company (${named.join(', ')}). Say "BrandGauge's AI model" instead.` }
  }

  const addresses = await myMailboxAddresses(session)
  const fromAddress = parsed.data.from_address.toLowerCase()
  if (!addresses.includes(fromAddress)) return { error: 'That is not one of your mailboxes.' }

  const attachments = parseAttachments(session.userId, formData.get('attachments'))

  const service = await createServiceClient()
  const { data: conv, error: createErr } = await service
    .from('support_conversations')
    .insert({
      visitor_token:   randomBytes(24).toString('base64url'),
      email:           parsed.data.to.toLowerCase(),
      subject:         parsed.data.subject,
      source:          'email',
      inbound_address: fromAddress,
    })
    .select('id').single()
  if (createErr || !conv) return { error: 'Could not start that conversation.' }

  const { data: posted, error: msgErr } = await service.from('support_messages').insert({
    conversation_id: conv.id, author_type: 'staff', author_id: session.userId,
    body: parsed.data.body, cc, bcc, attachments,
  }).select('id').single()
  if (msgErr || !posted) return { error: 'Could not post that message.' }

  await writeAudit({
    actorId: session.userId, action: 'mail.compose',
    targetType: 'conversation', targetId: conv.id, summary: `Started a conversation with ${parsed.data.to}`,
  })

  const mail = await sendPersonalMail({
    from: `${session.fullName} <${fromAddress}>`, to: parsed.data.to, subject: parsed.data.subject,
    body: parsed.data.body, cc, bcc, attachments,
  })

  if (mail.sent && mail.id) {
    await service.from('support_messages').update({ resend_message_id: mail.id }).eq('id', posted.id)
  }

  const draftId = formData.get('draft_id')
  if (typeof draftId === 'string' && draftId) {
    await service.from('mail_drafts').delete().eq('user_id', session.userId).eq('id', draftId)
  }

  revalidatePath('/desk/mail')
  revalidatePath('/desk/mail/drafts')
  if (!mail.sent) return { ok: true, warning: 'Saved, but the email did not go out.' }
  if (!mail.id) {
    console.error('[mail] compose sent with no Resend id back — cannot offer Undo', { conversationId: conv.id })
    return { ok: true, warning: 'Sent — Undo is not available for this message.' }
  }
  return { ok: true, messageId: posted.id, cancellableUntil: Date.now() + UNDO_WINDOW_MS }
}

/**
 * Pulling a message back before Resend actually sends it (Undo Send).
 *
 * The ownership checks are two separate queries on purpose rather than one
 * join: the message must be the caller's own staff message, and its
 * conversation must be on one of the caller's own mailbox addresses, which
 * together rule out both "someone else's reply" and "a message on a
 * mailbox I don't own," the same two directions every other ownership
 * check in the Desk guards against.
 *
 * Deletes the message once Resend confirms the cancel — not before, so a
 * failed cancel (already sent, or the window passed) never destroys the
 * record of something that really did go out. If that leaves the
 * conversation with no messages at all, it was a fresh compose nobody ever
 * saw, and the conversation is deleted with it rather than left as an empty
 * husk in Sent.
 */
export async function cancelSentMail(
  messageId: string,
): Promise<{ ok?: boolean; conversationDeleted?: boolean; error?: string }> {
  const session = await requireStaffOrNull('mail.use')
  if (!session) return { error: 'You do not have permission to use this.' }

  const service = await createServiceClient()
  const { data: msg } = await service
    .from('support_messages')
    .select('id, conversation_id, created_at, resend_message_id')
    .eq('id', messageId)
    .eq('author_type', 'staff')
    .eq('author_id', session.userId)
    .maybeSingle()
  if (!msg) return { error: 'That message no longer exists.' }

  const addresses = await myMailboxAddresses(session)
  const { data: conv } = await service
    .from('support_conversations')
    .select('id')
    .eq('id', msg.conversation_id)
    .in('inbound_address', addresses)
    .maybeSingle()
  if (!conv) return { error: 'That message no longer exists.' }

  if (!msg.resend_message_id) return { error: 'There is nothing to undo on that message.' }
  if (Date.now() - new Date(msg.created_at).getTime() > UNDO_WINDOW_MS) {
    return { error: 'Too late — it already went out.' }
  }

  const result = await cancelMail(msg.resend_message_id)
  if (!result.cancelled) return { error: `Too late — ${result.reason}` }

  await service.from('support_messages').delete().eq('id', msg.id)

  const { count } = await service
    .from('support_messages').select('id', { count: 'exact', head: true }).eq('conversation_id', conv.id)
  const conversationDeleted = (count ?? 0) === 0
  if (conversationDeleted) {
    await service.from('support_conversations').delete().eq('id', conv.id)
  }

  await writeAudit({
    actorId: session.userId, action: 'mail.cancel',
    targetType: 'conversation', targetId: conv.id, summary: 'Undid a send from a personal mailbox',
  })

  revalidatePath(`/desk/mail/${conv.id}`)
  revalidatePath('/desk/mail')
  revalidatePath('/desk/mail/sent')
  return { ok: true, conversationDeleted }
}

/**
 * One upload, called directly from a client component rather than wrapped in
 * a <form> — the attachment picker needs the signed reference back
 * immediately, before Send is pressed, so it can show a chip and let the
 * person remove it.
 *
 * A Server Action rather than a route, because the Desk has no API routes
 * (CLAUDE.md): on desk.brandgauge.app, src/proxy.ts rewrites every path onto
 * /desk, including a plain API fetch issued from a page rendered inside the
 * Desk, and no /desk/api/** route exists to receive it — that attempt 404s.
 * A Server Action's request goes through Next's own RSC action dispatch
 * instead, which the proxy never intercepts. Its default 1MB body cap (large
 * enough for a chat message, not for a phone photo) is raised in
 * next.config.ts (experimental.serverActions.bodySizeLimit) rather than
 * worked around here.
 */
const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'])

export async function uploadMailAttachment(
  formData: FormData,
): Promise<{ path: string; name: string; type: string; size: number; signature: string } | { error: string }> {
  const session = await requireStaffOrNull('mail.use')
  if (!session) return { error: 'You do not have permission to use this.' }

  const file = formData.get('file')
  if (!(file instanceof File)) return { error: 'No file received.' }

  if (!await withinLimit(`mail:upload:${session.userId}`, 30, 600)) {
    return { error: 'Too many uploads. Try again shortly.' }
  }
  if (file.size > MAX_BYTES) return { error: 'That file is over 10MB.' }
  if (!ALLOWED_TYPES.has(file.type)) return { error: 'Images and PDFs only.' }

  const displayName = (file.name || 'attachment').slice(0, 120)
  const extension = displayName.includes('.') ? displayName.split('.').pop()!.slice(0, 8) : 'bin'
  const path = `mail/${session.userId}/${randomUUID()}.${extension.replace(/[^a-zA-Z0-9]/g, '')}`

  const service = await createServiceClient()
  const { error } = await service.storage
    .from('support-attachments')
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false })
  if (error) return { error: 'Could not upload that file.' }

  const ref = { path, name: displayName, type: file.type, size: file.size }
  return { ...ref, signature: signMailAttachment(session.userId, ref) }
}

const saveDraftSchema = z.object({
  draft_id:        z.string().uuid().optional(),
  conversation_id: z.string().uuid().optional(),
  from_address:    z.string().email(),
  to:              z.string().email().optional().or(z.literal('')),
  subject:         z.string().max(200).optional(),
  body:            z.string().max(8000),
})

/** One in-progress message a person isn't ready to send. A reply draft
 *  upserts on (user_id, conversation_id); a fresh compose keeps getting a new
 *  row until the first save hands back an id for the client to reuse —
 *  see saveDraft's return. */
export async function saveDraft(formData: FormData): Promise<{ draftId?: string; error?: string }> {
  const session = await requireStaffOrNull('mail.use')
  if (!session) return { error: 'You do not have permission to use this.' }

  const parsed = saveDraftSchema.safeParse({
    draft_id:        formData.get('draft_id') || undefined,
    conversation_id: formData.get('conversation_id') || undefined,
    from_address:    formData.get('from_address'),
    to:              formData.get('to') ?? '',
    subject:         formData.get('subject') ?? '',
    body:            formData.get('body') ?? '',
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const cc = parseAddressList(formData.get('cc'))
  const bcc = parseAddressList(formData.get('bcc'))
  const attachments = parseAttachments(session.userId, formData.get('attachments'))

  const row = {
    user_id:         session.userId,
    conversation_id: parsed.data.conversation_id ?? null,
    from_address:    parsed.data.from_address.toLowerCase(),
    to_address:      parsed.data.to ? parsed.data.to.toLowerCase() : null,
    cc: 'error' in cc ? [] : cc,
    bcc: 'error' in bcc ? [] : bcc,
    subject: parsed.data.subject || null,
    body: parsed.data.body,
    attachments,
    updated_at: new Date().toISOString(),
  }

  const service = await createServiceClient()

  if (parsed.data.conversation_id) {
    const { data, error } = await service
      .from('mail_drafts')
      .upsert(row, { onConflict: 'user_id,conversation_id' })
      .select('id').single()
    if (error || !data) return { error: 'Could not save the draft.' }
    revalidatePath('/desk/mail/drafts')
    return { draftId: data.id }
  }

  if (parsed.data.draft_id) {
    const { error } = await service.from('mail_drafts').update(row)
      .eq('id', parsed.data.draft_id).eq('user_id', session.userId)
    if (error) return { error: 'Could not save the draft.' }
    revalidatePath('/desk/mail/drafts')
    return { draftId: parsed.data.draft_id }
  }

  const { data, error } = await service.from('mail_drafts').insert(row).select('id').single()
  if (error || !data) return { error: 'Could not save the draft.' }
  revalidatePath('/desk/mail/drafts')
  return { draftId: data.id }
}

export async function deleteDraft(formData: FormData): Promise<void> {
  const session = await requireStaffOrNull('mail.use')
  if (!session) return
  const id = String(formData.get('draft_id') ?? '')
  if (!id) return

  const service = await createServiceClient()
  await service.from('mail_drafts').delete().eq('id', id).eq('user_id', session.userId)
  revalidatePath('/desk/mail/drafts')
}
