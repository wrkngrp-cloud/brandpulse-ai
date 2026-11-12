import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, randomUUID, createHmac, timingSafeEqual } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { inngest } from '@/lib/inngest/client'
import { effectiveAssistantMode } from '@/lib/support/assistant/mode-db'
import { SUPPORT_POOL } from '@/lib/support/support-pool'

export const runtime = 'nodejs'

/**
 * Mail landing at brandgauge.app, from Resend's domain-level Receiving
 * webhook (event `email.received`).
 *
 * Receiving is catch-all across the whole domain once its MX record is live
 * — not a per-address Inbox resource — so this fires for anything@brandgauge
 * .app, including stray mail to an address nobody uses. INBOUND_ADDRESSES is
 * the allowlist that keeps that from turning into noise in the Desk: only
 * support@ and hello@ become a conversation, routed into the same table the
 * chat widget writes to. privacy@ is live on the domain but deliberately not
 * in this list yet — NDPR correspondence landing in the same shared queue
 * support staff can read is a decision someone should make on purpose, not
 * one this file should make by defaulting it in.
 *
 * A customer is matched by their From address against a prior conversation in
 * the same POOL only — never across pools, and never against a chat widget
 * thread from the same person. Two pools exist:
 *
 *   * the shared support pool (support@, hello@) — both feed the one Desk
 *     inbox, and a reply from the same person on either address threads
 *     together, because that merge was the point (staff/support#hello.md).
 *   * a personal pool, one per row in staff_mailboxes — grillo@ doing cold
 *     outreach needs his replies kept apart from anything support@ or hello@
 *     ever saw from the same external address, since they are a different
 *     kind of conversation (sales, not a ticket), worked from /desk/mail, not
 *     /desk/inbox, and never touched by the assistant.
 *
 * Channels stay separate threads too: a signed-in customer's in-app chat and
 * their email are two different conversations, each labelled by source, so
 * staff know which one they are answering. A known customer's new email
 * conversation is still stamped with their workspace_id (never their
 * user_id — that is what the widget keys on to find "your" thread, and
 * setting it here would pull this email thread into the widget on their next
 * visit), which is enough for the Desk's Accounts page to list it alongside
 * their other conversations without merging anything.
 *
 * Nobody has a visitor cookie or a session here, so the table's NOT NULL
 * constraint (visitor_token or user_id) is satisfied with a random token that
 * is never set as a cookie — it only has to exist, it is never read back.
 */

const EVENT_TYPE = 'email.received'

/** Which addresses a reply to `toAddress` should be matched against. Null if
 *  `toAddress` is neither the support pool nor anyone's personal mailbox —
 *  the signal to ignore the email entirely. */
async function resolvePool(
  service: Awaited<ReturnType<typeof createServiceClient>>, toAddress: string,
): Promise<string[] | null> {
  if (SUPPORT_POOL.includes(toAddress)) return SUPPORT_POOL
  const { data } = await service
    .from('staff_mailboxes').select('address').eq('address', toAddress).maybeSingle()
  return data ? [data.address] : null
}

/**
 * Resend signs this webhook the same way Svix does, because that is what
 * Resend's webhook delivery runs on: the secret from the dashboard
 * (`whsec_...`) is base64 after that prefix, the signed content is
 * `{svix-id}.{svix-timestamp}.{raw body}`, HMAC-SHA256'd with that key and
 * base64-encoded, and svix-signature carries one or more space-separated
 * `v1,<signature>` entries to check against (key rotation sends more than
 * one). A timestamp more than five minutes old is refused, same reasoning as
 * nonce replay on any other webhook here.
 */
function verifyResendSignature(req: NextRequest, rawBody: string): boolean {
  const secret = process.env.RESEND_INBOUND_WEBHOOK_SECRET
  if (!secret) return false

  const id        = req.headers.get('svix-id')
  const timestamp = req.headers.get('svix-timestamp')
  const sigHeader = req.headers.get('svix-signature')
  if (!id || !timestamp || !sigHeader) return false

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) return false

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const signedContent = `${id}.${timestamp}.${rawBody}`
  const expected = createHmac('sha256', key).update(signedContent).digest('base64')
  const expectedBuf = Buffer.from(expected)

  return sigHeader.split(' ').some(entry => {
    const sig = entry.split(',')[1]
    if (!sig) return false
    const sigBuf = Buffer.from(sig)
    return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf)
  })
}

