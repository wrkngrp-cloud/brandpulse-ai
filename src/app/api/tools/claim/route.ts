import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { claimRun } from '@/lib/tools/runs'
import { importRun } from '@/lib/tools/import'
import { recordEvent } from '@/lib/tools/events'

export const runtime = 'nodejs'
export const maxDuration = 30

const Body = z.object({ token: z.string().min(20).max(200) })

/**
 * Claim an anonymous report into the caller's workspace.
 *
 * Authenticated: the caller must be signed in, and `claimRun` reads their
 * workspace from their own membership rather than from this body, so the
 * service-role writes that follow cannot be aimed at someone else's tenant.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })

  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'No report token.' }, { status: 400 })

  const outcome = await claimRun(parsed.data.token, user.id)
  if (!outcome.ok) {
    const message = outcome.reason === 'taken'
      ? 'Another workspace has already continued this report.'
      : outcome.reason === 'no_workspace'
        ? 'Finish setting up your brand first.'
        : outcome.reason === 'not_complete'
          ? 'That analysis has not finished yet.'
          : 'That report has expired or never existed.'
    return NextResponse.json({ error: message, reason: outcome.reason }, { status: 404 })
  }

  const imported = await importRun(outcome.run, outcome.brandId)

  if (!outcome.alreadyClaimed) {
    await recordEvent({
      event: 'beta_workspace_activated',
      toolId: outcome.run.toolId,
      runId: outcome.run.id,
      userId: user.id,
      workspaceId: outcome.workspaceId,
      props: { destination: imported.destination },
    })
  }

  return NextResponse.json({ destination: imported.destination, note: imported.note })
}
