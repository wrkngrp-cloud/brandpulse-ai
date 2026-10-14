import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireStaff } from '@/lib/desk/auth'
import { staffPerson } from '@/lib/desk/data'
import { PageHeader } from '@/components/dashboard/page-header'
import { PERMISSION_GROUPS, DATASET_KEYS } from '@/lib/desk/permissions'
import { ArrowLeftIcon, UsersIcon } from '@/components/brand/icon'
import { PermissionRow } from './permission-row'

export const dynamic = 'force-dynamic'

/**
 * One person's access, and what they have done with it.
 *
 * The permission lists are the two axes from section 3.3 of the plan: what
 * they may do, and which datasets a screen may render for them. Each row says
 * where its answer came from, because "why can she see this" needs to be
 * answerable without reading SQL.
 */
export default async function StaffPersonPage({
  params,
}: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const session = await requireStaff('staff.view', {
    action: 'staff.person_view', targetType: 'staff', targetId: userId,
    summary: 'Opened a staff member',
  })

  const person = await staffPerson(session, userId)
  if (!person) notFound()

  const canEdit = session.can('staff.permissions') && person.userId !== session.userId
  const isSuper = person.role === 'super_admin'

  return (
    <div className="space-y-8">
      <div>
        <Link href="/desk/staff" className="bg-press inline-flex items-center gap-1.5 text-xs text-tx-3">
          <ArrowLeftIcon className="size-3.5" /> All staff
        </Link>
      </div>

      <PageHeader
        eyebrow={person.roleLabel}
        title={person.fullName}
        subtitle={[
          person.email,
          person.jobTitle,
          person.status === 'suspended' ? 'Suspended' : null,
        ].filter(Boolean).join(' · ')}
        icon={UsersIcon}
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-card p-4">
          <p className="bg-label text-[0.65rem] text-tx-3">Actions, 7 days</p>
          <p className="bg-num mt-1.5 text-2xl">{person.stats.actions7}</p>
        </div>
        <div className="rounded-xl border border-line bg-card p-4">
          <p className="bg-label text-[0.65rem] text-tx-3">Actions, 30 days</p>
          <p className="bg-num mt-1.5 text-2xl">{person.stats.actions30}</p>
        </div>
        <div className="rounded-xl border border-line bg-card p-4">
          <p className="bg-label text-[0.65rem] text-tx-3">Joined</p>
          <p className="mt-1.5 text-sm">
            {person.joinedAt
              ? new Date(person.joinedAt).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
              : 'Invitation not yet accepted'}
          </p>
          <p className="mt-1 text-xs text-tx-3">{person.timezone}</p>
        </div>
      </section>

      {isSuper && (
        <p className="rounded-xl border border-line bg-shell p-3 text-sm text-tx-2">
          A super admin holds every permission, including any added to the product later.
          Move them to another role to change what they can reach.
        </p>
      )}

      <section className="space-y-5">
        <div>
          <h2 className="bg-label text-[0.7rem] text-tx-3">What they can do</h2>
          <p className="mt-1 text-xs text-tx-3">
            A grant or a deny set here sits on top of the {person.roleLabel} role. A deny
            always wins, so one person can be kept out of one screen without inventing a
            role for them.
          </p>
        </div>

        {PERMISSION_GROUPS.map(group => (
          <div key={group.module} className="overflow-hidden rounded-xl border border-line bg-card">
            <p className="border-b border-line px-4 py-2 text-sm font-medium">{group.module}</p>
            <ul className="divide-y divide-line">
              {group.keys.map(([key, label]) => (
                <PermissionRow
                  key={key}
                  userId={person.userId}
                  permission={key}
                  label={label}
                  state={person.permissions.get(key)!}
                  roleLabel={person.roleLabel}
                  editable={canEdit && !isSuper}
                />
              ))}
            </ul>
          </div>
        ))}

        <div>
          <h2 className="bg-label text-[0.7rem] text-tx-3">What they can see</h2>
          <p className="mt-1 text-xs text-tx-3">
            These gate what a screen renders rather than what it does. Without one, the
            field comes back masked or left out, and the redaction happens in the data
            layer so no screen can show it by accident.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-line bg-card">
          <ul className="divide-y divide-line">
            {DATASET_KEYS.map(([key, label]) => (
              <PermissionRow
                key={key}
                userId={person.userId}
                permission={key}
                label={label}
                state={person.permissions.get(key)!}
                roleLabel={person.roleLabel}
                editable={canEdit && !isSuper}
              />
            ))}
          </ul>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="bg-label text-[0.7rem] text-tx-3">What they have done</h2>
        {person.activity.length === 0 ? (
          <p className="rounded-xl border border-line bg-card p-4 text-sm text-tx-3">
            Nothing recorded yet.
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
            {person.activity.map(row => (
              <li key={row.id} className="flex items-baseline justify-between gap-4 px-4 py-2.5 text-sm">
                <span className="text-tx-2">{row.summary ?? row.action}</span>
                <time className="bg-num shrink-0 text-xs text-tx-3" dateTime={row.createdAt}>
                  {new Date(row.createdAt).toLocaleString('en-NG', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
