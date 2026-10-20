'use client'

import { useState, useTransition } from 'react'
import { revokeInvite, resendInvite, inviteLink } from './actions'
import { ClockIcon } from '@/components/brand/icon'

type Invite = { id: string; email: string; fullName: string | null; role: string; expiresAt: string }

/**
 * Invitations that have gone out and not been accepted.
 *
 * Two buttons beyond withdrawing, because an email that does not arrive is the
 * common case and not an exception: spam filters, an unverified sending domain,
 * a typo in the address. "Send again" mints a fresh link and mails it. "Get
 * link" mints one and shows it, for handing over on WhatsApp or in person.
 * Either way the invitation has exactly one live link, and the page says which
 * it is.
 */
export function PendingInvites({ invites, canSend }: { invites: Invite[]; canSend: boolean }) {
  const [pending, startTransition] = useTransition()
  const [notice, setNotice] = useState<{ id: string; text: string; link?: string } | null>(null)

  const run = (
    id: string,
    action: (prev: null, data: FormData) => Promise<{ error?: string; ok?: string } | null>,
    asLink: boolean,
  ) => {
    const data = new FormData()
    data.set('invite_id', id)
    startTransition(async () => {
      const result = await action(null, data)
      if (!result) return
      if (result.error) return setNotice({ id, text: result.error })
      if (asLink && result.ok) return setNotice({ id, text: 'This is the only live link for this invitation.', link: result.ok })
      setNotice({ id, text: result.ok ?? '' })
    })
  }

  return (
    <section className="space-y-3">
      <h2 className="bg-label flex items-center gap-1.5 text-[0.7rem] text-tx-3">
        <ClockIcon className="size-3.5" /> Waiting to be accepted
      </h2>

      {!canSend && (
        <p className="rounded-md border border-line bg-shell px-3 py-2 text-xs text-tx-2">
          No email key is set on this deployment, so invitations cannot be mailed. Use Get link and
          send it yourself.
        </p>
      )}

      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
        {invites.map(invite => (
          <li key={invite.id} className="px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{invite.fullName ?? invite.email}</p>
                <p className="text-xs text-tx-3">
                  {invite.email} · {invite.role} · expires{' '}
                  {new Date(invite.expiresAt).toLocaleString('en-NG', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(invite.id, resendInvite, false)}
                  className="bg-press rounded-md border border-line px-2.5 py-1 text-xs text-tx-2 disabled:opacity-50"
                >
                  Send again
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(invite.id, inviteLink, true)}
                  className="bg-press rounded-md border border-line px-2.5 py-1 text-xs text-tx-2 disabled:opacity-50"
                >
                  Get link
                </button>
                <form action={revokeInvite}>
                  <input type="hidden" name="invite_id" value={invite.id} />
                  <button type="submit" className="bg-press rounded-md border border-line px-2.5 py-1 text-xs text-tx-2">
                    Withdraw
                  </button>
                </form>
              </div>
            </div>

            {notice?.id === invite.id && (
              <div className="mt-3 space-y-2 border-t border-line pt-3">
                <p className="text-xs text-tx-2">{notice.text}</p>
                {notice.link && (
                  <input
                    readOnly
                    value={notice.link}
                    onFocus={event => event.currentTarget.select()}
                    className="w-full rounded-md border border-line bg-shell px-2.5 py-1.5 text-xs text-tx-2"
                  />
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
