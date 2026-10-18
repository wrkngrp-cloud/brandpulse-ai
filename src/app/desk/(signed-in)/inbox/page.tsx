import Link from 'next/link'
import { requireStaff } from '@/lib/desk/auth'
import { supportInbox } from '@/lib/desk/data'
import { PageHeader } from '@/components/dashboard/page-header'
import { MessageQuoteIcon } from '@/components/brand/icon'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const SOURCE_LABEL: Record<string, string> = {
  app: 'In the product', site: 'Website', scoreboard: 'Scoreboard',
  tool: 'Free tool', email: 'Email',
}

export default async function InboxPage({
  searchParams,
}: { searchParams: Promise<{ status?: string }> }) {
  const session = await requireStaff('support.view', {
    action: 'support.inbox_view', summary: 'Opened the support inbox',
  })
  const { status } = await searchParams
  const showAll = status === 'all'

  const rows = await supportInbox(session, showAll ? 'all' : 'open')
  const waiting = rows.filter(r => r.waitingOnUs).length

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Support"
        title="Inbox"
        subtitle={
          waiting === 0
            ? 'Nothing is waiting on us.'
            : `${waiting} ${waiting === 1 ? 'conversation is' : 'conversations are'} waiting on us.`
        }
        icon={MessageQuoteIcon}
        actions={
          <div className="flex gap-1 text-xs">
            <Link
              href="/desk/inbox"
              className={cn('bg-press rounded-md border px-2.5 py-1',
                showAll ? 'border-line text-tx-2' : 'border-line bg-shell text-tx')}
            >
              Open
            </Link>
            <Link
              href="/desk/inbox?status=all"
              className={cn('bg-press rounded-md border px-2.5 py-1',
                showAll ? 'border-line bg-shell text-tx' : 'border-line text-tx-2')}
            >
              Everything
            </Link>
          </div>
        }
      />

      {rows.length === 0 ? (
        <p className="rounded-xl border border-line bg-card p-6 text-sm text-tx-3">
          No conversations yet. The widget is live in the product, on the website and on
          the scoreboard, so the first one will land here.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
          {rows.map(row => (
            <li key={row.id}>
              <Link href={`/desk/inbox/${row.id}`} className="bg-press block px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {/* Waiting on us is the only state worth a mark, and it
                        carries the word as well as the dot. */}
                    {row.waitingOnUs && (
                      <span className="size-1.5 rounded-full bg-flare" aria-hidden />
                    )}
                    {row.name ?? row.email ?? 'Someone on the site'}
                    {row.waitingOnUs && (
                      <span className="bg-label text-[0.6rem] text-tx-3">Waiting</span>
                    )}
                  </p>
                  <time className="bg-num text-xs text-tx-3" dateTime={row.lastMessageAt}>
                    {new Date(row.lastMessageAt).toLocaleString('en-NG', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </time>
                </div>

                <p className="mt-1 line-clamp-1 text-sm text-tx-2">{row.preview}</p>

                <p className="mt-1 text-xs text-tx-3">
                  {[
                    row.workspaceName ? `${row.workspaceName} · ${row.plan}` : 'No account yet',
                    SOURCE_LABEL[row.source] ?? row.source,
                    row.pageUrl,
                    row.assignedTo ? `with ${row.assignedTo}` : null,
                    row.status !== 'open' ? row.status : null,
                  ].filter(Boolean).join(' · ')}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
