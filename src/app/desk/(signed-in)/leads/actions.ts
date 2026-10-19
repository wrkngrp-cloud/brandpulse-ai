'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaffOrNull, writeAudit } from '@/lib/desk/auth'
import { DEMO_LEADS } from '@/lib/demo/lead-desk-pack'
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

/**
 * Seed and remove the desk's demo rows.
 *
 * Moved here from /api/admin/demo-leads when the old lead desk retired. It was
 * an API route authorised by the lead desk allowlist; the Desk has no API
 * routes and no allowlist, so it is a server action on `leads.edit`, which is
 * the permission that already covers writing to this table.
 *
 * Re-seeding rebuilds each trail rather than adding to it, so running it twice
 * is the same as running it once and the dates stay as written instead of
 * drifting.
 *
 * Neither returns a message, because the outcome is the page: seeding adds
 * rows that appear with a Demo row badge, and removing takes them away. A
 * toast saying "4 rows" next to four visible rows is noise.
 */
export async function seedDemoLeads(): Promise<void> {
  const session = await requireStaffOrNull('leads.edit')
  if (!session) return

  const service = await createServiceClient()
  let leads = 0
  let runs  = 0

  for (const demo of DEMO_LEADS) {
    const { data: lead, error } = await service.from('leads').upsert({
      email:        demo.email,
      name:         demo.name,
      company:      demo.company,
      website:      demo.website,
      role:         demo.role,
      source:       demo.source,
      status:       demo.status,
      signed_up:    demo.signedUp,
      wants_weekly: demo.wantsWeekly,
      notes:        demo.notes,
      is_demo:      true,
      created_at:   demo.firstSeen,
    }, { onConflict: 'email' }).select('id').single()

    if (error || !lead) continue
    leads++

    await service.from('lead_tool_runs').delete().eq('lead_id', lead.id)

    for (const run of demo.runs) {
      const { error: runError } = await service.from('lead_tool_runs').insert({
        lead_id:          lead.id,
        run_id:           null,
        tool_id:          run.toolId,
        inputs:           run.inputs,
        headline:         run.headline,
        wants_monitoring: run.wantsMonitoring,
        consent_text:     'Demo row. No consent was given because no person exists.',
        created_at:       run.at,
      })
      if (!runError) runs++
    }
  }

  await writeAudit({
    actorId: session.userId, action: 'leads.demo_seeded',
    summary: `Seeded ${leads} demo leads with ${runs} tool runs`,
  })

  revalidatePath('/desk/leads')
}

export async function removeDemoLeads(): Promise<void> {
  const session = await requireStaffOrNull('leads.edit')
  if (!session) return

  const service = await createServiceClient()
  // lead_tool_runs cascades on lead_id, so each trail goes with its lead.
  const { data, error } = await service
    .from('leads').delete().eq('is_demo', true).select('id')
  if (error) return

  await writeAudit({
    actorId: session.userId, action: 'leads.demo_removed',
    summary: `Removed ${data?.length ?? 0} demo leads`,
  })

  revalidatePath('/desk/leads')
}
