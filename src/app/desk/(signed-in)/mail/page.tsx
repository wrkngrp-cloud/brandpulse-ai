import Link from 'next/link'
import { requireStaff } from '@/lib/desk/auth'
import { deskHref } from '@/lib/desk/urls'
import { myMailboxAddresses, mailInbox, draftsList } from '@/lib/desk/mail'
import { MailTabs } from './mail-tabs'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * One person's own mail — cold outreach and the replies to it, kept apart
 * from the shared support inbox on purpose (internal-tool-plan.md, "Mail").
 *
 * No queues, no assignment, no assistant: holding mail.use just gets you a
 * list of the conversations on addresses you actually own. Unread-first by
 * default, same as opening any mail client; "Unread" narrows to only what
 * still needs a look. Someone who holds the permission but owns no address
 * yet sees that stated plainly rather than an empty list that looks like a
 * bug.
 */
export default async function MailPage({
  searchParams,
}: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams
  const unreadOnly = view === 'unread'

  const session = await requireStaff('mail.use')
  const addresses = await myMailboxAddresses(session)

  if (!addresses.length) {
    return (
      <div className="rounded-xl border border-line bg-card p-4 text-sm text-tx-3">
        No mailbox is set up for you yet. Ask a super admin to add a row to
        <code className="mx-1 rounded bg-shell px-1 py-0.5 text-xs">staff_mailboxes</code>
        for your account.
      </div>
    )
  }

  const [rows, drafts] = await Promise.all([
    mailInbox(addresses, unreadOnly ? 'unread' : 'all'),
    draftsList(session.userId),
  ])
  const base = await deskHref('/desk/mail')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold">Mail</h1>
          <p className="text-xs text-tx-3">{addresses.join(', ')}</p>
        </div>
        <Link href={`${base}/compose`} className={buttonVariants({ size: 'sm' })}>Compose</Link>
      </div>

      <MailTabs base={base} active="inbox" draftCount={drafts.length} />

      <div className="flex gap-1 text-xs">
        <Link
          href={base}
          className={cn('bg-press rounded-md border border-line px-2 py-1', !unreadOnly && 'bg-shell font-medium')}
        >
          All
        </Link>
        <Link
          href={`${base}?view=unread`}
          className={cn('bg-press rounded-md border border-line px-2 py-1', unreadOnly && 'bg-shell font-medium')}
        >
          Unread
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-line bg-card p-4 text-sm text-tx-3">
          {unreadOnly ? 'Nothing unread.' : 'Nothing here yet. Compose the first one.'}
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
          {rows.map(row => (
            <li key={row.id}>
              <Link href={`${base}/${row.id}`} className="bg-press block px-3 py-2.5">
                <p className="flex items-baseline justify-between gap-3">
                  <span className={cn('flex items-center gap-1.5 truncate text-sm', row.unread ? 'font-semibold' : 'font-medium')}>
                    {row.unread && <span className="size-1.5 shrink-0 rounded-full bg-flare" aria-hidden />}
                    {row.name ?? row.email ?? 'Unknown'}
                  </span>
                  <time className="bg-num shrink-0 text-[0.65rem] text-tx-3" dateTime={row.lastMessageAt}>
                    {new Date(row.lastMessageAt).toLocaleDateString('en-NG', { day: '2-digit', month: 'short' })}
                  </time>
                </p>
                <p className={cn('truncate text-xs', row.unread ? 'text-tx-1' : 'text-tx-2')}>
                  {row.subject ?? 'No subject'}
                </p>
                <p className="truncate text-xs text-tx-3">{row.preview}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
