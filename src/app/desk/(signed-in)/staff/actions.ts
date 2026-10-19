'use server'

import { revalidatePath } from 'next/cache'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaffOrNull, writeAudit } from '@/lib/desk/auth'
import { newInviteToken, inviteExpiry, INVITE_TTL_HOURS } from '@/lib/desk/invites'
import { deskUrl } from '@/lib/desk/urls'
import { ALL_PERMISSIONS } from '@/lib/desk/permissions'
import { z } from 'zod'

export type StaffActionState = { error?: string; ok?: string } | null

let resend: Resend | null = null
const getResend = () => (resend ??= new Resend(process.env.RESEND_API_KEY))

const inviteSchema = z.object({
  email:     z.string().email('Enter a valid email address'),
  full_name: z.string().min(2, 'Enter their name').max(120),
  role:      z.string().min(2).max(40),
})

/**
 * Inviting someone to the Desk.
 *
 * Writes the invitation, then sends the link. If the email fails to send the
 * invitation still exists and the page shows it as pending with a resend
 * button, which is better than losing the row and leaving the inviter unsure
 * whether anything happened.
 */
export async function inviteStaff(_prev: StaffActionState, formData: FormData): Promise<StaffActionState> {
  const session = await requireStaffOrNull('staff.invite')
  if (!session) return { error: 'You do not have permission to invite people.' }

  const parsed = inviteSchema.safeParse({
    email:     formData.get('email'),
    full_name: formData.get('full_name'),
    role:      formData.get('role'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { email, full_name, role } = parsed.data
  const service = await createServiceClient()

  const { data: roleRow } = await service
    .from('staff_roles').select('name').eq('name', role).maybeSingle()
  if (!roleRow) return { error: 'That role does not exist.' }

  const { data: already } = await service
    .from('staff').select('user_id, status').ilike('email', email).maybeSingle()
  if (already) {
    return already.status === 'active'
      ? { error: 'That address already has Desk access.' }
      : { error: 'That address is suspended. Reactivate it instead of inviting again.' }
  }

  const { token, hash } = newInviteToken()
  const { error: insertError } = await service.from('staff_invites').insert({
    email, full_name, role,
    token_hash: hash,
    invited_by: session.userId,
    expires_at: inviteExpiry(),
  })
  if (insertError) return { error: 'Could not create the invitation.' }

  await writeAudit({
    actorId: session.userId,
    action:  'staff.invite',
    targetType: 'staff_invite',
    targetId:   email,
    summary: `Invited ${email} on the ${role} role`,
    meta: { role },
  })

  const link = deskUrl(`/invite/${token}`)

  if (!process.env.RESEND_API_KEY) {
    revalidatePath('/desk/staff')
    return { ok: `Invitation created. No email key is set, so send this link yourself: ${link}` }
  }

  try {
    await getResend().emails.send({
      from:    'BrandGauge <desk@brandgauge.app>',
      to:      email,
      subject: 'Your BrandGauge Desk access',
      text:
`Hi ${full_name.split(' ')[0]},

${session.fullName} has given you access to the BrandGauge Desk, the tool we use to see how our customers are doing and to answer them.

Set your password and you are in:
${link}

The link works once and expires in ${INVITE_TTL_HOURS} hours. If it runs out, ask ${session.fullName} for a new one.

See you in there.
BrandGauge`,
    })
  } catch {
    revalidatePath('/desk/staff')
    return { ok: `Invitation created, but the email did not send. Send this link yourself: ${link}` }
  }

  revalidatePath('/desk/staff')
  return { ok: `Invitation sent to ${email}.` }
}

export async function revokeInvite(formData: FormData): Promise<void> {
  const session = await requireStaffOrNull('staff.invite')
  if (!session) return
  const id = String(formData.get('invite_id') ?? '')
  if (!id) return

  const service = await createServiceClient()
  await service.from('staff_invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id).is('accepted_at', null)

  await writeAudit({
    actorId: session.userId, action: 'staff.invite_revoked',
    targetType: 'staff_invite', targetId: id, summary: 'Withdrew an invitation',
  })
  revalidatePath('/desk/staff')
}

/**
 * Suspending, reactivating and removing.
 *
 * Suspend is the one to reach for the day somebody leaves: access stops on
 * their next request and their history and threads stay attached to them.
 * Remove is for an invitation that should not have happened.
 *
 * Two refusals here rather than in the UI, because a disabled button is not a
 * rule: nobody can act on their own row, so the last super admin cannot lock
 * everyone out by accident, and the final super admin cannot be stood down at
 * all.
 */
export async function setStaffStatus(formData: FormData): Promise<void> {
  const session = await requireStaffOrNull('staff.revoke')
  if (!session) return

  const userId = String(formData.get('user_id') ?? '')
  const status  = String(formData.get('status') ?? '')
  if (!userId || !['active', 'suspended'].includes(status)) return
  if (userId === session.userId) return

  const service = await createServiceClient()
  const { data: target } = await service
    .from('staff').select('full_name, role').eq('user_id', userId).maybeSingle()
  if (!target) return

  if (status === 'suspended' && target.role === 'super_admin' && await isLastSuperAdmin(userId)) return

  await service.from('staff').update({ status }).eq('user_id', userId)
  await writeAudit({
    actorId: session.userId,
    action:  status === 'suspended' ? 'staff.suspended' : 'staff.reactivated',
    targetType: 'staff', targetId: userId,
    summary: `${status === 'suspended' ? 'Suspended' : 'Reactivated'} ${target.full_name}`,
  })
  revalidatePath('/desk/staff')
}

export async function removeStaff(formData: FormData): Promise<void> {
  const session = await requireStaffOrNull('staff.revoke')
  if (!session) return

  const userId = String(formData.get('user_id') ?? '')
  if (!userId || userId === session.userId) return

  const service = await createServiceClient()
  const { data: target } = await service
    .from('staff').select('full_name, role').eq('user_id', userId).maybeSingle()
  if (!target) return
  if (target.role === 'super_admin' && await isLastSuperAdmin(userId)) return

  // Only the Desk access goes. The underlying account is left alone: it may
  // also be a customer's, and their audit trail stays readable either way
  // because it is keyed on the user id rather than on this row.
  await service.from('staff').delete().eq('user_id', userId)
  await writeAudit({
    actorId: session.userId, action: 'staff.removed',
    targetType: 'staff', targetId: userId,
    summary: `Removed ${target.full_name} from the Desk`,
  })
  revalidatePath('/desk/staff')
}

export async function setStaffRole(formData: FormData): Promise<void> {
  const session = await requireStaffOrNull('staff.permissions')
  if (!session) return

  const userId = String(formData.get('user_id') ?? '')
  const role   = String(formData.get('role') ?? '')
  if (!userId || !role || userId === session.userId) return

  const service = await createServiceClient()
  const { data: roleRow } = await service
    .from('staff_roles').select('name').eq('name', role).maybeSingle()
  if (!roleRow) return

  const { data: target } = await service
    .from('staff').select('full_name, role').eq('user_id', userId).maybeSingle()
  if (!target) return
  if (target.role === 'super_admin' && role !== 'super_admin' && await isLastSuperAdmin(userId)) return

  await service.from('staff').update({ role }).eq('user_id', userId)
  await writeAudit({
    actorId: session.userId, action: 'staff.role_changed',
    targetType: 'staff', targetId: userId,
    summary: `Moved ${target.full_name} from ${target.role} to ${role}`,
    meta: { from: target.role, to: role },
  })
  revalidatePath('/desk/staff')
}

/** One key, for one person, on top of their role. A deny beats a grant. */
export async function setPermissionOverride(formData: FormData): Promise<void> {
  const session = await requireStaffOrNull('staff.permissions')
  if (!session) return

  const userId     = String(formData.get('user_id') ?? '')
  const permission = String(formData.get('permission') ?? '')
  const effect     = String(formData.get('effect') ?? '')
  if (!userId || !ALL_PERMISSIONS.includes(permission)) return
  if (userId === session.userId) return

  const service = await createServiceClient()

  if (effect === 'inherit') {
    await service.from('staff_permission_overrides')
      .delete().eq('user_id', userId).eq('permission', permission)
  } else if (effect === 'grant' || effect === 'deny') {
    await service.from('staff_permission_overrides').upsert({
      user_id: userId, permission, effect, set_by: session.userId,
      set_at: new Date().toISOString(),
    }, { onConflict: 'user_id,permission' })
  } else {
    return
  }

  await writeAudit({
    actorId: session.userId, action: 'staff.permission_override',
    targetType: 'staff', targetId: userId,
    summary: `Set ${permission} to ${effect}`,
    meta: { permission, effect },
  })
  revalidatePath(`/desk/staff/${userId}`)
  revalidatePath('/desk/staff')
}

async function isLastSuperAdmin(userId: string): Promise<boolean> {
  const service = await createServiceClient()
  const { data } = await service
    .from('staff')
    .select('user_id')
    .eq('role', 'super_admin')
    .eq('status', 'active')
  const actives = (data ?? []).map(r => r.user_id)
  return actives.length <= 1 && actives.includes(userId)
}
