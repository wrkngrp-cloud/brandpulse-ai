import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrand } from '@/lib/active-brand'
import { PageHeader } from '@/components/dashboard/page-header'
import { TourTrigger } from '@/components/tours/tour-trigger'
import { MousePointerIcon } from '@/components/brand/icon'
import type { PageSpeedResult } from '@/lib/tools/pagespeed'
import { AuditPlanClient } from './audit-plan-client'

export const dynamic = 'force-dynamic'

/**
 * One audit, as a plan of work.
 *
 * Where the free Campaign Conversion Audit continues. The measured numbers and
 * every finding arrive with their provenance intact, so a marketer working the
 * list can still tell which items were measured and which were a reading.
 */
export default async function AuditPlan({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const brand = await getActiveBrand<{ id: string; name: string }>(supabase, 'id, name')
  if (!brand) redirect('/dashboard')

  const { data: audit } = await supabase
    .from('page_audits')
    .select('id, page_url, objective, market, performance, summary, coverage, created_at')
    .eq('id', id)
    .eq('brand_id', brand.id)
    .maybeSingle()

  if (!audit) notFound()

  const [{ data: findings }, { data: history }] = await Promise.all([
    supabase
      .from('page_audit_findings')
      .select('id, area, title, detail, severity, provenance, confidence, evidence, recommendation, status, resolved_at, created_at')
      .eq('audit_id', audit.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('page_audits')
      .select('id, created_at, page_audit_findings(id, severity)')
      .eq('brand_id', brand.id)
      .eq('page_url', audit.page_url)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Campaigns"
        title="Campaign improvement plan"
        subtitle={audit.page_url.replace(/^https?:\/\//, '')}
        icon={MousePointerIcon}
        actions={<TourTrigger module="campaign_audit" />}
      />
      <AuditPlanClient
        audit={{
          id:          audit.id,
          pageUrl:     audit.page_url,
          summary:     audit.summary,
          performance: (audit.performance ?? null) as PageSpeedResult | null,
          createdAt:   audit.created_at,
        }}
        findings={findings ?? []}
        history={(history ?? []).map(h => ({
          id: h.id,
          createdAt: h.created_at,
          count: ((h.page_audit_findings ?? []) as unknown[]).length,
          high: ((h.page_audit_findings ?? []) as { severity: string }[]).filter(f => f.severity === 'high').length,
        }))}
      />
    </div>
  )
}
