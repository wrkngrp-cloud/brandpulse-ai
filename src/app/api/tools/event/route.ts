import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { recordEvent, TOOL_EVENTS } from '@/lib/tools/events'
import { hashIp, ipOf } from '@/lib/tools/runs'
import { cacheGet, cacheSet } from '@/lib/tools/limits'

export const runtime = 'nodejs'

/**
 * The client half of the funnel: views, CTA clicks, result engagement.
 *
 * Open by necessity — the events that matter most happen before anyone has an
 * account. Guarded by a closed event vocabulary, a props cap, and a coarse
 * per-IP ceiling so it cannot be used to write unbounded rows. The ceiling
 * fails open like every other limiter here; losing a page-view row is not
 * worth a 500 on a marketing page.
 */

const Body = z.object({
  event:     z.enum(TOOL_EVENTS),
  toolId:    z.string().max(40).optional(),
  runId:     z.string().uuid().optional(),
  visitorId: z.string().max(64).optional(),
  props:     z.record(z.string(), z.union([z.string().max(300), z.number(), z.boolean()])).optional(),
})

const EVENTS_PER_HOUR = 300

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null))
  // A malformed beacon is not worth an error page; the caller ignores this.
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 })

  const ipHash = hashIp(ipOf(req))
  const key = `tool:ev:${ipHash}`
  const seen = (await cacheGet<number>(key)) ?? 0
  if (seen > EVENTS_PER_HOUR) return NextResponse.json({ ok: true })
  await cacheSet(key, seen + 1, 3600)

  // Attach the signed-in half of the journey when there is one, so
  // beta_workspace_activated and first_value_received join to the same run.
  let userId: string | null = null
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id ?? null
  } catch { /* anonymous, which is the normal case here */ }

  await recordEvent({
    event:     parsed.data.event,
    toolId:    parsed.data.toolId ?? null,
    runId:     parsed.data.runId ?? null,
    visitorId: parsed.data.visitorId ?? null,
    userId,
    props:     parsed.data.props ?? {},
  })

  return NextResponse.json({ ok: true })
}
