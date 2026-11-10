'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { sendMail, emailConfigured } from '@/lib/email/send'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaffOrNull, writeAudit } from '@/lib/desk/auth'
import { supportInbox, inboxCounts, type InboxRow, type InboxCounts, type InboxView } from '@/lib/desk/data'
import { z } from 'zod'
import { findModelNames } from '@/lib/support/assistant/guard'

export type ReplyState = { error?: string; ok?: boolean; warning?: string } | null

const replySchema = z.object({
  conversation_id: z.string().uuid(),
  body:            z.string().trim().min(1, 'Type a reply').max(8000),
  internal:        z.boolean().default(false),
})

/**
 * Answering a customer.
 *
 * The reply lands in the thread, and then it has to actually reach them. If
 * they are sitting in the widget it already has. If they are not, an email and
 * a notification are the difference between a reply and a reply nobody reads,
 * so both are sent and neither is allowed to fail the reply itself.
 *
 * An internal note takes none of that. It is a note between us on the thread,
 * and the policy keeps it off the customer's side.
 *
 * The email now does invite a reply: /api/support/inbound carries one back
 * into this same thread. Before that route existed this comment said the
 * opposite, because a reply would land in a mailbox nothing read while the
 * thread still showed as waiting on the customer.
 */
export async function replyToThread(_prev: ReplyState, formData: FormData): Promise<ReplyState> {
  const internal = formData.get('internal') === 'on'
  // An internal note is still a write onto the thread, and this path runs on
  // the service client, so the table's own policy is not the one doing the
  // checking here. Both need support.reply.
  const session = await requireStaffOrNull('support.reply')
  if (!session) return { error: 'You do not have permission to reply.' }

  const parsed = replySchema.safeParse({
    conversation_id: formData.get('conversation_id'),
    body:            formData.get('body'),
    internal,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { conversation_id, body } = parsed.data

  // Owner decision, 9 Nov 2026: no AI model or AI company is named in the
  // support chat, by the assistant or by staff, under any condition. The words
  // for it are "BrandGauge's AI model". Internal notes are between us and are
  // not checked.
  if (!parsed.data.internal) {
    const named = findModelNames(body)
    if (named.length) {
      return { error: `Replies never name an AI model or company (${named.join(', ')}). Say "BrandGauge's AI model" instead.` }
    }
  }

  const service = await createServiceClient()

  const { data: conv } = await service
    .from('support_conversations')
    .select('id, email, name, user_id, brand_id, source, last_message_at')
    .eq('id', conversation_id)
    .maybeSingle()
  if (!conv) return { error: 'That conversation no longer exists.' }

  const { error } = await service.from('support_messages').insert({
    conversation_id,
    author_type: 'staff',
    author_id:   session.userId,
    body,
    internal: parsed.data.internal,
  })
  if (error) return { error: 'Could not post that reply.' }

  await writeAudit({
    actorId: session.userId,
    action:  parsed.data.internal ? 'support.note' : 'support.reply',
    targetType: 'conversation', targetId: conversation_id,
    summary: parsed.data.internal ? 'Added an internal note' : 'Replied to a customer',
  })

  // An internal note stops here: no bell, no email, nothing that leaves the
  // Desk.
  if (parsed.data.internal) {
    revalidatePath(`/desk/inbox/${conversation_id}`)
    return { ok: true }
  }

  // The bell, for somebody who has an account to light it in.
  if (conv.brand_id) {
    try {
      await service.from('notifications').insert({
        brand_id: conv.brand_id,
        user_id:  conv.user_id,
        type:     'support_reply',
        title:    'We replied to your message',
        body:     body.slice(0, 200),
        href:     '/dashboard',
      })
    } catch {
      // A missed bell is not a reason to lose the reply.
    }
  }

  // And an email, unless they were writing to us a moment ago, in which case
  // they are still in the widget and an email is noise.
  const activeRecently = conv.last_message_at
    && Date.now() - new Date(conv.last_message_at).getTime() < 10 * 60 * 1000

  let emailed: boolean | null = null
  if (conv.email && !activeRecently && emailConfigured()) {
    const mail = await sendMail({
      from:     'BrandGauge <support@brandgauge.app>',
      to:       conv.email,
      subject:  'Re: your message to BrandGauge',
      replyTo:  'support@brandgauge.app',
      text:
`${conv.name ? `Hi ${conv.name.split(' ')[0]},` : 'Hi,'}

${body}

Just reply to this email, or open the chat on BrandGauge — either way we'll see it.

${session.fullName}
BrandGauge`,
    })
    // The reply is in the thread either way, so a refused email does not fail
    // the action. It is reported back so the person who wrote it knows the
    // customer may not have seen it in their inbox.
    emailed = mail.sent
  }

  revalidatePath(`/desk/inbox/${conversation_id}`)
  revalidatePath('/desk/inbox')
  if (emailed === false) return { ok: true, warning: 'Your reply is in the thread, but the email did not go out.' }
  return { ok: true }
}

export async function setThreadStatus(formData: FormData): Promise<void> {
  const session = await requireStaffOrNull('support.close')
  if (!session) return

  const id     = String(formData.get('conversation_id') ?? '')
  const status = String(formData.get('status') ?? '')
  if (!id || !['open', 'pending', 'snoozed', 'closed'].includes(status)) return

  const service = await createServiceClient()
  await service.from('support_conversations').update({
    status,
    closed_at: status === 'closed' ? new Date().toISOString() : null,
  }).eq('id', id)

  await writeAudit({
    actorId: session.userId, action: 'support.status',
    targetType: 'conversation', targetId: id,
    summary: `Marked a conversation ${status}`,
  })
  revalidatePath(`/desk/inbox/${id}`)
  revalidatePath('/desk/inbox')
}

export async function assignThread(formData: FormData): Promise<void> {
  const session = await requireStaffOrNull('support.assign')
  if (!session) return

  const id = String(formData.get('conversation_id') ?? '')
  const to = String(formData.get('assigned_to') ?? '')
  if (!id) return

  const service = await createServiceClient()
  await service.from('support_conversations')
    .update({ assigned_to: to || null })
    .eq('id', id)

  await writeAudit({
    actorId: session.userId, action: 'support.assign',
    targetType: 'conversation', targetId: id,
    summary: to ? 'Assigned a conversation' : 'Unassigned a conversation',
  })
  revalidatePath(`/desk/inbox/${id}`)
  revalidatePath('/desk/inbox')
}

/**
 * Erasing a conversation, so the inbox does not become a permanent stockpile.
 *
 * Closed only, checked here against the row itself rather than trusted from
 * the form: a client is a cache, not a source of truth, and the whole point
 * of this gate is that nothing live or waiting on a reply can be erased by a
 * stale screen. support_messages cascades, so the thread's messages go with
 * it; nothing else in the schema references a conversation in a way that
 * would block the delete.
 */
export async function deleteConversation(formData: FormData): Promise<void> {
  const session = await requireStaffOrNull('support.delete')
  if (!session) return

  const id = String(formData.get('conversation_id') ?? '')
  if (!id) return

  const service = await createServiceClient()
  const { data: conversation } = await service
    .from('support_conversations').select('status').eq('id', id).maybeSingle()
  if (!conversation || conversation.status !== 'closed') return

  await service.from('support_conversations').delete().eq('id', id)

  await writeAudit({
    actorId: session.userId, action: 'support.delete',
    targetType: 'conversation', targetId: id,
    summary: 'Deleted a closed conversation',
  })
  revalidatePath('/desk/inbox')
  redirect('/desk/inbox')
}

/**
 * The queue, re-read.
 *
 * The inbox keeps its list mounted while you move between threads, so a Next
 * layout renders it once and never again and revalidatePath cannot reach it.
 * The shell calls this instead: on a Realtime change, on a view change, and
 * when a tab comes back to the front.
 *
 * It is a server action rather than a route because the Desk has no API
 * routes, and requireStaffOrNull is the same gate every other entry point
 * uses, so a signed-out or suspended tab gets nothing rather than stale rows.
 */
export async function loadInbox(
  view: InboxView,
): Promise<{ rows: InboxRow[]; counts: InboxCounts } | null> {
  const session = await requireStaffOrNull('support.view')
  if (!session) return null

  const [rows, counts] = await Promise.all([
    supportInbox(session, view),
    inboxCounts(session),
  ])
  return { rows, counts }
}
