import { requireStaff } from '@/lib/desk/auth'
import { supportInbox, inboxCounts, type InboxView } from '@/lib/desk/data'
import { PageHeader } from '@/components/dashboard/page-header'
import { MessageQuoteIcon } from '@/components/brand/icon'
import { InboxShell } from './inbox-shell'

export const dynamic = 'force-dynamic'

/**
 * The inbox is one screen, and this is why it is a layout.
 *
 * Everything under /desk/inbox renders inside the queue rather than replacing
 * it, so moving between conversations keeps the list, the counts and your
 * place in it. The first page is rendered here on the server; after that the
 * shell owns its own data, because a layout is not re-run when the route
 * inside it changes.
 *
 * The audit row is written here rather than in each page, so opening the inbox
 * is recorded once whichever conversation you land on.
 */
export default async function InboxLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaff('support.view', {
    action: 'support.inbox_view', summary: 'Opened the support inbox',
  })

  const view: InboxView = 'open'
  const [rows, counts] = await Promise.all([
    supportInbox(session, view),
    inboxCounts(session),
  ])

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Support"
        title="Inbox"
        subtitle={
          counts.unassigned === 0
            ? 'Nothing is waiting to be picked up.'
            : `${counts.unassigned} ${counts.unassigned === 1 ? 'conversation is' : 'conversations are'} unassigned.`
        }
        icon={MessageQuoteIcon}
      />

      <InboxShell initialRows={rows} initialCounts={counts} initialView={view}>
        {children}
      </InboxShell>
    </div>
  )
}