/** "Name <addr@x.com>" or a bare address, either way. */
function splitFrom(from: string): { email: string; name: string | null } {
  const match = from.match(/^(.*?)<([^>]+)>\s*$/)
  if (match) {
    const name = match[1].trim().replace(/^"|"$/g, '')
    return { email: match[2].trim().toLowerCase(), name: name || null }
  }
  return { email: from.trim().toLowerCase(), name: null }
}

/** Only used when Resend gave us html and no text at all. Good enough for a reply thread, not a renderer. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

interface ReceivedEmail {
  id: string
  from: string
  to: string[]
  cc: string[] | null
  bcc: string[] | null
  subject: string | null
  message_id: string | null
  text: string | null
  html: string | null
  attachments: { id: string; filename: string }[]
}

/** The webhook carries only metadata; the body is a separate fetch by design (Resend's own note: keeps the webhook body small for serverless limits). */
async function fetchEmailBody(emailId: string): Promise<{ email: ReceivedEmail } | { error: string }> {
  const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
  })
  if (!res.ok) {
    // Surfaced in the 502 body below, which is what the Resend delivery log
    // shows — the fastest way to see why without a Vercel log lookup. A
    // restricted_api_key here means the key only has sending access.
    return { error: `Resend ${res.status}: ${(await res.text()).slice(0, 300)}` }
  }
  return { email: await res.json() }
}

interface StoredAttachment { path: string; name: string; type: string; size: number }

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
const ALLOWED_ATTACHMENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'])

/**
 * Every attachment on an inbound email, pulled into our own private bucket
 * in the same {path, name, type, size} shape the chat widget already uses,
 * so the thread view renders them with no special case. Resend's own
 * download_url is time-limited; a Desk reader coming back to this thread a
 * week later needs the file to still be there. A file too large or the
 * wrong type is skipped with a note rather than failing the whole email —
 * the text of the message is worth more than one attachment.
 */
