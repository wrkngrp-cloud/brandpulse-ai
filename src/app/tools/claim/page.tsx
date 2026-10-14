import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { claimRun } from '@/lib/tools/runs'
import { importRun } from '@/lib/tools/import'
import { recordEvent } from '@/lib/tools/events'
import { toolById } from '@/lib/tools/registry'

export const dynamic = 'force-dynamic'

/**
 * Where a visitor lands after signing up from a free tool.
 *
 * Sign-up carries the report token through as `?claim=`, the auth flow lands
 * here, and this page does the one thing the brief insists on: the work they
 * already did is waiting, populated, in the right module. They are not asked
 * to retype a website or sit in front of an empty dashboard.
 *
 * A server component rather than a client page with a fetch, so the claim runs
 * before anything renders and the redirect is the whole response. Nothing here
 * takes a workspace from the URL; `claimRun` resolves it from the session.
 */
export default async function ClaimPage({
  searchParams,
}: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const next = token ? `/tools/claim?token=${encodeURIComponent(token)}` : '/dashboard'
    redirect(`/auth/signup?next=${encodeURIComponent(next)}`)
  }

  if (!token) redirect('/dashboard')

  const outcome = await claimRun(token, user.id)

  if (!outcome.ok) {
    // Onboarding has not created a brand yet, so there is nowhere to put the
    // report. Send them through it and come back on the same token.
    if (outcome.reason === 'no_workspace') {
      redirect(`/onboarding?claim=${encodeURIComponent(token)}`)
    }
    return <ClaimProblem reason={outcome.reason} />
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
    await recordEvent({
      event: 'first_value_received',
      toolId: outcome.run.toolId,
      runId: outcome.run.id,
      userId: user.id,
      workspaceId: outcome.workspaceId,
    })
  }

  redirect(`${imported.destination}?claimed=${encodeURIComponent(outcome.run.toolId)}`)
}

function ClaimProblem({ reason }: { reason: 'not_found' | 'taken' | 'not_complete' | 'no_workspace' }) {
  const copy: Record<typeof reason, { title: string; body: string }> = {
    not_found:    { title: 'We could not find that report', body: 'Reports from the free tools are kept for thirty days. Run it again and it takes a minute.' },
    taken:        { title: 'Another workspace has this report', body: 'Someone on a different account continued this one. Run the tool again and it will be yours.' },
    not_complete: { title: 'That analysis is still running', body: 'Give it a moment and open the report link again.' },
    no_workspace: { title: 'Finish setting up your brand', body: 'We need a brand to attach the report to.' },
  }
  const { title, body } = copy[reason]
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6">
      <h1 className="text-2xl font-medium tracking-tight text-tx">{title}</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-tx-3">{body}</p>
      <div className="mt-7 flex flex-wrap gap-3">
        <Link href="/tools" className="rounded-sm px-5 py-2.5 text-[13.5px] font-bold text-on-hot bg-press bg-flare">
          Back to the free tools
        </Link>
        <Link href="/dashboard" className="rounded-sm border border-line px-5 py-2.5 text-[13.5px] font-medium text-tx bg-press">
          Go to BrandGauge
        </Link>
      </div>
      <p className="mt-10 text-[12px] text-tx-3">
        {toolById('competitor-tracker')?.name} and the rest stay free while we are in beta.
      </p>
    </main>
  )
}
