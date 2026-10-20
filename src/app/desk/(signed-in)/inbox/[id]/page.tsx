import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireStaff } from '@/lib/desk/auth'
import { deskHref } from '@/lib/desk/urls'
import { deskThread } from '@/lib/desk/data'
import { createServiceClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/dashboard/page-header'
import { ArrowLeftIcon, MessageQuoteIcon, FileIcon } from '@/components/brand/icon'
import { setThreadStatus, assignThread } from '../actions'
import { ReplyBox } from './reply-box'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * One conversation, with the account beside it.
 *
 * The panel on the right is the whole point of building this ourselves rather
 * than buying it. A hosted widget can show the message; it cannot show that
 * this brand's health index is 41, that they are on growth, and that they have
 * made two AI calls in a month. Most questions answer themselves from that.
 */
export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireStaff('support.view', {
    action: 'support.thread_view', targetType: 'conversation', targetId: id,
    summary: 'Opened a conversation',
  })

  const thread = await deskThread(session, id)
  if (!thread) notFound()

  // Who a thread can be handed to: people who can actually answer it.
  const service = await createServiceClient()
  const { data: team } = await service
    .from('staff').select('user_id, full_name').eq('status', 'active').order('full_name')

  return (
    <div className="space-y-6">
      <Link href={await deskHref('/desk/inbox')} className="bg-press inline-flex items-center gap-1.5 text-xs text-tx-3">
        <ArrowLeftIcon className="size-3.5" /> Inbox
      </Link>

      <PageHeader
        eyebrow={thread.account?.workspaceName ?? 'No account yet'}
        title={thread.name ?? thread.email ?? 'Someone on the site'}
        subtitle={[thread.email, thread.pageUrl].filter(Boolean).join(' · ')}
        icon={MessageQuoteIcon}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {session.can('support.assign') && (
              <form action={assignThread} className="flex items-center gap-1.5">
                <input type="hidden" name="conversation_id" value={thread.id} />
                {/* The current assignee, not a blank. Defaulting to empty
                    meant pressing Assign without touching the control quietly
                    unassigned the thread. */}
                <select
                  name="assigned_to" defaultValue={thread.assignedToId ?? ''}
                  className="h-8 rounded-md border border-line bg-paper px-2 text-xs"
                >
                  <option value="">Unassigned</option>
                  {(team ?? []).map(person => (
                    <option key={person.user_id} value={person.user_id}>{person.full_name}</option>
                  ))}
                </select>
                <button type="submit" className="bg-press rounded-md border border-line px-2 py-1 text-xs">
                  Assign
                </button>
              </form>
            )}
            {session.can('support.close') && (
              <form action={setThreadStatus} className="flex items-center gap-1.5">
                <input type="hidden" name="conversation_id" value={thread.id} />
                <select
                  name="status" defaultValue={thread.status}
                  className="h-8 rounded-md border border-line bg-paper px-2 text-xs"
                >
                  <option value="open">Open</option>
                  <option value="pending">Pending</option>
                  <option value="snoozed">Snoozed</option>
                  <option value="closed">Closed</option>
                </select>
                <button type="submit" className="bg-press rounded-md border border-line px-2 py-1 text-xs">
                  Save
                </button>
              </form>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-4">
          <ul className="space-y-3">
            {thread.messages.map(message => (
              <li
                key={message.id}
                className={cn(
                  'rounded-xl border p-3 text-sm',
                  message.internal
                    ? 'border-line bg-shell'
                    : message.author === 'staff'
                      ? 'border-line bg-card'
                      : 'border-line bg-paper',
                )}
              >
                <p className="mb-1 flex items-baseline justify-between gap-3 text-xs text-tx-3">
                  <span>
                    {message.author === 'customer'
                      ? thread.name ?? 'Customer'
                      : message.authorName ?? 'BrandGauge'}
                    {message.internal && (
                      <span className="bg-label ml-2 text-[0.6rem]">Internal note</span>
                    )}
                  </span>
                  <time className="bg-num" dateTime={message.createdAt}>
                    {new Date(message.createdAt).toLocaleString('en-NG', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </time>
                </p>

                <p className="whitespace-pre-wrap">{message.body}</p>

                {message.attachments.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {message.attachments.map(file => (
                      <li key={file.name} className="flex items-center gap-1.5 text-xs">
                        <FileIcon className="size-3" />
                        {file.url ? (
                          <a href={file.url} target="_blank" rel="noopener noreferrer" className="underline">
                            {file.name}
                          </a>
                        ) : (
                          <span className="text-tx-3">{file.name}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>

          {session.can('support.reply') ? (
            <ReplyBox conversationId={thread.id} />
          ) : (
            <p className="rounded-xl border border-line bg-shell p-3 text-sm text-tx-3">
              You can read this conversation but not reply to it.
            </p>
          )}
        </div>

        <aside className="space-y-3 text-sm">
          <h2 className="bg-label text-[0.7rem] text-tx-3">The account</h2>

          {thread.account ? (
            <dl className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
              <Fact label="Workspace" value={thread.account.workspaceName} />
              <Fact label="Plan" value={thread.account.plan} />
              <Fact label="Brand" value={thread.account.brandName ?? 'None named'} />
              <Fact label="Type" value={thread.account.brandType ?? 'Not set'} />
              <Fact
                label="Brand health"
                value={thread.account.bhi === null ? 'Not computed yet' : String(thread.account.bhi)}
              />
              <Fact label="AI calls, 30 days" value={String(thread.account.aiCalls30)} />
            </dl>
          ) : (
            <p className="rounded-xl border border-line bg-card p-3 text-tx-3">
              This came from someone without an account. Their email, if they left one, is
              above.
            </p>
          )}

          <h2 className="bg-label pt-2 text-[0.7rem] text-tx-3">The thread</h2>
          <dl className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
            <Fact label="Started" value={new Date(thread.createdAt).toLocaleString('en-NG', {
              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
            })} />
            <Fact label="Came from" value={thread.source} />
            <Fact label="Page" value={thread.pageUrl ?? 'Not recorded'} />
            <Fact label="Assigned" value={thread.assignedTo ?? 'Nobody'} />
          </dl>
        </aside>
      </div>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-2">
      <dt className="text-xs text-tx-3">{label}</dt>
      <dd className="text-right text-xs">{value}</dd>
    </div>
  )
}
