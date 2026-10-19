import { createServiceClient } from '@/lib/supabase/server'
import { rootHost, normaliseUrl } from './fetch-public'
import { LEAD_ROLES, type LeadRole } from './gate'
import type { ToolId } from './registry'
import type { ToolReport } from './report'

/**
 * Turning an unlock into something a BDM can act on.
 *
 * The lead itself upserts on email, because a person is one person however
 * many tools they run. What they did goes in `lead_tool_runs`, one row per
 * run, so the desk sees the trail rather than only the most recent thing.
 * That split is the whole reason the child table exists: "ran the tracker on
 * Moniepoint, then audited their own landing page, and asked to be told when
 * the competitor moves" is a call worth making. "Submitted a form" is not.
 *
 * Nothing here writes to `tool_runs`. A report URL stays free of personal
 * data, which is what makes it safe to forward.
 */

export interface CaptureArgs {
  runId:     string
  toolId:    ToolId
  email:     string
  name?:     string
  role?:     string
  /** What they typed into the tool. Copied here because the run is purged
   *  after thirty days and the desk row should outlive it. */
  inputs:    Record<string, unknown>
  /** One line from the report, for the follow-up. */
  headline?: string | null
  wantsMonitoring: boolean
  consentText: string
}

/** The company, from the website they analysed rather than from a field they
 *  had to fill in. "acme.ng" becomes "Acme", which is wrong often enough to
 *  stay editable on the desk and right often enough to be worth not asking. */
export function companyFromInputs(inputs: Record<string, unknown>): { company: string | null; website: string | null } {
  const candidate = ['yourWebsite', 'website', 'companyWebsite', 'pageUrl', 'destinationUrl']
    .map(key => inputs[key])
    .find((value): value is string => typeof value === 'string' && value.length > 3)

  if (!candidate) return { company: null, website: null }

  const url = normaliseUrl(candidate)
  if (!url) return { company: null, website: candidate.slice(0, 300) }

  const host = rootHost(url.hostname)
  const bare = host.split('.')[0]
  return {
    company: bare ? bare.charAt(0).toUpperCase() + bare.slice(1) : null,
    website: url.origin,
  }
}

/** The single most useful sentence about what they found, for the call. */
export function headlineFrom(report: ToolReport | undefined): string | null {
  if (!report) return null
  const first = report.findings[0]
  return first ? first.title.slice(0, 300) : report.summary.slice(0, 300)
}

/**
 * Which incoming fields may be written over an existing lead.
 *
 * Only the blanks. A later run can fill in a name that was missing; it can
 * never replace one that is there, and it can never blank one out. Pure, so
 * tools:check can exercise it without a database.
 */
export function fillBlanks(
  existing: Record<string, string | null>,
  incoming: Record<string, string | null>,
): Record<string, string> {
  const patch: Record<string, string> = {}
  for (const [key, value] of Object.entries(incoming)) {
    const current = existing[key]
    if (value && !current) patch[key] = value
  }
  return patch
}

export type CaptureOutcome =
  | { ok: true; leadId: string; alreadyCaptured: boolean }
  | { ok: false; reason: 'failed' }

export async function captureLead(args: CaptureArgs): Promise<CaptureOutcome> {
  const svc = await createServiceClient()
  const { company, website } = companyFromInputs(args.inputs)
  const role = LEAD_ROLES.includes(args.role as LeadRole) ? args.role : null

  /* Read before write, rather than upsert.
     A plain upsert looked right and was wrong twice over.

     Source would be overwritten on every later run, so a lead who arrived
     through the Competitor Move Tracker and came back a week later through
     the audit would read as an audit lead. First touch is the acquisition
     fact worth keeping; the trail of everything after it lives in
     lead_tool_runs.

     And the second form is often sparser than the first. Somebody who gave
     their name on Monday and skipped it on Friday would have had it erased,
     because `name || null` sends an explicit null and PostgREST writes it.
     Blanks never overwrite what is already there.

     What the desk itself owns — status, notes, contacted_at, signed_up — was
     never in the payload and still is not. */
  const { data: existing } = await svc
    .from('leads')
    .select('id, name, company, website, role')
    .eq('email', args.email)
    .maybeSingle()

  let leadId: string

  if (existing) {
    const patch = fillBlanks(existing, {
      name:    args.name ?? null,
      company,
      website,
      role:    role ?? null,
    })
    if (Object.keys(patch).length) {
      await svc.from('leads').update(patch).eq('id', existing.id)
    }
    leadId = existing.id
  } else {
    const { data: inserted, error } = await svc
      .from('leads')
      .insert({
        email:   args.email,
        name:    args.name || null,
        company,
        website,
        role,
        source:  args.toolId,
      })
      .select('id')
      .single()

    if (error || !inserted) {
      /* Two unlocks of the same address at once: both saw no row, both
         inserted, one lost on the unique index. The loser reads the winner's
         row rather than failing, because the person is standing in front of a
         form either way. */
      const { data: raced } = await svc
        .from('leads').select('id').eq('email', args.email).maybeSingle()
      if (!raced) {
        console.error('[tool-leads] could not save the lead:', error?.message)
        return { ok: false, reason: 'failed' }
      }
      leadId = raced.id
    } else {
      leadId = inserted.id
    }
  }

  const lead = { id: leadId }

  const { error: runError } = await svc.from('lead_tool_runs').upsert({
    lead_id:          lead.id,
    run_id:           args.runId,
    tool_id:          args.toolId,
    inputs:           args.inputs,
    headline:         args.headline ?? null,
    wants_monitoring: args.wantsMonitoring,
    consent_text:     args.consentText,
  }, { onConflict: 'lead_id,run_id', ignoreDuplicates: true })

  if (runError) {
    // The lead is saved, which is the part that matters. A missing trail row
    // costs the desk context, not the contact.
    console.error('[tool-leads] could not record the run against the lead:', runError.message)
  }

  return { ok: true, leadId: lead.id, alreadyCaptured: Boolean(existing) }
}

/** Has this run already been unlocked? Checked before a result is returned,
 *  so a shared report link keeps working for whoever it was shared with. */
export async function runIsUnlocked(runId: string): Promise<boolean> {
  const svc = await createServiceClient()
  const { data } = await svc
    .from('lead_tool_runs').select('id').eq('run_id', runId).limit(1).maybeSingle()
  return Boolean(data)
}
