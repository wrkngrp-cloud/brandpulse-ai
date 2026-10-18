import { requireStaff } from '@/lib/desk/auth'
import { opsReport } from '@/lib/desk/ops'
import { PageHeader } from '@/components/dashboard/page-header'
import { WrenchIcon } from '@/components/brand/icon'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function OpsPage() {
  const session = await requireStaff('ops.view', {
    action: 'ops.view', summary: 'Opened ops health',
  })

  const report = await opsReport(session)
  if (!report) return null

  const missingBlocking = report.credentials.filter(c => c.blocking && !c.present)
  const missingOptional = report.credentials.filter(c => !c.blocking && !c.present)
  const failRate = report.aiErrors24.total === 0
    ? 0
    : Math.round((report.aiErrors24.failed / report.aiErrors24.total) * 100)

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Ops"
        title="Health"
        subtitle="The two things that go wrong quietly: a missing credential, and a connector that stopped syncing."
        icon={WrenchIcon}
      />

      {missingBlocking.length > 0 && (
        <section className="space-y-2">
          <h2 className="bg-label text-[0.7rem] text-neg">Missing and blocking</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
            {missingBlocking.map(c => (
              <li key={c.name} className="px-4 py-2.5">
                <p className="text-sm">{c.name}</p>
                <p className="text-xs text-tx-3">{c.gates}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="bg-label text-[0.7rem] text-tx-3">Credentials</h2>
        <p className="text-xs text-tx-3">
          Whether each one is set, never what it is. A feature with a missing credential is
          Inert: built, and quiet about not working.
        </p>
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
          {report.credentials.map(c => (
            <li key={c.name} className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-2">
              <div>
                <p className="text-sm">{c.name}</p>
                <p className="text-xs text-tx-3">{c.gates}</p>
              </div>
              {/* The word, not only a colour. */}
              <span className={cn('text-xs', c.present ? 'text-pos' : c.blocking ? 'text-neg' : 'text-tx-3')}>
                {c.present ? 'set' : c.blocking ? 'missing' : 'not set'}
              </span>
            </li>
          ))}
        </ul>
        {missingOptional.length > 0 && (
          <p className="text-xs text-tx-3">
            {missingOptional.length} optional credentials are unset. Each one makes its
            feature degrade rather than break, and the product says so where it matters.
          </p>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-card p-4">
          <p className="bg-label text-[0.65rem] text-tx-3">AI calls, 24 hours</p>
          <p className="bg-num mt-1.5 text-2xl">{report.aiErrors24.total}</p>
          <p className={cn('mt-1 text-xs', failRate > 5 ? 'text-neg' : 'text-tx-3')}>
            {report.aiErrors24.failed} failed{report.aiErrors24.total > 0 && ` (${failRate}%)`}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-card p-4">
          <p className="bg-label text-[0.65rem] text-tx-3">Scoreboard, 7 days</p>
          <p className="bg-num mt-1.5 text-2xl">{report.scoreboard.scans7}</p>
          <p className="mt-1 text-xs text-tx-3">{report.scoreboard.leads7} left an address</p>
        </div>
        <div className="rounded-xl border border-line bg-card p-4">
          <p className="bg-label text-[0.65rem] text-tx-3">Free tool runs, 7 days</p>
          <p className="bg-num mt-1.5 text-2xl">{report.scoreboard.toolRuns7}</p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="bg-label text-[0.7rem] text-tx-3">
          Connectors not synced in three days
        </h2>
        {report.stale.length === 0 ? (
          <p className="rounded-xl border border-line bg-card p-4 text-sm text-tx-3">
            Everything connected has synced recently.
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
            {report.stale.map((c, i) => (
              <li key={`${c.table}-${c.brandName}-${i}`} className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-2">
                <div>
                  <p className="text-sm">
                    {c.label}{c.detail ? ` · ${c.detail}` : ''}
                  </p>
                  <p className="text-xs text-tx-3">{c.workspaceName} · {c.brandName}</p>
                </div>
                <span className="text-xs text-tx-3">
                  {c.lastSyncAt === null
                    ? 'never synced'
                    : `${c.daysStale} days ago`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {report.seeds.length > 0 && (
        <section className="space-y-2">
          <h2 className="bg-label text-[0.7rem] text-tx-3">Demo accounts</h2>
          <p className="text-xs text-tx-3">
            Seeds go live by being run, not by being deployed. A demo login on an empty
            dashboard is what this catches.
          </p>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
            {report.seeds.map((seed, i) => (
              <li key={`${seed.workspaceName}-${i}`} className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm">
                <span>{seed.workspaceName} · {seed.brandName}</span>
                <span className={cn('text-xs', seed.lastSnapshot ? 'text-tx-3' : 'text-neg')}>
                  {seed.lastSnapshot ? `history to ${seed.lastSnapshot}` : 'no brand health history'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-tx-3">
        Background job history is not here. There is no Inngest API key in this app, so it
        would be invented rather than read. The run history is in the Inngest dashboard.
      </p>
    </div>
  )
}
