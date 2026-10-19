import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveThreadId, hashIp } from '@/lib/support/chat'
import { withinLimit } from '@/lib/support/limits'

export const runtime = 'nodejs'

/**
 * A stranger leaving their name and address.
 *
 * Asked for when nobody is on the chat, so a thread started at midnight is not
 * a message into the void. It writes onto the thread the cookie already
 * identifies, so there is nothing here to aim at another conversation.
 *
 * This is not a lead capture. The scoreboard asks for an address with a
 * promise attached and a box to tick; this is somebody who wants an answer,
 * and the address exists so we can give them one.
 */

const Body = z.object({
  email: z.string().trim().toLowerCase().email('That email does not look right').max(160),
  name:  z.string().trim().max(80).optional(),
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

  if (!await withinLimit(`support:identify:${hashIp(ipOf(req))}`, 10, 600)) {
    return NextResponse.json({ error: 'Try again shortly.' }, { status: 429 })
  }

  const service = await createServiceClient()
  await service
    .from('support_conversations')
    .update({ email: parsed.data.email, name: parsed.data.name ?? null })
    .eq('id', conversationId)

  return NextResponse.json({ ok: true })
}
