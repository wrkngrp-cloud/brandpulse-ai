import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/dashboard/page-header'
import { MarketIcon, ArrowRightIcon } from '@/components/brand/icon'
import { FREE_TOOLS, toolById } from '@/lib/tools/registry'

export const metadata = { title: 'Free tool funnel | BrandGauge' }
export const dynamic = 'force-dynamic'

/**
 * The founder's view of the free tools.
 *
 * Same access rule as the lead desk next door: `staff_can('leads.view')`,
 * because none of this belongs to a tenant. The views it reads are
 * `security_invoker`, so the policy on tool_events is the guarantee and this
 * check is only the redirect.
 *
 * The columns are chosen to resist the one metric that would mislead us.
 * Signups are not success: a visitor who completed a tool, received something
 * real, activated a workspace and then used a feature in it is success, and
 * those are separate columns so a gap between them is visible rather than
 * averaged away. "Meaningful" counts runs that actually produced findings,
 * links or opportunities — a run that honestly reported it could not establish
 * anything is a completed run and not a delivered result.
 */
interface FunnelRow {
  tool_id: string
  day: string
  visitors: number
  started: number
  completed: number
  meaningful: number
  results_viewed: number
  results_engaged: number
  cta_clicked: number
  workspaces_activated: number
  first_value: number
  workspaces_using_features: number
}

interface AccountRow {
  tool_id: string
  run_id: string
  workspace_name: string | null
  brand_name: string | null
  website_url: string | null
  industry: string | null
  brand_type: string | null
  features_used: number
  claimed_at: string | null
  last_seen_at: string | null
}

/* Out of the component body: the lint rule treats a clock read during render as
   impure, and it is right to — this page is a server component, but the rule is
   the same one that keeps a client render idempotent. */
