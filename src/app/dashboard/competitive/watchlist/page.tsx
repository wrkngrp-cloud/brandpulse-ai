import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrand } from '@/lib/active-brand'
import { PageHeader } from '@/components/dashboard/page-header'
import { TourTrigger } from '@/components/tours/tour-trigger'
import { FileSearchIcon } from '@/components/brand/icon'
import { WatchlistClient } from './watchlist-client'

export const dynamic = 'force-dynamic'

/**
 * The competitor watchlist.
 *
 * Where someone lands after continuing from the free Competitor Move Tracker:
 * the competitor they analysed is already here, and everything the free brief
 * showed them is already in the timeline, marked as the baseline.
 *
 * Reads go through the RLS client, so the rows are the caller's workspace's by
 * construction and nothing is filtered by brand id in app code as a substitute.
 */
export default async function WatchlistPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const brand = await getActiveBrand<{ id: string; name: string; website_url: string | null }>(
    supabase, 'id, name, website_url',
  )
  if (!brand) redirect('/dashboard')

  const [{ data: watches }, { data: moves }] = await Promise.all([
    supabase
      .from('competitor_watches')
      .select('id, competitor_name, website_url, market, enabled, last_checked_at, created_at')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('competitor_moves')
      .select('id, competitor_name, category, headline, significance, implication, source_url, source_kind, quote, published_at, discovered_at, confidence, is_baseline')
      .eq('brand_id', brand.id)
      .order('discovered_at', { ascending: false })
      .limit(200),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Intelligence"
        title="Competitor watchlist"
        subtitle={`Public moves by the competitors you watch, each one carrying the source it came from. We check every Monday morning, and you can check any of them now.`}
        icon={FileSearchIcon}
        actions={<TourTrigger module="competitor_watchlist" />}
      />
      <WatchlistClient
        brandName={brand.name}
        brandWebsite={brand.website_url}
        watches={watches ?? []}
        moves={moves ?? []}
      />
    </div>
  )
}
