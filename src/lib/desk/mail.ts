import { createServiceClient } from '@/lib/supabase/server'
import { threadMessages, type ChatMessage } from '@/lib/support/chat'
import type { StaffSession } from './auth'

/**
 * A staff member's own mail, kept apart from the shared support inbox.
 *
 * Everything here is scoped to the caller's own addresses from
 * staff_mailboxes — holding mail.use opens the module, but a conversation on
 * someone else's address is invisible and unreachable through these
 * functions regardless, the same way one customer's thread is unreachable by
 * another's RLS. There is no cross-mailbox view: if two people ever need to
 * share one address, that is a product decision for later, not a default.
 */

export async function myMailboxAddresses(session: StaffSession): Promise<string[]> {
  const service = await createServiceClient()
  const { data } = await service
    .from('staff_mailboxes').select('address').eq('user_id', session.userId)
  return (data ?? []).map(r => r.address)
}

export interface MailRow {
  id:            string
  email:         string | null
  name:          string | null
  subject:       string | null
  status:        string
  inboundAddress: string | null
  lastMessageAt: string
  preview:       string
}

export async function mailInbox(addresses: string[]): Promise<MailRow[]> {
  if (!addresses.length) return []
  const service = await createServiceClient()

  const { data: rows } = await service
    .from('support_conversations')
    .select('id, email, name, subject, status, inbound_address, last_message_at')
    .in('inbound_address', addresses)
    .order('last_message_at', { ascending: false })
    .limit(200)
  if (!rows?.length) return []

  const ids = rows.map(r => r.id)
  const { data: messages } = await service
    .from('support_messages')
    .select('conversation_id, body, created_at')
    .in('conversation_id', ids)
    .eq('internal', false)
    .order('created_at', { ascending: false })
    .limit(1000)

  const latest = new Map<string, string>()
  for (const m of messages ?? []) if (!latest.has(m.conversation_id)) latest.set(m.conversation_id, m.body)

  return rows.map(r => ({
    id: r.id, email: r.email, name: r.name, subject: r.subject, status: r.status,
    inboundAddress: r.inbound_address, lastMessageAt: r.last_message_at,
    preview: (latest.get(r.id) ?? '').slice(0, 140),
  }))
}

export interface MailThread {
  id:       string
  email:    string | null
  name:     string | null
  subject:  string | null
  status:   string
  messages: ChatMessage[]
}

/** Null if the conversation does not exist or belongs to an address the
 *  caller does not own — the ownership check that makes this safe to call
 *  with an id taken straight off the URL. */
export async function mailThread(addresses: string[], id: string): Promise<MailThread | null> {
  if (!addresses.length) return null
  const service = await createServiceClient()

  const { data: conv } = await service
    .from('support_conversations')
    .select('id, email, name, subject, status, inbound_address')
    .eq('id', id)
    .in('inbound_address', addresses)
    .maybeSingle()
  if (!conv) return null

  return {
    id: conv.id, email: conv.email, name: conv.name, subject: conv.subject, status: conv.status,
    messages: await threadMessages(conv.id),
  }
}