function thirtyDaysAgo(): string {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export default async function FunnelPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: canView } = await supabase.rpc('staff_can', { perm: 'leads.view' })
  if (!canView) redirect('/dashboard')

  const since = thirtyDaysAgo()

  const [{ data: funnel }, { data: accounts }] = await Promise.all([
    supabase.from('free_tool_funnel').select('*').gte('day', since),
    supabase.from('free_tool_qualified_accounts').select('*').order('claimed_at', { ascending: false }).limit(100),
  ])

  const rows = (funnel ?? []) as FunnelRow[]

  // Totals per tool across the window, plus the directory, which is tracked
  // under its own id so its traffic is not mixed into any one tool's.
  const byTool = new Map<string, FunnelRow>()
  for (const r of rows) {
    const existing = byTool.get(r.tool_id)
    byTool.set(r.tool_id, existing ? sum(existing, r) : { ...r })
  }

  const ordered = [
    ...FREE_TOOLS.map(t => ({ id: t.id, name: t.name, row: byTool.get(t.id) })),
    ...(byTool.has('directory') ? [{ id: 'directory', name: 'The /tools directory', row: byTool.get('directory') }] : []),
  ]

  const totals = rows.reduce<FunnelRow | null>((acc, r) => (acc ? sum(acc, r) : { ...r }), null)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Lead desk"
        title="Free tool funnel"
        subtitle="Last thirty days. Visitors through to workspaces that actually used something, per tool."
        icon={MarketIcon}
        actions={
          <Link href="/dashboard/leads"
            className="flex items-center gap-1.5 rounded-sm border border-line px-3.5 py-2 text-[13px] font-medium text-tx bg-press">
            Lead desk <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        }
      />

      {!rows.length ? (
        <div className="rounded-sm border border-line bg-card px-6 py-12 text-center">
          <p className="text-[15px] font-medium text-tx">No events in the last thirty days</p>
          <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-tx-3">
            Events are recorded from the moment someone opens a tool page. An empty table here
            means nobody has, not that tracking is broken.
          </p>
        </div>
      ) : (
        <>
          <section className="overflow-x-auto rounded-sm border border-line bg-card">
            <table className="w-full min-w-[56rem] text-left text-[13px]">
              <thead>
                <tr className="bg-shell">
                  <th className="px-4 py-2.5 font-medium text-tx-3">Tool</th>
                  <Th>Visitors</Th>
                  <Th>Started</Th>
                  <Th>Completed</Th>
                  <Th>Meaningful</Th>
                  <Th>Result seen</Th>
                  <Th>CTA clicked</Th>
                  <Th>Activated</Th>
                  <Th>Used a feature</Th>
                </tr>
              </thead>
              <tbody>
                {ordered.map(({ id, name, row }) => (
                  <tr key={id} className="border-t border-line">
                    <td className="px-4 py-2.5 text-tx">
                      {toolById(id)
                        ? <Link href={toolById(id)!.route} className="text-tx-flare">{name}</Link>
                        : name}
                    </td>
                    <Td>{row?.visitors ?? 0}</Td>
                    <Td>{row?.started ?? 0}</Td>
                    <Td>{row?.completed ?? 0}</Td>
                    <Td>{row?.meaningful ?? 0}</Td>
                    <Td>{row?.results_viewed ?? 0}</Td>
                    <Td>{row?.cta_clicked ?? 0}</Td>
                    <Td>{row?.workspaces_activated ?? 0}</Td>
                    <Td>{row?.workspaces_using_features ?? 0}</Td>
                  </tr>
                ))}
                {totals && (
                  <tr className="border-t-2 border-line-strong bg-shell">
                    <td className="px-4 py-2.5 font-medium text-tx">All tools</td>
                    <Td>{totals.visitors}</Td>
                    <Td>{totals.started}</Td>
                    <Td>{totals.completed}</Td>
                    <Td>{totals.meaningful}</Td>
                    <Td>{totals.results_viewed}</Td>
                    <Td>{totals.cta_clicked}</Td>
                    <Td>{totals.workspaces_activated}</Td>
                    <Td>{totals.workspaces_using_features}</Td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <p className="max-w-3xl text-[12px] leading-relaxed text-tx-3">
            Meaningful counts runs that produced something: verified moves, opportunities,
            findings or tracking links. A run that finished by saying it could not establish
            anything is counted as completed and deliberately not as a delivered result, because
            treating the two the same is how a tool that quietly stopped working looks healthy.
          </p>
          <p className="max-w-3xl text-[12px] leading-relaxed text-tx-3">
            These are sums of daily figures, so somebody who came back on a second day counts in
            both. Use them to compare tools against each other, not as a count of distinct people
            over the month.
          </p>
        </>
      )}

      <section className="rounded-sm border border-line bg-card">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[15px] font-medium text-tx">Accounts that came through a tool</h2>
          <p className="mt-0.5 text-[12.5px] text-tx-3">
            Behaviour, not a questionnaire. Someone who researched a competitor and then used a
            feature in their workspace is the signal worth calling.
          </p>
        </div>
        {!(accounts ?? []).length ? (
          <p className="px-5 py-8 text-center text-[13.5px] text-tx-3">Nobody has claimed a report yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {((accounts ?? []) as AccountRow[]).map(a => (
              <li key={a.run_id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-tx">
                    {a.brand_name || a.workspace_name || 'Unnamed workspace'}
                  </p>
                  <p className="mt-0.5 truncate text-[12.5px] text-tx-3">
                    {[toolById(a.tool_id)?.name ?? a.tool_id, a.website_url?.replace(/^https?:\/\//, ''), a.industry, a.brand_type]
                      .filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="flex items-center gap-6 text-right">
                  <div>
                    <p className="bg-label text-tx-3">Features used</p>
                    <p className="bg-num mt-0.5 text-[16px] leading-none text-tx">{a.features_used}</p>
                  </div>
                  <div>
                    <p className="bg-label text-tx-3">Last seen</p>
                    <p className="mt-0.5 text-[12.5px] text-tx-2">
                      {a.last_seen_at
                        ? new Date(a.last_seen_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
                        : '—'}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 text-right font-medium text-tx-3">{children}</th>
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="bg-num px-4 py-2.5 text-right text-tx">{children}</td>
}

function sum(a: FunnelRow, b: FunnelRow): FunnelRow {
  return {
    tool_id: a.tool_id,
    day: a.day,
    visitors: a.visitors + b.visitors,
    started: a.started + b.started,
    completed: a.completed + b.completed,
    meaningful: a.meaningful + b.meaningful,
    results_viewed: a.results_viewed + b.results_viewed,
    results_engaged: a.results_engaged + b.results_engaged,
    cta_clicked: a.cta_clicked + b.cta_clicked,
    workspaces_activated: a.workspaces_activated + b.workspaces_activated,
    first_value: a.first_value + b.first_value,
    workspaces_using_features: a.workspaces_using_features + b.workspaces_using_features,
  }
}
