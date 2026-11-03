'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireStaffOrNull, writeAudit } from '@/lib/desk/auth'
import { decideAccessRequest } from '@/lib/desk/shared-access'

export type AccessDecisionState = { error?: string; ok?: string } | null

const schema = z.object({
  kind:     z.enum(['ga4', 'meta']),
  id:       z.string().uuid(),
  decision: z.enum(['approve', 'reject']),
})

export async function decideAccess(_prev: AccessDecisionState, formData: FormData): Promise<AccessDecisionState> {
  const session = await requireStaffOrNull('ops.approve_access')
  if (!session) return { error: 'You do not have permission to confirm access.' }

  const parsed = schema.safeParse({ kind: formData.get('kind'), id: formData.get('id'), decision: formData.get('decision') })
  if (!parsed.success) return { error: 'That request did not look right.' }
  const approve = parsed.data.decision === 'approve'

  const result = await decideAccessRequest(session, { kind: parsed.data.kind, id: parsed.data.id, approve })
  if (!result.ok) return { error: result.error }

  await writeAudit({
    actorId:    session.userId,
    action:     approve ? 'ops.approve_access' : 'ops.reject_access',
    targetType: parsed.data.kind === 'ga4' ? 'ga4_connection' : 'ad_account',
    targetId:   parsed.data.id,
    summary:    `${approve ? 'Approved' : 'Rejected'} shared ${parsed.data.kind === 'ga4' ? 'GA4' : 'Meta Ads'} access`,
    meta:       { brandId: result.brandId },
  })
  revalidatePath('/desk/ops')
  return { ok: approve ? 'Approved. It syncs on the next daily run.' : 'Rejected. Nothing will sync.' }
}
