import { NextResponse } from 'next/server'
import { runByToken } from '@/lib/tools/runs'

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
  return NextResponse.json({
    id:          run.id,
    toolId:      run.toolId,
    status:      run.status,
    inputs:      run.inputs,
    result:      run.result,
    failureNote: run.failureNote,
    coverage:    run.coverage,
    createdAt:   run.createdAt,
    claimed:     run.claimed,
  })
}
