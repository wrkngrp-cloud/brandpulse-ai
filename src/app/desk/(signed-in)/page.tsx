import { requireStaff } from '@/lib/desk/auth'
import { deskOverview, auditFeed } from '@/lib/desk/data'
import { PageHeader } from '@/components/dashboard/page-header'
import { LayoutGridIcon } from '@/components/brand/icon'

export const dynamic = 'force-dynamic'

function Readout({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <p className="bg-label text-[0.65rem] text-tx-3">{label}</p>
      <p className="bg-num mt-1.5 text-2xl">{value}</p>
      {note && <p className="mt-1 text-xs text-tx-3">{note}</p>}
    </div>
  )
}

export default async function DeskHome({
  searchParams,
}: { searchParams: Promise<{ denied?: string }> }) {
  const session = await requireStaff(undefined, {
    action: 'desk.overview_view', summary: 'Opened the Desk overview',
  })
  const { denied } = await searchParams

  const [overview, feed] = await Promise.all([
    deskOverview(session),
    auditFeed(session, 12),
  ])

  const money = (usd: number) =>
    `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="The Desk"
        title={`Hello, ${session.fullName.split(' ')[0]}`}
        subtitle="Who is on BrandGauge, what they are using, and what it costs us to run."
        icon={LayoutGridIcon}
      />

      {denied && (
        <p className="rounded-xl border border-line bg-shell p-3 text-sm text-tx-2" role="alert">
          You do not have access to that screen. Ask a super admin for{' '}
          <span className="font-medium text-tx">{denied}</span> if you need it.
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Readout
          label="Workspaces" value={String(overview.workspaces)}
          note={`${overview.workspacesNew30} new in 30 days`}
        />
        <Readout label="Brands" value={String(overview.brands)} />
        {overview.leads && (
          <Readout
            label="Leads" value={String(overview.leads.total)}
            note={`${overview.leads.new7} this week`}
          />
        )}
        {overview.ai && (
          <Readout
            label="AI calls, 30 days"
            value={overview.ai.calls30.toLocaleString('en-US')}
            note={
              overview.ai.costUsd30 === null
                ? 'Cost hidden on your role'
                : `${money(overview.ai.costUsd30)} to run`
            }
          />
        )}
      </section>

      {/* Instrumentation went in before the screens did, so for the first
          thirty days these read low because the history starts now, not
          because the product is quiet. Worth remembering before reading a
          trend into them. */}
      <p className="text-xs text-tx-3">
        Usage figures start from 14 October 2026, when they were first recorded.
      </p>

      <section className="space-y-3">
        <h2 className="bg-label text-[0.7rem] text-tx-3">
          {session.sees('data.audit_all') ? 'Recent activity' : 'Your recent activity'}
        </h2>

        {feed.length === 0 ? (
          <p className="rounded-xl border border-line bg-card p-4 text-sm text-tx-3">
            Nothing recorded yet.
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
            {feed.map(row => (
              <li key={row.id} className="flex items-baseline justify-between gap-4 px-4 py-2.5 text-sm">
                <span className="text-tx-2">
                  <span className="font-medium text-tx">{row.actorName}</span>
                  {' '}{row.summary ?? row.action}
                </span>
                <time className="bg-num shrink-0 text-xs text-tx-3" dateTime={row.createdAt}>
                  {new Date(row.createdAt).toLocaleString('en-NG', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
