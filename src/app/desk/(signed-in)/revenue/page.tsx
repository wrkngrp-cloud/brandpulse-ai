import { requireStaff } from '@/lib/desk/auth'
import { revenueSummary, planPrices } from '@/lib/desk/money'
import { accountList } from '@/lib/desk/accounts'
import { PageHeader } from '@/components/dashboard/page-header'
import { CurrencyIcon } from '@/components/brand/icon'
import { RevenueForms } from './revenue-forms'

export const dynamic = 'force-dynamic'

const naira = (n: number) => `₦${n.toLocaleString('en-NG')}`

export default async function RevenuePage() {
  const session = await requireStaff('revenue.view', {
    action: 'revenue.view', summary: 'Opened revenue',
  })

  const [summary, accounts, prices] = await Promise.all([
    revenueSummary(session),
    accountList(session),
    planPrices(),
  ])
  if (!summary) return null

  const hidden = summary.mrrNgn === null

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Revenue"
        title={hidden ? `${summary.activeCount} active` : naira(summary.mrrNgn ?? 0)}
        subtitle={
          hidden
            ? 'Amounts are hidden on your role. The plan mix and the counts are not.'
            : 'Monthly recurring, with yearly subscriptions spread over twelve months.'
        }
        icon={CurrencyIcon}
      />

      {/* Billing is deferred, so most accounts have no row at all. Saying so
          stops the MRR being read as the whole picture. */}
      <p className="rounded-xl border border-line bg-shell p-3 text-sm text-tx-2">
        Billing is deferred until post-beta and will run on Paystack. These figures cover
        subscriptions entered here by hand.{' '}
        {summary.unbilled > 0 && (
          <>
            <span className="font-medium text-tx">{summary.unbilled}</span>{' '}
            {summary.unbilled === 1 ? 'account has' : 'accounts have'} no subscription
            recorded, which for the beta is expected.
          </>
        )}
      </p>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Readout label="Active" value={String(summary.activeCount)} />
        <Readout label="Trialing" value={String(summary.trialingCount)} />
        <Readout
          label="Past due" value={String(summary.pastDueCount)}
          note={summary.pastDueCount > 0 ? 'worth a conversation' : undefined}
        />
        <Readout
          label="Collected this month"
          value={summary.paidThisMonthNgn === null ? 'Hidden' : naira(summary.paidThisMonthNgn)}
        />
      </section>

      {summary.aiCostUsdMtd !== null && (
        <section className="rounded-xl border border-line bg-card p-4">
          <p className="bg-label text-[0.65rem] text-tx-3">What the product costs to run</p>
          <p className="bg-num mt-1.5 text-2xl">${summary.aiCostUsdMtd.toFixed(2)}</p>
          <p className="mt-1 text-xs text-tx-3">
            Every AI call this month, across every account. This is the only cost we measure,
            so it is a floor on what we spend and not the whole bill.
          </p>
        </section>
      )}

      {summary.planMix.length > 0 && (
        <section className="space-y-3">
          <h2 className="bg-label text-[0.7rem] text-tx-3">Plan mix, active only</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
            {summary.planMix.map(row => (
              <li key={row.plan} className="flex items-baseline justify-between px-4 py-2.5 text-sm">
                <span>{row.plan}</span>
                <span className="bg-num text-xs">
                  {row.count}
                  {row.mrrNgn !== null && <span className="ml-3 text-tx-3">{naira(row.mrrNgn)}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {session.can('revenue.edit') && (
        <RevenueForms
          accounts={accounts.map(a => ({ id: a.workspaceId, name: a.name, plan: a.plan }))}
          prices={prices}
        />
      )}

      <section className="space-y-3">
        <h2 className="bg-label text-[0.7rem] text-tx-3">Subscriptions</h2>
        {summary.subscriptions.length === 0 ? (
          <p className="rounded-xl border border-line bg-card p-4 text-sm text-tx-3">
            None recorded yet.
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
            {summary.subscriptions.map(sub => (
              <li key={sub.id} className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
                <div>
                  <p className="font-medium">{sub.workspaceName}</p>
                  <p className="text-xs text-tx-3">
                    {sub.plan} · {sub.status} · per {sub.interval} · entered {sub.provider}
                    {sub.periodEnd ? ` · renews ${sub.periodEnd}` : ''}
                  </p>
                </div>
                <span className="bg-num text-xs">
                  {sub.amountNgn === null ? 'hidden' : naira(sub.amountNgn)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {summary.invoices.length > 0 && (
        <section className="space-y-3">
          <h2 className="bg-label text-[0.7rem] text-tx-3">Invoices</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
            {summary.invoices.map(inv => (
              <li key={inv.id} className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
                <div>
                  <p>{inv.workspaceName}</p>
                  <p className="text-xs text-tx-3">
                    {inv.status}
                    {inv.paidAt ? ` · paid ${new Date(inv.paidAt).toLocaleDateString('en-NG')}` : ''}
                    {` · ${inv.provider}`}
                  </p>
                </div>
                <span className="bg-num text-xs">
                  {inv.amountNgn === null ? 'hidden' : naira(inv.amountNgn)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Readout({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <p className="bg-label text-[0.65rem] text-tx-3">{label}</p>
      <p className="bg-num mt-1.5 text-2xl">{value}</p>
      {note && <p className="mt-1 text-xs text-tx-3">{note}</p>}
    </div>
  )
}
