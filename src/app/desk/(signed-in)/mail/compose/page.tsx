import { requireStaff } from '@/lib/desk/auth'
import { myMailboxAddresses, getDraftById } from '@/lib/desk/mail'
import { signMailAttachment } from '@/lib/support/attachments'
import { ComposeClient, type ComposeInitial } from '../compose-client'

export const dynamic = 'force-dynamic'

export default async function MailComposePage({
  searchParams,
}: { searchParams: Promise<{ draft?: string }> }) {
  const session = await requireStaff('mail.use')
  const addresses = await myMailboxAddresses(session)
  if (!addresses.length) {
    return <p className="rounded-xl border border-line bg-card p-4 text-sm text-tx-3">No mailbox is set up for you yet.</p>
  }

  const { draft: draftId } = await searchParams
  const draft = draftId ? await getDraftById(session.userId, draftId) : null

  const initial: ComposeInitial = draft
    ? {
        draftId: draft.id, fromAddress: draft.fromAddress, to: draft.toAddress ?? '',
        cc: draft.cc, bcc: draft.bcc, subject: draft.subject ?? '', body: draft.body,
        // Re-signed here rather than stored: a draft row never holds a
        // signature (saveDraft strips it, same as a sent message), and the
        // signer is deterministic, so this reproduces exactly what a fresh
        // upload would have produced for the same file.
        attachments: draft.attachments.map(a => ({ ...a, signature: signMailAttachment(session.userId, a) })),
      }
    : { fromAddress: addresses[0] }

  return (
    <div className="space-y-4">
      <h1 className="text-base font-bold">New message</h1>
      <ComposeClient fromAddresses={addresses} initial={initial} />
    </div>
  )
}
