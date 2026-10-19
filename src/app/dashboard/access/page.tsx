import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { sessionsForCustomer, SESSION_MINUTES } from '@/lib/desk/impersonation'
import { decideImpersonation, endImpersonation } from '@/lib/desk/impersonation-actions'
import { PageHeader } from '@/components/dashboard/page-header'
import { ShieldIcon } from '@/components/brand/icon'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Account access | BrandGauge' }

/**
 * Who from BrandGauge has looked at this account.
 *
 * The customer's side of impersonation. They answer requests here and they can
 * read the whole history: who looked, when, why, who approved it and how many
 * pages they opened. That list is the part that makes the feature honest, so
 * it is shown to them and not only to us.
 */
export default async function AccessPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // The workspace comes through RLS, so this is their own either way.
  const { data: brand } = await supabase.from('brands').select('workspace_id').limit(1).maybeSingle()
  if (!brand) redirect('/onboarding')

  const { data: membership } = await supabase
    .from('workspace_members').select('role').eq('user_id', user.id).maybeSingle()
  const canDecide = membership && ['owner', 'admin'].includes(membership.role)

  const sessions = await sessionsForCustomer(brand.workspace_id)
  const pending  = sessions.filter(s => s.status === 'pending')
  const live     = sessions.filter(s => s.status === 'approved' || s.status === 'active')
  const past     = sessions.filter(s => !['pending', 'approved', 'active'].includes(s.status))

  const when = (iso: string) => new Date(iso).toLocaleString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Settings"
        title="Account access"
        subtitle="Nobody at BrandGauge can open your account without asking you first."
        icon={ShieldIcon}
      />

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="bg-label text-[0.7rem] text-tx-3">Waiting for your answer</h2>
          {pending.map(request => (
            <div key={request.id} className="rounded-xl border border-line bg-card p-4">
              <p className="text-sm">
                <span className="font-medium">{request.staffName}</span> is asking to view your
                account.
              </p>
              <p className="mt-2 rounded-xl border border-line bg-shell p-3 text-sm text-tx-2">
                {request.reason}
              </p>
              <p className="mt-2 text-xs text-tx-3">
                If you approve, they get a read-only view for {SESSION_MINUTES} minutes. They
                cannot change anything, you can end it at any time, and every page they open is
                recorded below. Asked {when(request.createdAt)}.
              </p>

              {canDecide ? (
                <div className="mt-3 flex gap-2">
                  <form action={decideImpersonation}>
                    <input type="hidden" name="session_id" value={request.id} />
                    <input type="hidden" name="decision" value="approve" />
                    <button type="submit" className="bg-press rounded-md bg-flare px-3 py-1.5 text-xs font-medium text-on-hot">
                      Approve for {SESSION_MINUTES} minutes
                    </button>
                  </form>
                  <form action={decideImpersonation}>
                    <input type="hidden" name="session_id" value={request.id} />
                    <input type="hidden" name="decision" value="decline" />
                    <button type="submit" className="bg-press rounded-md border border-line px-3 py-1.5 text-xs">
                      Decline
                    </button>
                  </form>
                </div>
              ) : (
                <p className="mt-3 text-xs text-tx-3">
                  Only an owner or admin on this workspace can answer this.
                </p>
              )}
            </div>
          ))}
        </section>
      )}

      {live.length > 0 && (
        <section className="space-y-3">
          <h2 className="bg-label text-[0.7rem] text-tx-3">Happening now</h2>
          {live.map(active => (
            <div key={active.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-card p-4">
              <p className="text-sm">
                <span className="font-medium">{active.staffName}</span> is viewing your account.
                {active.expiresAt && ` It ends automatically at ${when(active.expiresAt)}.`}
              </p>
              <form action={endImpersonation}>
                <input type="hidden" name="session_id" value={active.id} />
                <input type="hidden" name="ended_by" value="customer" />
                <button type="submit" className="bg-press rounded-md border border-line px-3 py-1.5 text-xs">
                  End it now
                </button>
              </form>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="bg-label text-[0.7rem] text-tx-3">History</h2>
        {past.length === 0 ? (
          <p className="rounded-xl border border-line bg-card p-4 text-sm text-tx-3">
            Nobody from BrandGauge has viewed this account.
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
            {past.map(row => (
              <li key={row.id} className="px-4 py-3">
                <p className="text-sm">
                  {row.staffName} · {row.status === 'declined' ? 'you declined' : 'viewed'}
                  {row.status !== 'declined' && ` ${row.pagesViewed} ${row.pagesViewed === 1 ? 'page' : 'pages'}`}
                </p>
                <p className="mt-0.5 text-xs text-tx-3">
                  {row.reason}
                </p>
                <p className="mt-0.5 text-xs text-tx-3">
                  Asked {when(row.createdAt)}
                  {row.endedAt && ` · ended ${when(row.endedAt)}`}
                  {row.endedBy && ` by ${row.endedBy === 'expiry' ? 'the clock' : row.endedBy}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
