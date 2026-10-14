import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrand } from '@/lib/active-brand'
import { PageHeader } from '@/components/dashboard/page-header'
import { TourTrigger } from '@/components/tours/tour-trigger'
import { QrIcon, ArrowRightIcon } from '@/components/brand/icon'
import { CAMPAIGN_TYPE_LABEL, type CampaignType } from '@/lib/tools/campaign-labels'

export const dynamic = 'force-dynamic'

/**
 * Tracked offline campaigns in the workspace.
 *
 * These rows started life anonymous, created by the free tool, and were moved
 * here by claiming rather than copied, so every printed QR code still resolves.
 */
export default async function OfflineTrackerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const brand = await getActiveBrand<{ id: string; name: string }>(supabase, 'id, name')
  if (!brand) redirect('/dashboard')

  const { data: campaigns } = await supabase
    .from('tool_campaigns')
    .select('id, name, campaign_type, destination_url, response_enabled, created_at, tool_placements(id, visits, unique_visits)')
    .eq('brand_id', brand.id)
    .order('created_at', { ascending: false })

  const rows = (campaigns ?? []).map(c => {
    const placements = (c.tool_placements ?? []) as { id: string; visits: number; unique_visits: number }[]
    return {
      ...c,
      placementCount: placements.length,
      visits:  placements.reduce((n, p) => n + (p.visits ?? 0), 0),
      uniques: placements.reduce((n, p) => n + (p.unique_visits ?? 0), 0),
    }
  })

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Campaigns"
        title="Offline campaign tracking"
        subtitle="Billboards, events, radio, flyers and activations, measured by the links and codes people actually used."
        icon={QrIcon}
        actions={<TourTrigger module="offline_tracker" />}
      />

      {rows.length === 0 ? (
        <div className="rounded-sm border border-line bg-card px-6 py-12 text-center">
          <QrIcon className="mx-auto h-6 w-6 text-tx-flare" />
          <p className="mt-4 text-[15px] font-medium text-tx">No tracked campaigns yet</p>
          <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-tx-3">
            Make the links and QR codes in the free tool and they arrive here with their history.
            The codes you print never change, so a campaign already in the field keeps working.
          </p>
          <Link href="/tools/offline-tracker"
            className="mt-6 inline-flex items-center gap-2 rounded-sm bg-flare px-5 py-2.5 text-[13.5px] font-bold text-on-hot bg-press">
            Create tracking links <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <ul data-tour="offline-campaign-list" className="space-y-3">
          {rows.map(c => (
            <li key={c.id}>
              <Link href={`/dashboard/offline-tracker/${c.id}`}
                className="flex flex-wrap items-center justify-between gap-4 rounded-sm border border-line bg-card px-5 py-4 bg-press">
                <div className="min-w-0">
                  <p className="text-[14.5px] font-medium text-tx">{c.name}</p>
                  <p className="mt-0.5 text-[12.5px] text-tx-3">
                    {CAMPAIGN_TYPE_LABEL[c.campaign_type as CampaignType]} · {c.placementCount} {c.placementCount === 1 ? 'placement' : 'placements'}
                    {c.response_enabled && ' · taking enquiries'}
                  </p>
                </div>
                <div className="flex items-center gap-7">
                  <Figure label="Visits" value={c.visits} />
                  <Figure label="Unique" value={c.uniques} />
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
