import { notFound } from 'next/navigation'
import { requireStaff } from '@/lib/desk/auth'
import { myMailboxAddresses, mailThread, markRead, getDraftForConversation } from '@/lib/desk/mail'
import { signMailAttachment } from '@/lib/support/attachments'
import { ReplyBox, type ReplyDraftInitial } from '../reply-box'
import { FileIcon } from '@/components/brand/icon'

export const dynamic = 'force-dynamic'

export default async function MailThreadPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ draft?: string }>
}) {
  const { id } = await params
  const session = await requireStaff('mail.use', {
    action: 'mail.thread_view', targetType: 'conversation', targetId: id,
    summary: 'Opened a personal mail conversation',
  })

  const addresses = await myMailboxAddresses(session)
  const thread = await mailThread(addresses, id)
  if (!thread) notFound()

  // Opening the thread is what clears its unread mark, same as any mail
  // client — no separate "mark as read" control to forget to press.
  await markRead(addresses, id)

  const { draft: wantsDraft } = await searchParams
  const savedDraft = wantsDraft ? await getDraftForConversation(session.userId, id) : null
  const draftInitial: ReplyDraftInitial | undefined = savedDraft
    ? {
        cc: savedDraft.cc, bcc: savedDraft.bcc, body: savedDraft.body,
        attachments: savedDraft.attachments.map(a => ({ ...a, signature: signMailAttachment(session.userId, a) })),
      }
    : undefined

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
            {(message.cc.length > 0 || message.bcc.length > 0) && (
              <p className="mb-1 text-[0.65rem] text-tx-3">
                {message.cc.length > 0 && <>CC: {message.cc.join(', ')}</>}
                {message.cc.length > 0 && message.bcc.length > 0 && ' · '}
                {message.bcc.length > 0 && <>BCC: {message.bcc.join(', ')}</>}
              </p>
            )}
            <p className="whitespace-pre-wrap">{message.body}</p>
            {message.attachments.length > 0 && (
              <ul className="mt-2 space-y-1">
                {message.attachments.map(file => (
                  <li key={file.name} className="flex items-center gap-1.5 text-xs">
                    <FileIcon className="size-3" />
                    {file.url ? (
                      <a href={file.url} target="_blank" rel="noopener noreferrer" className="underline">{file.name}</a>
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

      <ReplyBox conversationId={thread.id} fromAddress={thread.inboundAddress ?? addresses[0]} initial={draftInitial} />
    </div>
  )
}
