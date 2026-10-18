'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireStaffOrNull, writeAudit } from './auth'
import { SESSION_MINUTES, endSession } from './impersonation'
import { z } from 'zod'

export type ImpersonationState = { error?: string; ok?: string } | null

const requestSchema = z.object({
  workspace_id: z.string().uuid(),
  reason:       z.string().trim().min(10, 'Say why, in a sentence the customer will read').max(400),
  conversation_id: z.string().uuid().optional(),
})

/**
 * Asking to look.
 *
 * The reason is not optional and it is not for us: the customer reads it
 * verbatim when deciding. A request with no reason is refused, which is the
 * cheapest way to stop this becoming a button somebody clicks out of habit.
 */
export async function requestImpersonation(
  _prev: ImpersonationState, formData: FormData,
): Promise<ImpersonationState> {
  const session = await requireStaffOrNull('accounts.impersonate')
  if (!session) return { error: 'You do not have permission to request access.' }

  const parsed = requestSchema.safeParse({
    workspace_id: formData.get('workspace_id'),
    reason:       formData.get('reason'),
    conversation_id: formData.get('conversation_id') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const service = await createServiceClient()

  const { data: workspace } = await service
    .from('workspaces').select('id, name').eq('id', parsed.data.workspace_id).maybeSingle()
  if (!workspace) return { error: 'That account does not exist.' }

  // Somebody has to be able to approve it. A workspace with no owner or admin
  // cannot consent, so there is nothing to ask and the session is refused
  // rather than left pending forever.
  const { data: approvers } = await service
    .from('workspace_members')
    .select('user_id, role')
    .eq('workspace_id', parsed.data.workspace_id)
    .in('role', ['owner', 'admin'])

  if (!approvers?.length) {
    return { error: 'Nobody on this account can approve a request. It has no owner or admin.' }
  }

  // One outstanding request at a time, per staff member per account.
  const { data: existing } = await service
    .from('impersonation_sessions')
    .select('id')
    .eq('staff_id', session.userId)
    .eq('workspace_id', parsed.data.workspace_id)
    .in('status', ['pending', 'approved', 'active'])
    .maybeSingle()
  if (existing) return { error: 'You already have a request open on this account.' }

  const { data: created, error } = await service.from('impersonation_sessions').insert({
    staff_id:        session.userId,
    workspace_id:    parsed.data.workspace_id,
    conversation_id: parsed.data.conversation_id ?? null,
    reason:          parsed.data.reason,
    status:          'pending',
  }).select('id').single()

  if (error || !created) return { error: 'Could not send that request.' }

  // The customer is told in two places: the bell, and the thread it came out
  // of if it came out of one.
  const { data: brands } = await service
    .from('brands').select('id').eq('workspace_id', parsed.data.workspace_id).limit(1)

  if (brands?.[0]) {
    await service.from('notifications').insert({
      brand_id: brands[0].id,
      type:     'access_request',
      title:    `${session.fullName} is asking to view your account`,
      body:     `${parsed.data.reason} Access is read-only and lasts ${SESSION_MINUTES} minutes. Nothing happens unless you approve it.`,
      href:     '/dashboard/access',
    })
  }

  if (parsed.data.conversation_id) {
    await service.from('support_messages').insert({
      conversation_id: parsed.data.conversation_id,
      author_type: 'system',
      body: `${session.fullName} asked to view your account, read-only, for ${SESSION_MINUTES} minutes. Reason: ${parsed.data.reason} You can approve or decline it under Account access in your dashboard.`,
    })
  }

  await writeAudit({
    actorId: session.userId, action: 'impersonation.requested',
    targetType: 'workspace', targetId: parsed.data.workspace_id,
    workspaceId: parsed.data.workspace_id,
    summary: `Asked to view ${workspace.name}`,
    meta: { reason: parsed.data.reason },
  })

  revalidatePath(`/desk/accounts/${parsed.data.workspace_id}`)
  return { ok: 'Request sent. Nothing happens until they approve it.' }
}

/**
 * The customer answering.
 *
 * Runs as the customer, and the approval is what creates the access: the staff
 * member is added to workspace_members on the viewer role for the length of
 * the session, so the product's own row-level security does the scoping and no
 * read path had to be rewritten for this feature. Read-only is enforced
 * separately, in the middleware, because nothing in this schema makes 'viewer'
 * read-only.
 */
export async function decideImpersonation(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const sessionId = String(formData.get('session_id') ?? '')
  const decision  = String(formData.get('decision') ?? '')
  if (!sessionId || !['approve', 'decline'].includes(decision)) return

  const service = await createServiceClient()

  const { data: row } = await service
    .from('impersonation_sessions')
    .select('id, staff_id, workspace_id, status')
    .eq('id', sessionId)
    .maybeSingle()
  if (!row || row.status !== 'pending') return

  // Only an owner or an admin of that workspace, checked here rather than
  // trusted from the form.
  const { data: membership } = await service
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', row.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership || !['owner', 'admin'].includes(membership.role)) return

  if (decision === 'decline') {
    await service.from('impersonation_sessions').update({
      status: 'declined', approved_by: user.id, approved_at: new Date().toISOString(),
    }).eq('id', sessionId)

    await writeAudit({
      actorId: user.id, action: 'impersonation.declined',
      targetType: 'impersonation', targetId: sessionId,
      workspaceId: row.workspace_id, summary: 'A customer declined an access request',
    })
    revalidatePath('/dashboard/access')
    return
  }

  const expiresAt = new Date(Date.now() + SESSION_MINUTES * 60 * 1000).toISOString()

  // The membership is the access. Granted here, removed by end_impersonation.
  const { error: memberError } = await service.from('workspace_members').insert({
    workspace_id: row.workspace_id,
    user_id:      row.staff_id,
    role:         'viewer',
  })

  await service.from('impersonation_sessions').update({
    status:      'approved',
    approved_by: user.id,
    approved_at: new Date().toISOString(),
    expires_at:  expiresAt,
    // If the membership insert failed the session is still approved, but
    // nothing was granted, and this column says so rather than leaving a sweep
    // to delete a row that was never there.
    membership_granted: !memberError,
  }).eq('id', sessionId)

  await writeAudit({
    actorId: user.id, action: 'impersonation.approved',
    targetType: 'impersonation', targetId: sessionId,
    workspaceId: row.workspace_id,
    summary: `A customer approved read-only access for ${SESSION_MINUTES} minutes`,
    meta: { expires_at: expiresAt, membership_granted: !memberError },
  })

  revalidatePath('/dashboard/access')
}

/** Either side can stop it at any time. */
export async function endImpersonation(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const sessionId = String(formData.get('session_id') ?? '')
  const by = String(formData.get('ended_by') ?? 'customer')
  if (!sessionId) return

  // end_impersonation checks for itself that the caller is the staff member
  // inside the session, a member of the workspace, or the service role.
  await endSession(sessionId, by === 'staff' ? 'staff' : 'customer', user.id)

  revalidatePath('/dashboard/access')
  revalidatePath('/dashboard')
}
