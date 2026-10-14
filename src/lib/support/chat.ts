import { cookies } from 'next/headers'
import { randomBytes, createHash } from 'node:crypto'
import { createClient, createServiceClient } from '@/lib/supabase/server'

/**
 * The support chat, server side.
 *
 * One thread per person, found two ways. A signed-in customer is found by
 * their user id. A stranger is found by a random token in an httpOnly cookie,
 * which is the only credential they have, so every function here filters on it
 * rather than on anything the caller sent in a body.
 *
 * The service client is used throughout because a stranger has no RLS
 * identity. The ownership rule in CLAUDE.md is satisfied the way the public
 * token routes satisfy it: the id is never taken from the request. It is
 * resolved from the session or from the cookie, both of which the caller
 * cannot forge.
 */

export const VISITOR_COOKIE = 'bg_visitor'
const VISITOR_TTL_DAYS = 180

export interface ChatMessage {
  id:        string
  author:    'customer' | 'staff' | 'system'
  authorName: string | null
  body:      string
  attachments: { name: string; url: string | null; type: string }[]
  createdAt: string
}

export interface ChatThread {
  id:        string
  status:    'open' | 'pending' | 'snoozed' | 'closed'
  email:     string | null
  name:      string | null
  messages:  ChatMessage[]
  /** Whether anyone who can reply is around. Drives what the widget promises. */
  staffOnline: boolean
}

function visitorCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure:   process.env.NODE_ENV === 'production',
    path:     '/',
    maxAge:   VISITOR_TTL_DAYS * 24 * 60 * 60,
  }
}

/**
 * The visitor token for this browser, minted if it has none.
 *
 * Writing a cookie is only allowed in a route handler or an action, which is
 * why this takes the decision rather than reading it: a page that called it
 * would throw.
 */
export async function ensureVisitorToken(): Promise<string> {
  const jar = await cookies()
  const existing = jar.get(VISITOR_COOKIE)?.value
  if (existing) return existing

  const token = randomBytes(24).toString('base64url')
  jar.set(VISITOR_COOKIE, token, visitorCookieOptions())
  return token
}

export async function readVisitorToken(): Promise<string | null> {
  const jar = await cookies()
  return jar.get(VISITOR_COOKIE)?.value ?? null
}

/**
 * Is anyone who can reply around?
 *
 * Five minutes, and only people holding support.reply, so the widget does not
 * promise a live answer because somebody in finance left a tab open. When the
 * answer is no the widget says when we will reply instead, which is the honest
 * version of the same information.
 */
export async function staffOnline(): Promise<boolean> {
  try {
    const service = await createServiceClient()
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    const { data } = await service
      .from('staff')
      .select('user_id, role, status, last_seen_at')
      .eq('status', 'active')
      .gte('last_seen_at', cutoff)

    if (!data?.length) return false

    const userIds = data.map(s => s.user_id)
    const { data: perms } = await service
      .from('role_permissions')
      .select('role')
      .eq('permission', 'support.reply')

    const replyRoles = new Set((perms ?? []).map(p => p.role))
    if (data.some(s => s.role === 'super_admin' || replyRoles.has(s.role))) return true

    // A grant override can put somebody on the inbox who is not on a role that
    // includes it, so the roles alone are not the whole answer.
    const { data: overrides } = await service
      .from('staff_permission_overrides')
      .select('user_id, effect')
      .eq('permission', 'support.reply')
      .eq('effect', 'grant')
      .in('user_id', userIds)

    return (overrides ?? []).length > 0
  } catch {
    // If we cannot tell, do not claim somebody is here.
    return false
  }
}

