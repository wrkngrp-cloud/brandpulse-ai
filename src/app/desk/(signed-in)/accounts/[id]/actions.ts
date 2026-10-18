'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaffOrNull, writeAudit } from '@/lib/desk/auth'
import { z } from 'zod'

export type AccountActionState = { error?: string; ok?: string } | null

const noteSchema = z.object({
  workspace_id: z.string().uuid(),
  body:         z.string().trim().min(1, 'Write something').max(4000),
})

export async function addAccountNote(
  _prev: AccountActionState, formData: FormData,
): Promise<AccountActionState> {
  const session = await requireStaffOrNull('accounts.note')
  if (!session) return { error: 'You do not have permission to add notes.' }

  const parsed = noteSchema.safeParse({
    workspace_id: formData.get('workspace_id'),
    body:         formData.get('body'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const service = await createServiceClient()
  const { error } = await service.from('staff_notes').insert({
    workspace_id: parsed.data.workspace_id,
    author_id:    session.userId,
    body:         parsed.data.body,
  })
  if (error) return { error: 'Could not save that note.' }

  await writeAudit({
    actorId: session.userId, action: 'accounts.note',
    targetType: 'workspace', targetId: parsed.data.workspace_id,
    workspaceId: parsed.data.workspace_id,
    summary: 'Added a note to an account',
  })

  revalidatePath(`/desk/accounts/${parsed.data.workspace_id}`)
  return { ok: 'Note saved.' }
}

const PLANS = ['starter', 'growth', 'pro', 'agency', 'enterprise']

/**
 * Changing a plan.
 *
 * The one write on this screen that the customer feels, so it is behind its own
 * permission and it records what it changed from as well as to. Billing is
 * deferred, so this moves what the product enforces and not what anybody is
 * charged; the audit line says as much.
 */
export async function changePlan(formData: FormData): Promise<void> {
  const session = await requireStaffOrNull('accounts.plan_change')
  if (!session) return

  const workspaceId = String(formData.get('workspace_id') ?? '')
  const plan        = String(formData.get('plan') ?? '')
  if (!workspaceId || !PLANS.includes(plan)) return

  const service = await createServiceClient()
  const { data: before } = await service
    .from('workspaces').select('name, plan').eq('id', workspaceId).maybeSingle()
  if (!before || before.plan === plan) return

  await service.from('workspaces').update({ plan }).eq('id', workspaceId)

  await writeAudit({
    actorId: session.userId, action: 'accounts.plan_change',
    targetType: 'workspace', targetId: workspaceId, workspaceId,
    summary: `Moved ${before.name} from ${before.plan} to ${plan}`,
    meta: { from: before.plan, to: plan, billing: 'not charged, billing is deferred' },
  })

  revalidatePath(`/desk/accounts/${workspaceId}`)
  revalidatePath('/desk/accounts')
}
