import { revokeInvite } from './actions'
import { ClockIcon } from '@/components/brand/icon'

export function PendingInvites({
  invites,
}: { invites: { id: string; email: string; fullName: string | null; role: string; expiresAt: string }[] }) {
  return (
    <section className="space-y-3">
      <h2 className="bg-label flex items-center gap-1.5 text-[0.7rem] text-tx-3">
        <ClockIcon className="size-3.5" /> Waiting to be accepted
      </h2>

      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
        {invites.map(invite => (
          <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-medium">{invite.fullName ?? invite.email}</p>
              <p className="text-xs text-tx-3">
                {invite.email} · {invite.role} · expires{' '}
                {new Date(invite.expiresAt).toLocaleString('en-NG', {
                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
            <form action={revokeInvite}>
              <input type="hidden" name="invite_id" value={invite.id} />
              <button type="submit" className="bg-press rounded-md border border-line px-2.5 py-1 text-xs text-tx-2">
                Withdraw
              </button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  )
}
