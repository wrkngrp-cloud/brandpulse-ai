import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { DEMO_LEADS } from '@/lib/demo/lead-desk-pack'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * Seed and remove the lead desk's demo rows.
 *
 * Authorised by the same permission the lead desk page itself checks, rather
 * than ADMIN_SECRET, because the person who should be able to do this is
 * exactly the person already allowed to read the desk — and that way the
 * buttons can live on the page instead of the operation needing a secret in a
 * terminal. A non-holder is refused.
 */
async function assertLeadDesk(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: canView } = await supabase.rpc('staff_can', { perm: 'leads.view' })
  return canView ? user.id : null
}

export async function POST() {
  if (!(await assertLeadDesk())) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 403 })
  }

  const svc = await createServiceClient()
  let leads = 0
  let runs = 0

  for (const demo of DEMO_LEADS) {
    const { data: lead, error } = await svc.from('leads').upsert({
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

    if (error || !lead) {
      console.error('[demo-leads] could not seed', demo.email, error?.message)
      continue
    }
    leads++

    // Rebuild the trail rather than adding to it, so re-seeding is idempotent
    // and the dates stay as written rather than drifting on every run.
    await svc.from('lead_tool_runs').delete().eq('lead_id', lead.id)

    for (const run of demo.runs) {
      const { error: runError } = await svc.from('lead_tool_runs').insert({
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

  return NextResponse.json({ leads, runs })
}

export async function DELETE() {
  if (!(await assertLeadDesk())) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 403 })
  }

  const svc = await createServiceClient()
  // lead_tool_runs cascades on lead_id, so the trail goes with them.
  const { data, error } = await svc.from('leads').delete().eq('is_demo', true).select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ removed: data?.length ?? 0 })
}
