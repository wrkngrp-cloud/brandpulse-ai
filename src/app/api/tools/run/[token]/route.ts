import { NextResponse } from 'next/server'
import { runByToken } from '@/lib/tools/runs'
import { runIsUnlocked } from '@/lib/tools/leads'
import { gateResult } from '@/lib/tools/gate'

export const runtime = 'nodejs'

/**
 * A visitor's own report, by token.
 *
 * This is how an anonymous result survives a refresh, a shared link and a
 * round trip through sign-up. The token is the whole authorisation: holding it
 * is holding the report, and the table stores only its hash, so nothing here
 * can be enumerated from an id. No personal data is ever written into a run,
 * which is what makes a shareable report URL safe.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const run = await runByToken(token)
  if (!run) {
    return NextResponse.json({ error: 'That report has expired or never existed.' }, { status: 404 })
  }

  /* The same gate as the analysis route. A report link that someone forwards
     shows the preview to whoever opens it, and the full thing to nobody who
     has not asked for it, so the rule does not depend on which door was
     used. Once the report has been unlocked once, it stays unlocked: the
     person who paid for it with their address should not be asked twice. */
  const unlocked = run.result ? await runIsUnlocked(run.id) : true
  const gated = run.result
    ? gateResult(run.toolId, run.result as Record<string, unknown>, unlocked)
    : { result: run.result, gated: false, withheld: { findings: 0, nextAction: false, limitations: false } }

  return NextResponse.json({
    id:          run.id,
    toolId:      run.toolId,
    status:      run.status,
    inputs:      run.inputs,
    result:      gated.result,
    gated:       gated.gated,
    withheld:    gated.withheld,
    failureNote: run.failureNote,
    coverage:    run.coverage,
    createdAt:   run.createdAt,
    claimed:     run.claimed,
  })
}
