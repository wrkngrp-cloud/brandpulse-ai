import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { inngest } from '@/lib/inngest/client'
import { effectiveAssistantMode } from '@/lib/support/assistant/mode-db'

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
 * A customer is matched by their From address against support_conversations,
 * the same table a signed-in customer's chat thread lives in, so a reply from
 * someone who has also used the widget lands in their existing thread rather
 * than a second one. Nobody has a visitor cookie or a session here, so the
 * table's NOT NULL constraint (visitor_token or user_id) is satisfied with a
 * random token that is never set as a cookie — it only has to exist, it is
 * never read back.
 */

const EVENT_TYPE = 'email.received'
const INBOUND_ADDRESSES = new Set(['support@brandgauge.app', 'hello@brandgauge.app'])

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
  subject: string | null
  text: string | null
  html: string | null
  attachments: { filename: string }[]
}

/** The webhook carries only metadata; the body is a separate fetch by design (Resend's own note: keeps the webhook body small for serverless limits). */
async function fetchEmailBody(emailId: string): Promise<ReceivedEmail | null> {
  const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
  })
  if (!res.ok) return null
  return res.json()
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
  const to      = (data.to as string[] | undefined) ?? []
  if (!emailId) return NextResponse.json({ received: true })

  const toAddress = to.map(a => a.toLowerCase()).find(a => INBOUND_ADDRESSES.has(a))
  if (!toAddress) return NextResponse.json({ received: true })

  const service = await createServiceClient()

  // A retried delivery must not double-post. Checked before the API round
  // trip to Resend, so a repeat delivery costs nothing extra.
  const { data: dupe } = await service
    .from('support_messages').select('id').eq('email_message_id', emailId).maybeSingle()
  if (dupe) return NextResponse.json({ received: true })

  const email = await fetchEmailBody(emailId)
  if (!email) {
    // Resend will retry a non-2xx. A transient failure to read our own
    // message back is worth retrying; a malformed payload is not, and never
    // gets this far.
    return NextResponse.json({ error: 'Could not fetch the message body' }, { status: 502 })
  }

  const { email: fromAddress, name } = splitFrom(email.from)
  const attachmentNote = email.attachments?.length
    ? `\n\n[${email.attachments.length} attachment${email.attachments.length === 1 ? '' : 's'} sent with this email (${email.attachments.map(a => a.filename).join(', ')}) — not pulled in yet; ask them to send it through the chat if it's needed.]`
    : ''
  const body = (email.text || (email.html ? htmlToText(email.html) : '') || '(no text in this email)') + attachmentNote

  const { data: existing } = await service
    .from('support_conversations')
    .select('id')
    .eq('email', fromAddress)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let conversationId = existing?.id as string | undefined
  if (!conversationId) {
    const { data: created, error: createErr } = await service
      .from('support_conversations')
      .insert({
        visitor_token:   randomBytes(24).toString('base64url'),
        email:           fromAddress,
        name,
        subject:         email.subject,
        source:          'email',
        inbound_address: toAddress,
      })
      .select('id')
      .single()
    if (createErr || !created) {
      console.error('[support-inbound] could not open a conversation:', createErr)
      return NextResponse.json({ error: 'Could not open a conversation' }, { status: 500 })
    }
    conversationId = created.id
  }

  const { error: msgErr } = await service.from('support_messages').insert({
    conversation_id: conversationId,
    author_type:     'customer',
    body,
    email_message_id: emailId,
  })
  if (msgErr) {
    console.error('[support-inbound] could not post the message:', msgErr)
    return NextResponse.json({ error: 'Could not post the message' }, { status: 500 })
  }

  // Same path as a chat message: the assistant decides whether to answer or
  // hand off, and a handoff is what pings staff. A failed send never loses
  // the email itself, which is already safely in the thread.
  if (await effectiveAssistantMode() !== 'off') {
    try {
      await inngest.send({ name: 'support/message.received', data: { conversationId } })
    } catch (err) {
      console.error('[support-inbound] could not queue the assistant:', err)
    }
  }

  return NextResponse.json({ received: true })
}
