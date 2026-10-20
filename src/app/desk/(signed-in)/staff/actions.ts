'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { sendMail } from '@/lib/email/send'
import { requireStaffOrNull, writeAudit } from '@/lib/desk/auth'
import { newInviteToken, inviteExpiry, INVITE_TTL_HOURS } from '@/lib/desk/invites'
import { deskUrl, deskUrlIsAbsolute } from '@/lib/desk/urls'
import { ALL_PERMISSIONS } from '@/lib/desk/permissions'
import { z } from 'zod'

export type StaffActionState = { error?: string; ok?: string } | null

const inviteSchema = z.object({
  email:     z.string().email('Enter a valid email address'),
  full_name: z.string().min(2, 'Enter their name').max(120),
  role:      z.string().min(2).max(40),
})

/**
 * Inviting someone to the Desk.
 *
 * Writes the invitation, then sends the link. If the email is refused the
 * invitation still stands and the page shows it as pending with a button to
 * send again and a button to copy the link, which is better than losing the
 * row and leaving the inviter unsure whether anything happened.
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
  const result = await deliverInvite({ email, fullName: full_name, invitedBy: session.fullName, link })

  revalidatePath('/desk/staff')
  if (result.sent) return { ok: `Invitation sent to ${email}.` }
  return { ok: `Invitation created, but the email did not go out: ${result.reason}. Copy the link below and send it yourself.` }
}

/**
 * The invitation email itself, shared by inviting and re-sending.
 *
 * Separate because the link has to reach the person one way or another: when
 * the send is refused the caller still has the invitation and shows the link on
 * the page, so a missing key or an unverified domain slows the day down instead
 * of stopping it.
 */
async function deliverInvite(
  { email, fullName, invitedBy, link }: { email: string; fullName: string; invitedBy: string; link: string },
) {
  if (!deskUrlIsAbsolute()) {
    return {
      sent: false as const,
      configured: false,
      reason: 'NEXT_PUBLIC_DESK_URL is not set on this deployment, so the link in the email would not open',
    }
  }

  return sendMail({
    from:    'BrandGauge <desk@brandgauge.app>',
    to:      email,
    subject: 'Your BrandGauge Desk access',
    text:
`Hi ${fullName.split(' ')[0]},

${invitedBy} has given you access to the BrandGauge Desk, the tool we use to see how our customers are doing and to answer them.

Set your password and you are in:
${link}

The link works once and expires in ${INVITE_TTL_HOURS} hours. If it runs out, ask ${invitedBy} for a new one.

See you in there.
BrandGauge`,
  })
}

/**
 * Re-sending an invitation.
 *
 * It mints a fresh token rather than mailing the old one, because the old hash
 * is all we hold and the link in the first email may already be in a spam
 * folder somewhere. The clock restarts with it.
 */
export async function resendInvite(_prev: StaffActionState, formData: FormData): Promise<StaffActionState> {
  const session = await requireStaffOrNull('staff.invite')
  if (!session) return { error: 'You do not have permission to invite people.' }

  const id = String(formData.get('invite_id') ?? '')
  if (!id) return { error: 'No invitation to send.' }

  const service = await createServiceClient()
  const { data: invite } = await service
    .from('staff_invites')
    .select('id, email, full_name')
    .eq('id', id)
    .is('accepted_at', null)
    .is('revoked_at', null)
    .maybeSingle()
  if (!invite) return { error: 'That invitation has already been used or withdrawn.' }

  const { token, hash } = newInviteToken()
  const { error: updateError } = await service
    .from('staff_invites')
    .update({ token_hash: hash, expires_at: inviteExpiry() })
    .eq('id', id)
  if (updateError) return { error: 'Could not refresh the invitation.' }

  const link = deskUrl(`/invite/${token}`)
  const result = await deliverInvite({
    email: invite.email,
    fullName: invite.full_name ?? invite.email,
    invitedBy: session.fullName,
    link,
  })

  await writeAudit({
    actorId: session.userId,
    action:  'staff.invite_resent',
    targetType: 'staff_invite',
    targetId:   invite.email,
    summary: `Sent ${invite.email} a fresh invitation link`,
    meta: { delivered: result.sent },
  })

  revalidatePath('/desk/staff')
  if (result.sent) return { ok: `A fresh link is on its way to ${invite.email}.` }
  return { ok: `New link ready, but the email did not go out: ${result.reason}. Copy it below and send it yourself.` }
}

/**
 * The link for an invitation that has to be handed over by another route.
 *
 * The stored hash cannot be reversed, so showing a link means minting a new
 * token, which invalidates whatever went out before. That is the honest trade:
 * one live link per invitation, and the person holding the Desk decides how it
 * travels.
 */
export async function inviteLink(_prev: StaffActionState, formData: FormData): Promise<StaffActionState> {
  const session = await requireStaffOrNull('staff.invite')
  if (!session) return { error: 'You do not have permission to invite people.' }

  const id = String(formData.get('invite_id') ?? '')
  if (!id) return { error: 'No invitation to link.' }

  const service = await createServiceClient()
  const { data: invite } = await service
    .from('staff_invites')
    .select('id, email')
    .eq('id', id)
    .is('accepted_at', null)
    .is('revoked_at', null)
    .maybeSingle()
  if (!invite) return { error: 'That invitation has already been used or withdrawn.' }

  const { token, hash } = newInviteToken()
  const { error: updateError } = await service
    .from('staff_invites')
    .update({ token_hash: hash, expires_at: inviteExpiry() })
    .eq('id', id)
  if (updateError) return { error: 'Could not refresh the invitation.' }

  await writeAudit({
    actorId: session.userId,
    action:  'staff.invite_link_shown',
    targetType: 'staff_invite',
    targetId:   invite.email,
    summary: `Took a fresh invitation link for ${invite.email} to send by hand`,
  })

  revalidatePath('/desk/staff')
  return { ok: deskUrl(`/invite/${token}`) }
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
