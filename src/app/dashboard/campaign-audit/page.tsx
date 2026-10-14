import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrand } from '@/lib/active-brand'
import { PageHeader } from '@/components/dashboard/page-header'
import { TourTrigger } from '@/components/tours/tour-trigger'
import { MousePointerIcon, ArrowRightIcon } from '@/components/brand/icon'

export const dynamic = 'force-dynamic'

/**
 * Audit history for the workspace.
 *
 * One row per audit run, newest first, so the before-and-after of a page is
 * readable from the list rather than only inside one audit.
 */
export default async function CampaignAuditIndex() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const brand = await getActiveBrand<{ id: string; name: string }>(supabase, 'id, name')
  if (!brand) redirect('/dashboard')

  const { data: audits } = await supabase
    .from('page_audits')
    .select('id, page_url, summary, created_at, page_audit_findings(id, severity, status)')
    .eq('brand_id', brand.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const rows = (audits ?? []).map(a => {
    const findings = (a.page_audit_findings ?? []) as { id: string; severity: string; status: string }[]
    return {
      id: a.id,
      pageUrl: a.page_url,
      createdAt: a.created_at,
      total: findings.length,
      high: findings.filter(f => f.severity === 'high').length,
      open: findings.filter(f => f.status === 'open' || f.status === 'planned').length,
      fixed: findings.filter(f => f.status === 'fixed').length,
    }
  })

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Campaigns"
        title="Campaign improvement plans"
        subtitle="Every page you have audited, what it needed, and what you have fixed since."
        icon={MousePointerIcon}
        actions={<TourTrigger module="campaign_audit" />}
      />

      {rows.length === 0 ? (
        <div className="rounded-sm border border-line bg-card px-6 py-12 text-center">
          <MousePointerIcon className="mx-auto h-6 w-6 text-tx-flare" />
          <p className="mt-4 text-[15px] font-medium text-tx">No audits yet</p>
          <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-tx-3">
            Audit the page your ads point at and every finding arrives here as a task you can
            work, with the measured numbers kept so a re-run shows what changed.
          </p>
          <Link href="/tools/campaign-audit"
            className="mt-6 inline-flex items-center gap-2 rounded-sm bg-flare px-5 py-2.5 text-[13.5px] font-bold text-on-hot bg-press">
            Audit a landing page <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map(a => (
            <li key={a.id}>
              <Link href={`/dashboard/campaign-audit/${a.id}`}
                className="flex flex-wrap items-center justify-between gap-4 rounded-sm border border-line bg-card px-5 py-4 bg-press">
                <div className="min-w-0">
                  <p className="truncate text-[14.5px] font-medium text-tx">
                    {a.pageUrl.replace(/^https?:\/\//, '')}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-tx-3">
                    {new Date(a.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}
                    {a.high > 0 && ` · ${a.high} to fix before more spend`}
                  </p>
                </div>
                <div className="flex items-center gap-7">
                  <Figure label="Open" value={a.open} />
                  <Figure label="Fixed" value={a.fixed} />
                  <ArrowRightIcon className="h-4 w-4 text-tx-3" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-right">
      <p className="bg-label text-tx-3">{label}</p>
      <p className="bg-num mt-0.5 text-[18px] leading-none text-tx">{value}</p>
    </div>
  )
}
