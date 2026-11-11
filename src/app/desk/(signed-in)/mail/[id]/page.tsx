import { notFound } from 'next/navigation'
import { requireStaff } from '@/lib/desk/auth'
import { myMailboxAddresses, mailThread } from '@/lib/desk/mail'
import { ReplyBox } from '../reply-box'

export const dynamic = 'force-dynamic'

export default async function MailThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireStaff('mail.use', {
    action: 'mail.thread_view', targetType: 'conversation', targetId: id,
    summary: 'Opened a personal mail conversation',
  })

  const addresses = await myMailboxAddresses(session)
  const thread = await mailThread(addresses, id)
  if (!thread) notFound()

  return (
    <div className="space-y-4">
      <div className="border-b border-line pb-3">
        <h1 className="truncate text-base font-bold">{thread.name ?? thread.email ?? 'Unknown'}</h1>
        <p className="truncate text-xs text-tx-3">{[thread.email, thread.subject].filter(Boolean).join(' · ')}</p>
      </div>

      <ul className="space-y-3">
        {thread.messages.map(message => (
          <li
            key={message.id}
            className={
              message.author === 'staff'
                ? 'rounded-xl border border-line bg-card p-3 text-sm'
                : 'rounded-xl border border-line bg-paper p-3 text-sm'
            }
          >
            <p className="mb-1 flex items-baseline justify-between gap-3 text-xs text-tx-3">
              <span>{message.author === 'customer' ? (thread.name ?? thread.email ?? 'Them') : (message.authorName ?? 'You')}</span>
              <time className="bg-num" dateTime={message.createdAt}>
                {new Date(message.createdAt).toLocaleString('en-NG', {
                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </time>
            </p>
            <p className="whitespace-pre-wrap">{message.body}</p>
          </li>
        ))}
      </ul>

      <ReplyBox conversationId={thread.id} />
    </div>
  )
}
