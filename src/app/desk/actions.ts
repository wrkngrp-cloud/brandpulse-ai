'use server'

import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getStaffSession, writeAudit, requestIpHash } from '@/lib/desk/auth'
import { deskHref } from '@/lib/desk/urls'
import { hashInviteToken, tokenHashMatches } from '@/lib/desk/invites'
import { z } from 'zod'

export type DeskAuthState = { error?: string; fieldErrors?: Record<string, string[]> } | null

const loginSchema = z.object({
  email:    z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
})

/**
 * Signing in to the Desk.
 *
 * Password only. There is no signup route on this host and no Google button:
 * access is granted by a person, and a form that can create an account would
 * undo that in one click.
 *
 * A successful password is not access. If the address has no active staff row
 * the session is ended again before this returns, so a customer who happens to
 * find the Desk cannot end up signed in on it.
 */
export async function deskLogin(_prev: DeskAuthState, formData: FormData): Promise<DeskAuthState> {
  const parsed = loginSchema.safeParse({
    email:    formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data)

  // One message for a wrong password and for an unknown address, so the form
  // cannot be used to find out who has an account here.
  if (error || !data.user) return { error: 'That email and password do not match.' }

  const { data: staff } = await supabase
    .from('staff')
    .select('user_id, status, full_name')
    .eq('user_id', data.user.id)
    .maybeSingle()

  if (!staff || staff.status !== 'active') {
    await supabase.auth.signOut()
    await writeAudit({
      actorId: data.user.id,
      action:  'desk.signin_refused',
      summary: staff ? 'Suspended staff account tried to sign in' : 'Non-staff account tried to sign in',
    })
    return { error: 'This account does not have access to the Desk.' }
  }

  const service = await createServiceClient()
  await service
    .from('staff')
    .update({ last_seen_at: new Date().toISOString(), last_sign_in_ip_hash: await requestIpHash() })
    .eq('user_id', data.user.id)

  await writeAudit({ actorId: data.user.id, action: 'desk.signin', summary: `${staff.full_name} signed in` })

  const next = formData.get('next')
  redirect(await deskHref(typeof next === 'string' && next.startsWith('/desk') ? next : '/desk'))
}

export async function deskSignOut(): Promise<void> {
  const session = await getStaffSession()
  const supabase = await createClient()
  await supabase.auth.signOut()
  if (session) {
    await writeAudit({ actorId: session.userId, action: 'desk.signout', summary: `${session.fullName} signed out` })
  }
  redirect(await deskHref('/desk/login'))
}

// ── Invitations ──────────────────────────────────────────────────────────────

const acceptSchema = z.object({
  token:     z.string().min(10),
  full_name: z.string().min(2, 'Enter your full name'),
  password:  z.string().min(12, 'Use at least 12 characters'),
  job_title: z.string().max(80).optional(),
  timezone:  z.string().max(64).optional(),
})

/**
 * Accepting an invitation.
 *
 * The token arrives in the clear from the email link and is compared against a
 * stored hash, so the table holds nothing that could be replayed if it leaked.
 * Single use and time limited, which turns a forwarded invite email into a
 * 72-hour window on one address rather than a standing key.
 *
 * An address that already has a BrandGauge account is linked, not re-created,
 * and its password is left exactly as it was. Somebody may be both a customer
 * and staff, and taking over their password would be a hostile thing to do to
 * their other account.
 */
export async function acceptInvite(_prev: DeskAuthState, formData: FormData): Promise<DeskAuthState> {
  const parsed = acceptSchema.safeParse({
    token:     formData.get('token'),
    full_name: formData.get('full_name'),
    password:  formData.get('password'),
    job_title: formData.get('job_title') || undefined,
    timezone:  formData.get('timezone') || undefined,
  })
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }

  const { token, full_name, password, job_title, timezone } = parsed.data
  const service = await createServiceClient()

  const { data: invite } = await service
    .from('staff_invites')
    .select('id, email, role, token_hash, expires_at, accepted_at, revoked_at, invited_by')
    .eq('token_hash', hashInviteToken(token))
    .maybeSingle()

  if (!invite || !tokenHashMatches(invite.token_hash, hashInviteToken(token))) {
    return { error: 'This invitation link is not valid.' }
  }
  if (invite.accepted_at) return { error: 'This invitation has already been used.' }
  if (invite.revoked_at)  return { error: 'This invitation was withdrawn.' }
  if (new Date(invite.expires_at) < new Date()) {
    return { error: 'This invitation has expired. Ask for a new one.' }
  }

  const { data: existingId } = await service.rpc('auth_user_id_for_email', { p_email: invite.email })
  let userId = (existingId as string | null) ?? null
  let createdAccount = false

  if (!userId) {
    const { data: created, error: createError } = await service.auth.admin.createUser({
      email:         invite.email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    })
    if (createError || !created.user) {
      return { error: 'Could not set up this account. Ask for a fresh invitation.' }
    }
    userId = created.user.id
    createdAccount = true
  }

  const { error: staffError } = await service.from('staff').insert({
    user_id:    userId,
    email:      invite.email,
    full_name,
    job_title:  job_title ?? null,
    timezone:   timezone || 'Africa/Lagos',
    role:       invite.role,
    status:     'active',
    invited_by: invite.invited_by,
    joined_at:  new Date().toISOString(),
  })

  // A unique violation here means they already had Desk access. Treat that as
  // done rather than as a failure, and let the invite close.
  if (staffError && staffError.code !== '23505') {
    return { error: 'Could not finish setting up this account.' }
  }

  await service
    .from('staff_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)

  await writeAudit({
    actorId: userId,
    action:  'staff.invite_accepted',
    targetType: 'staff',
    targetId:   userId,
    summary: `${full_name} accepted an invitation on the ${invite.role} role`,
  })

  // A brand new account can be signed straight in, because the password in
  // front of us is the one just set. A linked account cannot: we never knew
  // their password and are not about to ask for it here.
  if (createdAccount) {
    const supabase = await createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: invite.email, password,
    })
    if (!signInError) redirect(await deskHref('/desk'))
  }

  redirect(await deskHref('/desk/login?accepted=1'))
}