/** The caller's thread, created on first use. */
export async function getOrCreateThread(opts: {
  source:   'app' | 'site' | 'scoreboard' | 'tool'
  pageUrl?: string | null
  userAgent?: string | null
}): Promise<ChatThread> {
  const service  = await createServiceClient()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let conversation: { id: string; status: string; email: string | null; name: string | null } | null = null

  if (user) {
    const { data } = await service
      .from('support_conversations')
      .select('id, status, email, name')
      .eq('user_id', user.id)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    conversation = data
  } else {
    const token = await readVisitorToken()
    if (token) {
      const { data } = await service
        .from('support_conversations')
        .select('id, status, email, name')
        .eq('visitor_token', token)
        .maybeSingle()
      conversation = data
    }
  }

  if (!conversation) {
    const token = user ? null : await ensureVisitorToken()

    // A signed-in customer brings their workspace and brand with them, which is
    // what puts the account's state beside their first message in the Desk.
    let workspaceId: string | null = null
    let brandId:     string | null = null
    let email:       string | null = null
    let name:        string | null = null

    if (user) {
      email = user.email ?? null
      name  = (user.user_metadata?.full_name as string | undefined) ?? null
      const { data: brand } = await supabase
        .from('brands').select('id, workspace_id').limit(1).maybeSingle()
      if (brand) { brandId = brand.id; workspaceId = brand.workspace_id }
    }

    const { data: created } = await service
      .from('support_conversations')
      .insert({
        workspace_id:  workspaceId,
        brand_id:      brandId,
        user_id:       user?.id ?? null,
        visitor_token: token,
        email, name,
        source:    opts.source,
        page_url:  opts.pageUrl ?? null,
        user_agent: opts.userAgent?.slice(0, 400) ?? null,
      })
      .select('id, status, email, name')
      .single()

    conversation = created
  }

  if (!conversation) throw new Error('Could not open a conversation')

  return {
    id:     conversation.id,
    status: conversation.status as ChatThread['status'],
    email:  conversation.email,
    name:   conversation.name,
    messages: await threadMessages(conversation.id),
    staffOnline: await staffOnline(),
  }
}

/** The thread a caller may actually see, resolved from session or cookie. */
export async function resolveThreadId(): Promise<string | null> {
  const service  = await createServiceClient()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data } = await service
      .from('support_conversations')
      .select('id')
      .eq('user_id', user.id)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return data?.id ?? null
  }

  const token = await readVisitorToken()
  if (!token) return null

  const { data } = await service
    .from('support_conversations')
    .select('id')
    .eq('visitor_token', token)
    .maybeSingle()
  return data?.id ?? null
}

export async function threadMessages(conversationId: string): Promise<ChatMessage[]> {
  const service = await createServiceClient()

  const { data: rows } = await service
    .from('support_messages')
    .select('id, author_type, author_id, body, attachments, internal, created_at')
    .eq('conversation_id', conversationId)
    // The customer's view never includes an internal note. The policy says the
    // same thing for a signed-in reader; this covers the service-role path.
    .eq('internal', false)
    .order('created_at')
    .limit(300)

  const staffIds = [...new Set((rows ?? [])
    .filter(r => r.author_type === 'staff' && r.author_id)
    .map(r => r.author_id as string))]

  const { data: people } = staffIds.length
    ? await service.from('staff').select('user_id, full_name').in('user_id', staffIds)
    : { data: [] }

  // First name only. The customer is talking to a person, not to a directory.
  const names = new Map((people ?? []).map(p => [p.user_id, p.full_name.split(' ')[0]]))

  return Promise.all((rows ?? []).map(async row => ({
    id:     row.id,
    author: row.author_type as ChatMessage['author'],
    authorName: row.author_type === 'staff' ? names.get(row.author_id ?? '') ?? 'BrandGauge' : null,
    body:   row.body,
    attachments: await signAttachments(row.attachments as AttachmentRow[]),
    createdAt: row.created_at,
  })))
}

interface AttachmentRow { path: string; name: string; type: string }

/**
 * Attachment links, signed per view.
 *
 * The bucket is private and these expire in a minute, so a link copied out of
 * a page stops working almost at once. That is the point: a support screenshot
 * can contain anything.
 */
async function signAttachments(list: AttachmentRow[] | null): Promise<ChatMessage['attachments']> {
  if (!Array.isArray(list) || list.length === 0) return []
  const service = await createServiceClient()

  return Promise.all(list.map(async item => {
    try {
      const { data } = await service.storage
        .from('support-attachments')
        .createSignedUrl(item.path, 60)
      return { name: item.name, type: item.type, url: data?.signedUrl ?? null }
    } catch {
      return { name: item.name, type: item.type, url: null }
    }
  }))
}

/** A coarse fingerprint for rate limiting. Never a stored raw address. */
export function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 32)
}
