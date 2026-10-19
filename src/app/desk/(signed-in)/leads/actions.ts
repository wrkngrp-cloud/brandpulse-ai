'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaffOrNull, writeAudit } from '@/lib/desk/auth'
import { z } from 'zod'

const updateSchema = z.object({
  lead_id: z.string().uuid(),
  status:  z.enum(['new', 'contacted', 'qualified', 'converted', 'dead']),
  notes:   z.string().trim().max(2000).optional(),
})

/**
 * Working the pipeline.
 *
 * `contacted_at` is stamped the first time somebody moves a lead off new, and
 * never moved afterwards: the useful question is how long we took to reply,
 * and a timestamp that follows the latest edit cannot answer it.
 */
export async function updateLead(formData: FormData): Promise<void> {
  const session = await requireStaffOrNull('leads.edit')
  if (!session) return

  const parsed = updateSchema.safeParse({
    lead_id: formData.get('lead_id'),
    status:  formData.get('status'),
    notes:   formData.get('notes') || undefined,
  })
  if (!parsed.success) return

  const service = await createServiceClient()
  const { data: before } = await service
    .from('leads').select('email, status, contacted_at').eq('id', parsed.data.lead_id).maybeSingle()
  if (!before) return

  await service.from('leads').update({
    status: parsed.data.status,
    notes:  parsed.data.notes ?? null,
    contacted_at: before.contacted_at
      ?? (parsed.data.status !== 'new' ? new Date().toISOString() : null),
  }).eq('id', parsed.data.lead_id)

  await writeAudit({
    actorId: session.userId, action: 'leads.updated',
    targetType: 'lead', targetId: parsed.data.lead_id,
    summary: `Moved a lead from ${before.status} to ${parsed.data.status}`,
    meta: { from: before.status, to: parsed.data.status },
  })

  revalidatePath('/desk/leads')
}
