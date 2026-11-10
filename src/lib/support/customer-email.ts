import { sendMail, emailConfigured, type MailResult } from '@/lib/email/send'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * Getting a reply back to someone who is not sitting in the widget.
 *
 * One rule used to decide this for every reply, staff or assistant: a
 * conversation that started by email has no other channel the customer will
 * ever see a reply on, so it is always emailed. Everything else keeps the
 * original logic — only emailed once they have gone quiet, because while they
 * are in the widget an email is noise, not a courtesy.
 *
 * Used by both the staff reply action and the assistant's live reply, so a
 * bot answer reaches an emailed-in customer exactly the way a person's does.
 */

export interface ReplyableConversation {
  id:              string
  email:           string | null
  name:            string | null
  source:          string
  subject:         string | null
  inbound_address: string | null
  last_message_at: string | null
}

export function needsEmail(conv: ReplyableConversation): boolean {
  if (!conv.email) return false
  if (conv.source === 'email') return true
  const quietMs = conv.last_message_at
    ? Date.now() - new Date(conv.last_message_at).getTime()
    : Infinity
  return quietMs >= 10 * 60 * 1000
}

export async function emailReply(
  conv: ReplyableConversation, body: string, signOff: string,
): Promise<MailResult | null> {
  if (!needsEmail(conv) || !emailConfigured()) return null

  const service = await createServiceClient()
  const { data: lastInbound } = await service
    .from('support_messages')
    .select('email_rfc_message_id')
    .eq('conversation_id', conv.id)
    .eq('author_type', 'customer')
    .not('email_rfc_message_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Whichever address they wrote to is the one they should see the reply
  // come from — a hello@ conversation answered from support@ reads as a
  // different, unfamiliar sender.
  const from = conv.inbound_address ?? 'support@brandgauge.app'
  const inReplyTo = (lastInbound?.email_rfc_message_id as string | undefined) ?? undefined

  return sendMail({
    from:    `BrandGauge <${from}>`,
    to:      conv.email!,
    subject: conv.subject ? `Re: ${conv.subject}` : 'Re: your message to BrandGauge',
    replyTo: from,
    ...(inReplyTo ? { headers: { 'In-Reply-To': inReplyTo, References: inReplyTo } } : {}),
    text:
`${conv.name ? `Hi ${conv.name.split(' ')[0]},` : 'Hi,'}

${body}

${conv.source === 'email'
  ? 'Just reply to this email and we will see it.'
  : 'Just reply to this email, or open the chat on BrandGauge — either way we will see it.'}

${signOff}
BrandGauge`,
  })
}
