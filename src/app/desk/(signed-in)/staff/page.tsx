import { requireStaff } from '@/lib/desk/auth'
import { staffRoster } from '@/lib/desk/data'
import { PageHeader } from '@/components/dashboard/page-header'
import { UsersIcon } from '@/components/brand/icon'
import { InviteForm } from './invite-form'
import { StaffTable } from './staff-table'
import { PendingInvites } from './pending-invites'

export const dynamic = 'force-dynamic'

/**
 * Super admin: who may use the Desk.
 *
 * The one screen that hands out access, so it is also the one screen where the
 * refusals matter most. They live in the actions rather than here: a hidden
 * button is a courtesy, and the server is the rule.
 */
export default async function StaffPage() {
  const session = await requireStaff('staff.view', {
    action: 'staff.roster_view', summary: 'Opened the staff roster',
  })

  const { staff, invites, roles } = await staffRoster(session)
  const activeCount = staff.filter(s => s.status === 'active').length

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Super admin"
        title="Staff"
        subtitle={`${activeCount} ${activeCount === 1 ? 'person has' : 'people have'} access to the Desk.`}
        icon={UsersIcon}
      />

      {session.can('staff.invite') && <InviteForm roles={roles} />}

      {invites.length > 0 && session.can('staff.invite') && (
        <PendingInvites invites={invites} />
      )}

      <StaffTable
        rows={staff}
        roles={roles}
        currentUserId={session.userId}
        canChangeRoles={session.can('staff.permissions')}
        canRevoke={session.can('staff.revoke')}
      />
    </div>
  )
}