async function pullAttachments(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  emailId: string, conversationId: string,
  attachments: ReceivedEmail['attachments'],
): Promise<{ stored: StoredAttachment[]; skipped: string[] }> {
  const stored: StoredAttachment[] = []
  const skipped: string[] = []

  for (const att of attachments) {
    const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}/attachments/${att.id}`, {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    })
    if (!res.ok) { skipped.push(att.filename); continue }
    const meta = await res.json() as { download_url: string; filename: string; content_type: string; size: number }

    if (meta.size > MAX_ATTACHMENT_BYTES || !ALLOWED_ATTACHMENT_TYPES.has(meta.content_type)) {
      skipped.push(meta.filename)
      continue
    }

    const fileRes = await fetch(meta.download_url)
    if (!fileRes.ok) { skipped.push(meta.filename); continue }

    const displayName = meta.filename.slice(0, 120)
    const extension = displayName.includes('.') ? displayName.split('.').pop()!.slice(0, 8) : 'bin'
    const path = `${conversationId}/${randomUUID()}.${extension.replace(/[^a-zA-Z0-9]/g, '')}`

    const { error } = await service.storage.from('support-attachments')
      .upload(path, await fileRes.arrayBuffer(), { contentType: meta.content_type, upsert: false })
    if (error) { skipped.push(meta.filename); continue }

    stored.push({ path, name: displayName, type: meta.content_type, size: meta.size })
  }

  return { stored, skipped }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  if (!verifyResendSignature(req, rawBody)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let event: { type?: string; data?: Record<string, unknown> }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (event.type !== EVENT_TYPE) return NextResponse.json({ received: true })

  const data    = event.data ?? {}
  const emailId = data.email_id as string | undefined
  const to      = (data.to as string[] | undefined)?.map(a => a.toLowerCase()) ?? []
  if (!emailId) return NextResponse.json({ received: true })

  const service = await createServiceClient()

  // Whichever of our addresses the pool matches on is the one it actually
  // arrived at — needed as toAddress below even though the match itself runs
  // against the whole pool.
  let toAddress: string | undefined
  let pool: string[] | null = null
  for (const candidate of to) {
    pool = await resolvePool(service, candidate)
    if (pool) { toAddress = candidate; break }
  }
  if (!toAddress || !pool) return NextResponse.json({ received: true })
  const isPersonal = !SUPPORT_POOL.includes(toAddress)

  // A retried delivery must not double-post. Checked before the API round
  // trip to Resend, so a repeat delivery costs nothing extra.
  const { data: dupe } = await service
    .from('support_messages').select('id').eq('email_message_id', emailId).maybeSingle()
  if (dupe) return NextResponse.json({ received: true })

  const fetched = await fetchEmailBody(emailId)
  if ('error' in fetched) {
    // Resend will retry a non-2xx. A transient failure to read our own
    // message back is worth retrying; a malformed payload is not, and never
    // gets this far.
    console.error('[support-inbound] could not fetch the message body:', fetched.error)
    return NextResponse.json({ error: fetched.error }, { status: 502 })
  }
  const { email } = fetched

  const { email: fromAddress, name } = splitFrom(email.from)

  const { data: existing } = await service
    .from('support_conversations')
    .select('id')
    .eq('email', fromAddress)
    .eq('source', 'email')
    .in('inbound_address', pool)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let conversationId = existing?.id as string | undefined
  if (!conversationId) {
    // Best-effort link to an existing account, for the Accounts page only —
    // see the block comment above for why this is workspace_id and never
    // user_id. A workspace with more than one brand is left unattributed
    // rather than guessed at.
    let workspaceId: string | null = null
    let brandId: string | null = null
    const { data: userId } = await service.rpc('auth_user_id_for_email', { p_email: fromAddress })
    if (userId) {
      const { data: membership } = await service
        .from('workspace_members').select('workspace_id')
        .eq('user_id', userId).limit(1).maybeSingle()
      workspaceId = membership?.workspace_id ?? null
      if (workspaceId) {
        const { data: brands } = await service
          .from('brands').select('id').eq('workspace_id', workspaceId).limit(2)
        if (brands?.length === 1) brandId = brands[0].id
      }
    }

    const { data: created, error: createErr } = await service
      .from('support_conversations')
      .insert({
        visitor_token:   randomBytes(24).toString('base64url'),
        email:           fromAddress,
        name,
        subject:         email.subject,
        source:          'email',
        inbound_address: toAddress,
        workspace_id:    workspaceId,
        brand_id:        brandId,
      })
      .select('id')
      .single()
    if (createErr || !created) {
      console.error('[support-inbound] could not open a conversation:', createErr)
      return NextResponse.json({ error: 'Could not open a conversation' }, { status: 500 })
    }
    conversationId = created.id
  }
  const convId = conversationId as string

  const { stored: attachments, skipped } = email.attachments?.length
    ? await pullAttachments(service, emailId, convId, email.attachments)
    : { stored: [], skipped: [] }
  const skippedNote = skipped.length
    ? `\n\n[${skipped.length} attachment${skipped.length === 1 ? '' : 's'} could not be saved (${skipped.join(', ')}) — too large, or not an image or PDF.]`
    : ''
  const body = (email.text || (email.html ? htmlToText(email.html) : '') || '(no text in this email)') + skippedNote

  const { error: msgErr } = await service.from('support_messages').insert({
    conversation_id: convId,
    author_type:     'customer',
    body,
    attachments,
    cc:  email.cc ?? [],
    bcc: email.bcc ?? [],
    email_message_id:     emailId,
    email_rfc_message_id: email.message_id,
  })
  if (msgErr) {
    console.error('[support-inbound] could not post the message:', msgErr)
    return NextResponse.json({ error: 'Could not post the message' }, { status: 500 })
  }

  // Same path as a chat message: the assistant decides whether to answer or
  // hand off, and a handoff is what pings staff. A failed send never loses
  // the email itself, which is already safely in the thread. Never for a
  // personal mailbox — cold outreach is a human conversation, and the
  // assistant has no business drafting a reply to someone's own prospect.
  if (!isPersonal && await effectiveAssistantMode() !== 'off') {
    try {
      await inngest.send({ name: 'support/message.received', data: { conversationId } })
    } catch (err) {
      console.error('[support-inbound] could not queue the assistant:', err)
    }
  }

  return NextResponse.json({ received: true })
}
