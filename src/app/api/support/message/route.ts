import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveThreadId, threadMessages, hashIp } from '@/lib/support/chat'
import { verifyAttachment } from '@/lib/support/attachments'
import { withinLimit } from '@/lib/support/limits'

export const runtime = 'nodejs'

/**
 * A customer message.
 *
 * The conversation is resolved from the session or the cookie, never from the
 * body, so there is no id here that could be aimed at somebody else's thread.
 *
 * Attachments arrive as the signed references the upload route handed back.
 * Each signature is checked against this conversation, so a path cannot be
 * invented and a reference minted for one thread cannot be replayed into
 * another. An attachment that does not verify is dropped and the message still
 * sends: losing a screenshot is better than losing the question.
 */

const AttachmentInput = z.object({
  path: z.string().max(400),
  name: z.string().max(200),
  type: z.string().max(100),
  size: z.number().int().nonnegative(),
  signature: z.string().max(200),
})

const Body = z.object({
  body: z.string().trim().min(1, 'Type a message').max(4000),
  attachments: z.array(AttachmentInput).max(5).optional(),
})

function ipOf(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || '0.0.0.0'
}

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Bad request' }, { status: 400 },
    )
  }

  const conversationId = await resolveThreadId()
  if (!conversationId) {
    return NextResponse.json({ error: 'Open the chat first.' }, { status: 409 })
  }

  // Twenty a minute is far more than a conversation needs and far less than a
  // script wants.
  if (!await withinLimit(`support:msg:${hashIp(ipOf(req))}`, 20, 60)) {
    return NextResponse.json(
      { error: 'That is a lot of messages. Give it a moment.' }, { status: 429 },
    )
  }

  const service  = await createServiceClient()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const attachments = (parsed.data.attachments ?? [])
    .filter(a => verifyAttachment(conversationId, a, a.signature))
    .map(({ path, name, type, size }) => ({ path, name, type, size }))

  const { error } = await service.from('support_messages').insert({
    conversation_id: conversationId,
    author_type: 'customer',
    author_id:   user?.id ?? null,
    body:        parsed.data.body,
    attachments,
  })

  if (error) {
    return NextResponse.json({ error: 'Could not send that. Try again.' }, { status: 500 })
  }

  return NextResponse.json({ messages: await threadMessages(conversationId) })
}
