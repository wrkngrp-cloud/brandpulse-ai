import Link from 'next/link'
import { requireStaff } from '@/lib/desk/auth'
import { deskHref } from '@/lib/desk/urls'
import { myMailboxAddresses, sentMail, draftsList } from '@/lib/desk/mail'
import { MailTabs } from '../mail-tabs'

export const dynamic = 'force-dynamic'

/** Everything sent from an owned address, flattened to messages rather than
 *  threads — "what did I send" is a different question than "what's this
 *  conversation," and a Sent folder answers the first one. */
export default async function MailSentPage() {
  const session = await requireStaff('mail.use')
  const addresses = await myMailboxAddresses(session)
  if (!addresses.length) return null

  const [rows, drafts] = await Promise.all([sentMail(addresses), draftsList(session.userId)])
  const base = await deskHref('/desk/mail')

  return (
    <div className="space-y-4">
      <h1 className="text-base font-bold">Mail</h1>
      <MailTabs base={base} active="sent" draftCount={drafts.length} />

      {rows.length === 0 ? (
        <p className="rounded-xl border border-line bg-card p-4 text-sm text-tx-3">Nothing sent yet.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
          {rows.map(row => (
            <li key={row.id}>
              <Link href={`${base}/${row.conversationId}`} className="bg-press block px-3 py-2.5">
                <p className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium">To {row.name ?? row.to ?? 'Unknown'}</span>
                  <time className="bg-num shrink-0 text-[0.65rem] text-tx-3" dateTime={row.createdAt}>
                    {new Date(row.createdAt).toLocaleDateString('en-NG', { day: '2-digit', month: 'short' })}
                  </time>
                </p>
                <p className="truncate text-xs text-tx-2">{row.subject ?? 'No subject'}</p>
                <p className="truncate text-xs text-tx-3">{row.preview}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
