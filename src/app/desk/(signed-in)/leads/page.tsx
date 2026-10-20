import Link from 'next/link'
import { requireStaff } from '@/lib/desk/auth'
import { leadsSummary, TOOL_NAME } from '@/lib/desk/leads'
import { PageHeader } from '@/components/dashboard/page-header'
import { TrendIcon } from '@/components/brand/icon'
import { updateLead, seedDemoLeads, removeDemoLeads } from './actions'

export const dynamic = 'force-dynamic'

export default async function DeskLeadsPage() {
  const session = await requireStaff('leads.view', {
    action: 'leads.view', summary: 'Opened the lead desk',
  })

  const summary = await leadsSummary(session)
  if (!summary) return null

  const canEdit = session.can('leads.edit')
  const when = (iso: string) => new Date(iso).toLocaleDateString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric',
  })

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Leads"
        title={`${summary.total} captured`}
        subtitle={[
          `${summary.new7} this week`,
          `${summary.signedUp} went on to open an account`,
          summary.demoRows > 0 ? `${summary.demoRows} seeded` : null,
        ].filter(Boolean).join(' · ')}
        icon={TrendIcon}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Seeding is for looking at a working desk before real leads
                arrive. Removing is only offered when there is something to
                remove, so the desk does not advertise a demo mode it is not
                in. */}
            {canEdit && (
              <form action={seedDemoLeads}>
                <button type="submit" className="bg-press rounded-md border border-line px-2.5 py-1 text-xs text-tx-2">
                  Seed demo rows
                </button>
              </form>
            )}
            {canEdit && summary.demoRows > 0 && (
              <form action={removeDemoLeads}>
                <button type="submit" className="bg-press rounded-md border border-line px-2.5 py-1 text-xs text-neg">
                  Remove demo rows
                </button>
              </form>
            )}
            <Link
              href="/desk/leads/funnel"
              className="bg-press rounded-md border border-line px-2.5 py-1 text-xs text-tx-2"
            >
              Free tool funnel
            </Link>
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summary.byStatus.map(row => (
          <div key={row.status} className="rounded-xl border border-line bg-card p-4">
            <p className="bg-label text-[0.65rem] text-tx-3">{row.status}</p>
            <p className="bg-num mt-1.5 text-2xl">{row.count}</p>
          </div>
        ))}
      </section>

      <p className="text-xs text-tx-3">
        {summary.anonymousScans.toLocaleString('en-NG')} scans ran without an address left
        behind. The board is shown before the address is asked for, so most people never
        give one, and that is the trade the free tool makes on purpose.
      </p>

      {summary.leads.length === 0 ? (
        <p className="rounded-xl border border-line bg-card p-6 text-sm text-tx-3">
          No leads captured yet.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
          {summary.leads.map(lead => (
            <li key={lead.id} className="px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {lead.name ?? lead.email}
                    {lead.signedUp && (
                      <span className="bg-label ml-2 text-[0.6rem] text-pos">Signed up</span>
                    )}
                    {lead.wantsWeekly && (
                      <span className="bg-label ml-2 text-[0.6rem] text-tx-3">Weekly email</span>
                    )}
                    {/* Unmissable, because the cost of calling a person who
                        does not exist is an embarrassing phone call. */}
                    {lead.isDemo && (
                      <span className="bg-label ml-2 rounded-sm border border-line-strong px-1.5 py-0.5 text-[0.6rem] text-tx-3">
                        Demo row
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-tx-3">
                    {lead.email}
                    {lead.role ? ` · ${lead.role}` : ''}
                    {lead.company ? ` · ${lead.company}` : ''}
                    {lead.website ? ` · ${lead.website}` : ''}
                    {` · from ${TOOL_NAME[lead.source] ?? lead.source}`}
                    {` · ${when(lead.createdAt)}`}
                  </p>
                </div>

                {canEdit && (
                  <form action={updateLead} className="flex items-center gap-1.5">
                    <input type="hidden" name="lead_id" value={lead.id} />
                    <input type="hidden" name="notes" value={lead.notes ?? ''} />
                    <select
                      name="status" defaultValue={lead.status}
                      className="h-8 rounded-md border border-line bg-paper px-2 text-xs"
                    >
                      {['new', 'contacted', 'qualified', 'converted', 'dead'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <button type="submit" className="bg-press rounded-md border border-line px-2 py-1 text-xs">
                      Save
                    </button>
                  </form>
                )}
              </div>

              {/* The opening line. "I saw you checked yourself against
                  Moniepoint and PalmPay and came out at 8%" is a different
                  conversation from "just following up". */}
              {lead.scan && (
                <p className="mt-2 rounded-xl border border-line bg-shell p-2.5 text-xs text-tx-2">
                  Scanned <span className="font-medium text-tx">{lead.scan.brandName}</span>
                  {lead.scan.competitors.length > 0 && (
                    <> against {lead.scan.competitors.join(', ')}</>
                  )}
                  {lead.scan.shareOfReach !== null && (
                    <> and came out at <span className="bg-num">{lead.scan.shareOfReach}%</span> share of reach</>
                  )}
                  {lead.scan.mentionsFound !== null && (
                    <> on {lead.scan.mentionsFound} mentions</>
                  )}
                  .
                </p>
              )}

              {/* The trail through the tools, which is the difference between
                  "submitted a form" and knowing what they were trying to find
                  out. Kept when the free-tool lead gate moved in here. */}
              {lead.toolRuns.length > 0 && (
                <div className="mt-2 rounded-xl border border-line bg-shell p-2.5">
                  <p className="bg-label text-[0.6rem] text-tx-3">Tools they ran</p>
                  <ul className="mt-1.5 space-y-1.5">
                    {lead.toolRuns.map((run, i) => (
                      <li key={`${run.toolId}-${i}`} className="text-xs">
                        <span className="font-medium">{TOOL_NAME[run.toolId] ?? run.toolId}</span>
                        {run.subject && <> on <span className="font-medium">{run.subject}</span></>}
                        <span className="text-tx-3"> · {when(run.createdAt)}</span>
                        {run.wantsMonitoring && (
                          <span className="bg-label ml-2 text-[0.6rem] text-tx-3">Wants updates</span>
                        )}
                        {run.headline && (
                          <p className="mt-0.5 text-[0.7rem] text-tx-3">{run.headline}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {lead.notes && <p className="mt-1.5 text-xs text-tx-2">{lead.notes}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
