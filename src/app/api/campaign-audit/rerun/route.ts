import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getActiveBrandId } from '@/lib/active-brand'
import { runCampaignAudit } from '@/lib/tools/campaign-audit'
import type { CampaignObjective } from '@/lib/tools/audit-vocab'
import { recordEvent } from '@/lib/tools/events'

export const runtime = 'nodejs'
export const maxDuration = 120

const Body = z.object({ auditId: z.string().uuid() })

/**
 * Re-audit a page and record what changed.
 *
 * This is the loop the improvement plan exists for: find issues, fix them,
 * re-run, see what actually went away. A finding from the previous audit that
 * does not come back is marked fixed with a timestamp, so the history shows
 * the work rather than the marketer having to remember it.
 *
 * The previous audit is read through the RLS client and matched against the
 * caller's active brand before any service-role write, per the data-access
 * rule.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No active brand.' }, { status: 400 })

  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Bad request.' }, { status: 400 })

  const { data: previous } = await supabase
    .from('page_audits')
    .select('id, page_url, objective, market')
    .eq('id', parsed.data.auditId)
    .eq('brand_id', brandId)
    .maybeSingle()

  if (!previous) return NextResponse.json({ error: 'That audit is not yours.' }, { status: 404 })

  const outcome = await runCampaignAudit({
    pageUrl:   previous.page_url,
    objective: (previous.objective ?? null) as CampaignObjective | null,
    market:    previous.market,
  })

  if (!outcome.ok) return NextResponse.json({ error: outcome.note }, { status: 422 })

  const svc = await createServiceClient()
  const { data: audit } = await svc.from('page_audits').insert({
    brand_id:    brandId,
    page_url:    outcome.result.pageUrl,
    objective:   previous.objective,
    market:      previous.market,
    performance: outcome.result.performance,
    summary:     outcome.result.summary,
    coverage:    { sources: outcome.result.coverage },
  }).select('id').single()

  if (!audit) return NextResponse.json({ error: 'That did not save.' }, { status: 500 })

  if (outcome.result.findings.length) {
    await svc.from('page_audit_findings').insert(outcome.result.findings.map(f => ({
      audit_id:       audit.id,
      brand_id:       brandId,
      area:           f.area,
      title:          f.title.slice(0, 300),
      detail:         f.detail || null,
      severity:       f.severity,
      provenance:     f.provenance,
      confidence:     f.confidence,
      evidence:       f.evidence || null,
      recommendation: f.recommendation || null,
    })))
  }

  /* Anything still open from the previous audit that this one did not find
     again is treated as fixed. Titles are the identity, which is imperfect —
     a reworded finding reads as a new one — but it is honest in the direction
     that matters: we never mark something fixed that came back. */
  const { data: stillOpen } = await supabase
    .from('page_audit_findings')
    .select('id, title')
    .eq('audit_id', previous.id)
    .in('status', ['open', 'planned'])

  const foundAgain = new Set(outcome.result.findings.map(f => f.title.slice(0, 300)))
  const resolved = (stillOpen ?? []).filter(f => !foundAgain.has(f.title))

  if (resolved.length) {
    await svc.from('page_audit_findings')
      .update({ status: 'fixed', resolved_at: new Date().toISOString() })
      .in('id', resolved.map(f => f.id))
  }

  await recordEvent({
    event: 'beta_feature_used', toolId: 'campaign-audit', userId: user.id,
    props: { feature: 'reaudit', findings: outcome.result.findings.length, resolved: resolved.length },
  })

  return NextResponse.json({
    auditId: audit.id,
    findings: outcome.result.findings.length,
    resolved: resolved.length,
  })
}
