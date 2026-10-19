import Link from 'next/link'
import { requireStaff } from '@/lib/desk/auth'
import { onDeskHost } from '@/lib/desk/urls'
import { stripDeskPrefix } from '@/lib/desk/desk-path'
import { accountList } from '@/lib/desk/accounts'
import { PageHeader } from '@/components/dashboard/page-header'
import { BuildingIcon } from '@/components/brand/icon'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function relative(iso: string | null): string {
  if (!iso) return 'never'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30)  return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

export default async function AccountsPage({
  searchParams,
}: { searchParams: Promise<{ sort?: string }> }) {
  const session = await requireStaff('accounts.view', {
    action: 'accounts.list_view', summary: 'Opened the account list',
  })
  const { sort } = await searchParams
  const rows = await accountList(session)

  // Quiet first by default. The newest account is easy to find and the one
  // that stopped showing up is the one worth a call.
  const sorted = [...rows].sort((a, b) => {
    if (sort === 'newest') return b.createdAt.localeCompare(a.createdAt)
    if (sort === 'spend')  return (b.aiCallsMtd) - (a.aiCallsMtd)
    const aTime = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0
    const bTime = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0
    return aTime - bTime
  })

  const quiet = rows.filter(r => !r.lastActiveAt).length
  const onDesk = await onDeskHost()
  const sortHref = (key: string) => {
    const mainHostHref = key === 'quiet' ? '/desk/accounts' : `/desk/accounts?sort=${key}`
    return onDesk ? stripDeskPrefix(mainHostHref) : mainHostHref
  }

  const tab = (key: string, label: string) => (
    <Link
      href={sortHref(key)}
      className={cn('bg-press rounded-md border border-line px-2.5 py-1 text-xs',
        (sort ?? 'quiet') === key ? 'bg-shell text-tx' : 'text-tx-2')}
    >
      {label}
    </Link>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Accounts"
        title={`${rows.length} ${rows.length === 1 ? 'workspace' : 'workspaces'}`}
        subtitle={
          quiet === 0
            ? 'Every workspace has opened something in the last 30 days.'
            : `${quiet} ${quiet === 1 ? 'has' : 'have'} never opened a module since we started recording.`
        }
        icon={BuildingIcon}
        actions={
          <div className="flex gap-1">
            {tab('quiet', 'Quietest first')}
            {tab('newest', 'Newest')}
            {tab('spend', 'Most AI calls')}
          </div>
        }
      />

      {rows.length === 0 ? (
        <p className="rounded-xl border border-line bg-card p-6 text-sm text-tx-3">
          No workspaces yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="bg-label px-4 py-2 text-[0.65rem] font-normal text-tx-3">Workspace</th>
                <th className="bg-label px-3 py-2 text-[0.65rem] font-normal text-tx-3">Plan</th>
                <th className="bg-label px-3 py-2 text-[0.65rem] font-normal text-tx-3">Seats</th>
                <th className="bg-label px-3 py-2 text-[0.65rem] font-normal text-tx-3">Connected</th>
                <th className="bg-label px-3 py-2 text-[0.65rem] font-normal text-tx-3">Modules 30d</th>
                <th className="bg-label px-3 py-2 text-[0.65rem] font-normal text-tx-3">BHI</th>
                <th className="bg-label px-3 py-2 text-[0.65rem] font-normal text-tx-3">AI calls</th>
                <th className="bg-label px-3 py-2 text-[0.65rem] font-normal text-tx-3">Last active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sorted.map(row => (
                <tr key={row.workspaceId}>
                  <td className="px-4 py-2.5">
                    <Link href={`/desk/accounts/${row.workspaceId}`} className="bg-press font-medium">
                      {row.name}
                    </Link>
                    <p className="text-xs text-tx-3">
                      {row.brands.length === 0
                        ? 'no brand yet'
                        : row.brands.map(b => b.brandType ?? 'type not set').join(', ')}
                      {row.openThreads > 0 && ` · ${row.openThreads} open in the inbox`}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-xs">{row.plan}</td>
                  <td className="bg-num px-3 py-2.5 text-xs">{row.seats}</td>
                  <td className="bg-num px-3 py-2.5 text-xs">{row.connectors}</td>
                  <td className="bg-num px-3 py-2.5 text-xs">{row.modulesUsed30}</td>
                  <td className="bg-num px-3 py-2.5 text-xs">{row.bhi ?? '—'}</td>
                  <td className="bg-num px-3 py-2.5 text-xs">
                    {row.aiCallsMtd}
                    {row.aiCostMtd !== null && row.aiCostMtd > 0 && (
                      <span className="ml-1 text-tx-3">${row.aiCostMtd.toFixed(2)}</span>
                    )}
                  </td>
                  <td className={cn('px-3 py-2.5 text-xs', !row.lastActiveAt && 'text-neg')}>
                    {relative(row.lastActiveAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-tx-3">
        Module usage and AI cost start from 14 October 2026, when they were first recorded.
        An account that reads as quiet before then was not necessarily quiet.
      </p>
    </div>
  )
}
