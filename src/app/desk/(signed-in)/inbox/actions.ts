'use server'

import { revalidatePath } from 'next/cache'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaffOrNull, writeAudit } from '@/lib/desk/auth'
import { z } from 'zod'

export type ReplyState = { error?: string; ok?: boolean } | null

let resend: Resend | null = null
const getResend = () => (resend ??= new Resend(process.env.RESEND_API_KEY))

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

  if (conv.email && !activeRecently && process.env.RESEND_API_KEY) {
    try {
      await getResend().emails.send({
        from:     'BrandGauge <support@brandgauge.app>',
        to:       conv.email,
        subject:  'Re: your message to BrandGauge',
        replyTo:  'support@brandgauge.app',
        text:
`${conv.name ? `Hi ${conv.name.split(' ')[0]},` : 'Hi,'}

${body}

Reply to this email and it goes straight back to the same conversation.

${session.fullName}
BrandGauge`,
      })
    } catch {
      // Same rule. The reply is in the thread either way.
    }
  }

  revalidatePath(`/desk/inbox/${conversation_id}`)
  revalidatePath('/desk/inbox')
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
