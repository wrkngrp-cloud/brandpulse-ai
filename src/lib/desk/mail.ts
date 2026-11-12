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
  unread:        boolean
}

/**
 * The inbox: every conversation on an address this person owns, newest
 * first within two bands — unread, then read — so what needs a look never
 * hides under something already answered. "Unread" means the newest
 * non-internal message is the customer's and nobody has opened the thread
 * since (see markRead below); a thread you last replied to is read by
 * definition, the same way a sent email isn't bold in any mail client.
 */
export async function mailInbox(addresses: string[], view: 'unread' | 'all' = 'all'): Promise<MailRow[]> {
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
    .select('conversation_id, author_type, body, read_by_staff_at, created_at')
    .in('conversation_id', ids)
    .eq('internal', false)
    .order('created_at', { ascending: false })
    .limit(1000)

  const latest = new Map<string, { author_type: string; body: string; read_by_staff_at: string | null }>()
  for (const m of messages ?? []) {
    if (!latest.has(m.conversation_id)) {
      latest.set(m.conversation_id, { author_type: m.author_type, body: m.body, read_by_staff_at: m.read_by_staff_at })
    }
  }

  const withUnread = rows.map(r => {
    const last = latest.get(r.id)
    const unread = last?.author_type === 'customer' && !last.read_by_staff_at
    return {
      id: r.id, email: r.email, name: r.name, subject: r.subject, status: r.status,
      inboundAddress: r.inbound_address, lastMessageAt: r.last_message_at,
      preview: (last?.body ?? '').slice(0, 140),
      unread: Boolean(unread),
    }
  })

  const filtered = view === 'unread' ? withUnread.filter(r => r.unread) : withUnread
  return [...filtered].sort((a, b) => {
    if (a.unread !== b.unread) return a.unread ? -1 : 1
    return b.lastMessageAt.localeCompare(a.lastMessageAt)
  })
}

export interface SentRow {
  id:             string
  conversationId: string
  to:             string | null
  name:           string | null
  subject:        string | null
  preview:        string
  createdAt:      string
}

/** A flat log of what went out, newest first — the "Sent" folder, as
 *  messages rather than threads, since "what did I send" is the question a
 *  Sent folder answers and a thread view answers something else. */
export async function sentMail(addresses: string[]): Promise<SentRow[]> {
  if (!addresses.length) return []
  const service = await createServiceClient()

  const { data: convs } = await service
    .from('support_conversations')
    .select('id, email, name, subject')
    .in('inbound_address', addresses)
    .limit(200)
  if (!convs?.length) return []
  const convById = new Map(convs.map(c => [c.id, c]))

  const { data: rows } = await service
    .from('support_messages')
    .select('id, conversation_id, body, created_at')
    .in('conversation_id', convs.map(c => c.id))
    .eq('author_type', 'staff')
    .eq('internal', false)
    .order('created_at', { ascending: false })
    .limit(200)

  return (rows ?? []).map(r => {
    const conv = convById.get(r.conversation_id)
    return {
      id: r.id, conversationId: r.conversation_id,
      to: conv?.email ?? null, name: conv?.name ?? null, subject: conv?.subject ?? null,
      preview: r.body.slice(0, 140), createdAt: r.created_at,
    }
  })
}

export interface DraftRow {
  id:             string
  conversationId: string | null
  toAddress:      string | null
  /** Resolved from the conversation when this is a reply draft, so the list
   *  can show who it's to without the caller re-deriving it. */
  displayTo:      string | null
  subject:        string | null
  preview:        string
  updatedAt:      string
}

export async function draftsList(userId: string): Promise<DraftRow[]> {
  const service = await createServiceClient()
  const { data: drafts } = await service
    .from('mail_drafts')
    .select('id, conversation_id, to_address, subject, body, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(100)
  if (!drafts?.length) return []

  const convIds = drafts.map(d => d.conversation_id).filter((id): id is string => Boolean(id))
  const { data: convs } = convIds.length
    ? await service.from('support_conversations').select('id, email, name').in('id', convIds)
    : { data: [] }
  const convById = new Map((convs ?? []).map(c => [c.id, c]))

  return drafts.map(d => ({
    id: d.id, conversationId: d.conversation_id, toAddress: d.to_address,
    displayTo: d.to_address ?? (d.conversation_id ? (convById.get(d.conversation_id)?.name ?? convById.get(d.conversation_id)?.email ?? null) : null),
    subject: d.subject, preview: d.body.slice(0, 140), updatedAt: d.updated_at,
  }))
}

export interface DraftDetail {
  id:             string
  conversationId: string | null
  fromAddress:    string
  toAddress:      string | null
  cc:             string[]
  bcc:            string[]
  subject:        string | null
  body:           string
  attachments:    { path: string; name: string; type: string; size: number }[]
}

async function loadDraft(userId: string, where: { id: string } | { conversationId: string }): Promise<DraftDetail | null> {
  const service = await createServiceClient()
  let query = service
    .from('mail_drafts')
    .select('id, conversation_id, from_address, to_address, cc, bcc, subject, body, attachments')
    .eq('user_id', userId)

  query = 'id' in where ? query.eq('id', where.id) : query.eq('conversation_id', where.conversationId)
  const { data } = await query.maybeSingle()
  if (!data) return null

  return {
    id: data.id, conversationId: data.conversation_id, fromAddress: data.from_address,
    toAddress: data.to_address, cc: data.cc ?? [], bcc: data.bcc ?? [],
    subject: data.subject, body: data.body,
    attachments: (data.attachments as DraftDetail['attachments'] | null) ?? [],
  }
}

export const getDraftById = (userId: string, id: string) => loadDraft(userId, { id })
export const getDraftForConversation = (userId: string, conversationId: string) =>
  loadDraft(userId, { conversationId })

export interface MailThread {
  id:       string
  email:    string | null
  name:     string | null
  subject:  string | null
  status:   string
  inboundAddress: string | null
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
    inboundAddress: conv.inbound_address,
    messages: await threadMessages(conv.id),
  }
}

/** Opening a thread is what clears its unread mark — there is no separate
 *  "mark as read" action, the same as any mail client. Safe to call on every
 *  view: idempotent, and scoped to addresses the caller actually owns. */
export async function markRead(addresses: string[], conversationId: string): Promise<void> {
  if (!addresses.length) return
  const service = await createServiceClient()

  const { data: conv } = await service
    .from('support_conversations').select('id')
    .eq('id', conversationId).in('inbound_address', addresses).maybeSingle()
  if (!conv) return

  await service.from('support_messages')
    .update({ read_by_staff_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('author_type', 'customer')
    .is('read_by_staff_at', null)
}
