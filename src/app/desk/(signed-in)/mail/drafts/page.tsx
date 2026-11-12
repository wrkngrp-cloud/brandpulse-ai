import Link from 'next/link'
import { requireStaff } from '@/lib/desk/auth'
import { deskHref } from '@/lib/desk/urls'
import { myMailboxAddresses, draftsList } from '@/lib/desk/mail'
import { MailTabs } from '../mail-tabs'
import { deleteDraft } from '../actions'

export const dynamic = 'force-dynamic'

/** A reply draft opens back into its thread (?draft=1 asks the reply box to
 *  prefill); a fresh-compose draft opens the compose page with its id, so
 *  either kind picks up exactly where it was left. */
export default async function MailDraftsPage() {
  const session = await requireStaff('mail.use')
  const addresses = await myMailboxAddresses(session)
  if (!addresses.length) return null

  const drafts = await draftsList(session.userId)
  const base = await deskHref('/desk/mail')

  return (
    <div className="space-y-4">
      <h1 className="text-base font-bold">Mail</h1>
      <MailTabs base={base} active="drafts" draftCount={drafts.length} />

      {drafts.length === 0 ? (
        <p className="rounded-xl border border-line bg-card p-4 text-sm text-tx-3">No drafts.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
          {drafts.map(draft => (
            <li key={draft.id} className="flex items-center gap-2 px-3 py-2.5">
              <Link
                href={draft.conversationId ? `${base}/${draft.conversationId}?draft=1` : `${base}/compose?draft=${draft.id}`}
                className="bg-press min-w-0 flex-1"
              >
                <p className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium">To {draft.displayTo ?? 'No recipient yet'}</span>
                  <time className="bg-num shrink-0 text-[0.65rem] text-tx-3" dateTime={draft.updatedAt}>
                    {new Date(draft.updatedAt).toLocaleDateString('en-NG', { day: '2-digit', month: 'short' })}
                  </time>
                </p>
                <p className="truncate text-xs text-tx-2">{draft.subject ?? 'No subject'}</p>
                <p className="truncate text-xs text-tx-3">{draft.preview || 'Empty draft'}</p>
              </Link>
              <form action={deleteDraft}>
                <input type="hidden" name="draft_id" value={draft.id} />
                <button type="submit" className="bg-press shrink-0 rounded-md border border-line px-2 py-1 text-xs text-neg">
                  Delete
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
