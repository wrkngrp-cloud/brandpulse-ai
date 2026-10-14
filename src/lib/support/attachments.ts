import { createHmac, createHash, timingSafeEqual } from 'node:crypto'

/**
 * Attachment references, signed.
 *
 * The upload route stores the file and hands the browser back a reference. The
 * message route has to know that reference came from us and belongs to this
 * thread, because a storage path arriving from a client is not evidence of
 * anything.
 *
 * A signature does that with no extra table and no placeholder rows to clean
 * up: the reference carries the conversation it was uploaded for, and a
 * reference minted for one thread cannot be replayed into another.
 */

export interface AttachmentRef {
  path: string
  name: string
  type: string
  size: number
}

function key(): Buffer {
  // Derived rather than used directly, so this signature and the token
  // encryption that shares the secret cannot be confused for one another.
  const secret = process.env.TOKEN_ENCRYPTION_KEY
    ?? process.env.SUPABASE_SERVICE_ROLE_KEY
    ?? 'brandgauge-dev-attachment-key'
  return createHash('sha256').update('support-attachment:' + secret).digest()
}

function payload(conversationId: string, ref: AttachmentRef): string {
  return [conversationId, ref.path, ref.name, ref.type, String(ref.size)].join('|')
}

export function signAttachment(conversationId: string, ref: AttachmentRef): string {
  return createHmac('sha256', key()).update(payload(conversationId, ref)).digest('base64url')
}

export function verifyAttachment(
  conversationId: string, ref: AttachmentRef, signature: string,
): boolean {
  try {
    const expected = Buffer.from(signAttachment(conversationId, ref), 'utf8')
    const given    = Buffer.from(signature, 'utf8')
    if (expected.length !== given.length) return false
    return timingSafeEqual(expected, given)
  } catch {
    return false
  }
}
