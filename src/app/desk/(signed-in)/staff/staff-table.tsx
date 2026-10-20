import { setStaffRole, setStaffStatus, removeStaff } from './actions'
import { ShieldIcon } from '@/components/brand/icon'
import type { StaffRow } from '@/lib/desk/data'
import { cn } from '@/lib/utils'
import { DeskLink } from '@/components/desk/desk-link'

function relative(iso: string | null): string {
  if (!iso) return 'never'
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 5)    return 'now'
  if (mins < 60)   return `${mins}m ago`
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`
  return `${Math.round(mins / 1440)}d ago`
}

/**
 * The roster.
 *
 * Nobody can act on their own row. That is enforced in the actions, and the
 * row says so rather than showing a button that would quietly do nothing: the
 * last super admin locking themselves out is the failure this prevents, and it
 * should be explained where it would otherwise be confusing.
 */
export function StaffTable({
  rows, roles, currentUserId, canChangeRoles, canRevoke,
}: {
  rows: StaffRow[]
  roles: { name: string; label: string }[]
  currentUserId: string
  canChangeRoles: boolean
  canRevoke: boolean
}) {
  return (
    <section className="space-y-3">
      <h2 className="bg-label text-[0.7rem] text-tx-3">The roster</h2>

      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
        {rows.map(row => {
          const isSelf = row.userId === currentUserId
          return (
            <li key={row.userId} className="flex flex-wrap items-center gap-4 px-4 py-3">
              <div className="min-w-48 flex-1">
                <DeskLink href={`/desk/staff/${row.userId}`} className="bg-press flex items-center gap-2 text-sm font-medium">
                  {row.fullName}
                  {row.role === 'super_admin' && <ShieldIcon className="size-3.5 text-tx-3" />}
                  {isSelf && <span className="bg-label text-[0.6rem] text-tx-3">You</span>}
                </DeskLink>
                <p className="text-xs text-tx-3">
                  {row.email}
                  {row.jobTitle ? ` · ${row.jobTitle}` : ''}
                  {row.overrides > 0
                    ? ` · ${row.overrides} permission ${row.overrides === 1 ? 'override' : 'overrides'}`
                    : ''}
                </p>
              </div>

              <div className="w-28 text-xs">
                <p className={cn(row.status === 'active' ? 'text-tx-2' : 'text-neg')}>
                  {row.status === 'active' ? 'Active' : 'Suspended'}
                </p>
                <p className="text-tx-3">seen {relative(row.lastSeenAt)}</p>
              </div>

              {canChangeRoles && !isSelf ? (
                <form action={setStaffRole} className="flex items-center gap-2">
                  <input type="hidden" name="user_id" value={row.userId} />
                  <select
                    name="role" defaultValue={row.role}
                    className="h-8 rounded-md border border-line bg-paper px-2 text-xs"
                  >
                    {roles.map(r => <option key={r.name} value={r.name}>{r.label}</option>)}
                  </select>
                  <button type="submit" className="bg-press rounded-md border border-line px-2 py-1 text-xs text-tx-2">
                    Save
                  </button>
                </form>
              ) : (
                <p className="w-44 text-xs text-tx-2">{row.roleLabel}</p>
              )}

              {canRevoke && !isSelf && (
                <div className="flex items-center gap-2">
                  <form action={setStaffStatus}>
                    <input type="hidden" name="user_id" value={row.userId} />
                    <input type="hidden" name="status" value={row.status === 'active' ? 'suspended' : 'active'} />
                    <button type="submit" className="bg-press rounded-md border border-line px-2.5 py-1 text-xs text-tx-2">
                      {row.status === 'active' ? 'Suspend' : 'Reactivate'}
                    </button>
                  </form>
                  <form action={removeStaff}>
                    <input type="hidden" name="user_id" value={row.userId} />
                    <button type="submit" className="bg-press rounded-md border border-line px-2.5 py-1 text-xs text-neg">
                      Remove
                    </button>
                  </form>
                </div>
              )}

              {isSelf && (
                <p className="text-xs text-tx-3">
                  You cannot change your own access.
                </p>
              )}
            </li>
          )
        })}
      </ul>

      <p className="text-xs text-tx-3">
        Suspending stops access on the next request and keeps their history and their
        threads. Removing takes away Desk access and leaves the person&apos;s own BrandGauge
        account alone.
      </p>
    </section>
  )
}
