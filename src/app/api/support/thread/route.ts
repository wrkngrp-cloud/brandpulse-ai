import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getOrCreateThread } from '@/lib/support/chat'

export const runtime = 'nodejs'

/**
 * Open the chat, or catch up on it.
 *
 * POST rather than GET because it may mint the visitor cookie, and because the
 * widget polls it for strangers, who have no Realtime identity to subscribe
 * with. A signed-in customer gets the first load from here and then live
 * updates over Realtime, which RLS scopes to their own thread. The tables are
 * on the publication as of 20261020090000; before that this paragraph
 * described an intention and every reader polled.
 *
 * Nothing in the body identifies the caller. The thread is resolved from the
 * session or from the httpOnly cookie, both of which a caller cannot forge.
 * `source` and `pageUrl` are context for whoever answers, not identity.
 */

const Body = z.object({
  source:  z.enum(['app', 'site', 'scoreboard', 'tool']).default('site'),
  pageUrl: z.string().max(500).optional(),
})

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  try {
    const thread = await getOrCreateThread({
      source:    parsed.data.source,
      pageUrl:   parsed.data.pageUrl ?? null,
      userAgent: req.headers.get('user-agent'),
    })
    return NextResponse.json(thread)
  } catch {
    return NextResponse.json({ error: 'Could not open the chat.' }, { status: 500 })
  }
}
