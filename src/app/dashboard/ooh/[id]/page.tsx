import { createClient }        from '@/lib/supabase/server'
import { redirect, notFound }  from 'next/navigation'
import Link                    from 'next/link'
import { buttonVariants }      from '@/components/ui/button'
import { cn }                  from '@/lib/utils'
import { ArrowLeft, Edit, Copy, QrCode } from 'lucide-react'
import { OohVisitChart }       from '@/components/ooh/ooh-visit-chart'
import { ImpressionCalculator } from '@/components/ooh/impression-calculator'
import { SpendJustification }  from '@/components/ooh/spend-justification'
import { SearchUpliftWidget }  from '@/components/ooh/search-uplift-widget'
import { OohVanityCard }       from '@/components/ooh/ooh-vanity-card'
import { OohSiteMapDynamic as OohSiteMapClient } from '@/components/ooh/ooh-site-map-dynamic'

export default async function OohSitePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id }   = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: site } = await supabase
    .from('ooh_sites')
    .select('*')
    .eq('id', id)
    .single()

  if (!site) notFound()

  // Visit history (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: visits } = await supabase
    .from('ooh_visits')
    .select('visited_at, device_type, ip_region')
    .eq('site_id', id)
    .gte('visited_at', thirtyDaysAgo)
    .order('visited_at', { ascending: true })

  // Search uplift data
  const { data: upliftRows } = await supabase
    .from('ooh_search_uplift')
    .select('week_start, search_index, ooh_visits, correlation, interpretation')
    .eq('site_id', id)
    .order('week_start', { ascending: true })
    .limit(12)

  const { data: brand } = await supabase
    .from('brands').select('ooh_redirect_domain').limit(1).single()
  const defaultUrl = process.env.APP_URL ?? 'https://brandpulse-ai-tau.vercel.app'
  const appUrl     = brand?.ooh_redirect_domain
    ? `https://${brand.ooh_redirect_domain}`
    : defaultUrl
  const vanityLink = site.vanity_slug ? `${appUrl}/go/${site.vanity_slug}` : null

  const shortBase  = process.env.NEXT_PUBLIC_SHORT_DOMAIN
    ? `https://${process.env.NEXT_PUBLIC_SHORT_DOMAIN}`
    : defaultUrl
  const shortLink  = site.short_code ? `${shortBase}/s/${site.short_code}` : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link
            href="/dashboard/ooh"
            className={cn(buttonVariants({ size: 'sm', variant: 'ghost' }), 'h-8 px-2 mt-0.5')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold">{site.site_name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {[site.city, site.state, site.country].filter(Boolean).join(', ')}
              {site.format_type ? ` · ${site.format_type}` : ''}
              {site.lga ? ` · ${site.lga}` : ''}
            </p>
          </div>
        </div>
        <Link
          href={`/dashboard/ooh/${id}/edit`}
          className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'inline-flex items-center shrink-0')}
        >
          <Edit className="h-4 w-4 mr-1.5" />
          Edit
        </Link>
      </div>

      {/* Vanity link card */}
      {(vanityLink || shortLink) && (
        <OohVanityCard
          vanityLink={vanityLink}
          shortLink={shortLink}
          qrToken={site.qr_token}
          totalVisits={site.visits}
          appUrl={appUrl}
        />
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total visits" value={site.visits?.toLocaleString() ?? '0'} />
        <StatCard label="Daily traffic est." value={site.daily_traffic ? site.daily_traffic.toLocaleString() : '—'} />
        <StatCard
          label="Monthly cost"
          value={site.monthly_cost
            ? `${site.currency ?? 'NGN'} ${Number(site.monthly_cost).toLocaleString()}`
            : '—'}
        />
        <StatCard
          label="Campaign"
          value={site.campaign_start && site.campaign_end
            ? `${new Date(site.campaign_start).toLocaleDateString('en-GB', { day:'numeric',month:'short' })} – ${new Date(site.campaign_end).toLocaleDateString('en-GB', { day:'numeric',month:'short' })}`
            : '—'}
        />
      </div>

      {/* Visit chart */}
      <OohVisitChart visits={visits ?? []} siteId={id} />

      {/* Impression calculator */}
      <ImpressionCalculator
        dailyTraffic={site.daily_traffic}
        monthlyCost={site.monthly_cost ? Number(site.monthly_cost) : null}
        currency={site.currency ?? 'NGN'}
        campaignStart={site.campaign_start}
        campaignEnd={site.campaign_end}
        illuminated={site.illuminated}
        poleCount={site.pole_count ?? 1}
      />

      {/* Spend justification */}
      {site.monthly_cost && (
        <SpendJustification
          monthlyCost={Number(site.monthly_cost)}
          currency={site.currency ?? 'NGN'}
          dailyTraffic={site.daily_traffic}
          campaignStart={site.campaign_start}
          campaignEnd={site.campaign_end}
          trackedVisits={site.visits}
        />
      )}

      {/* Site location map */}
      {site.lat != null && site.lng != null && (
        <OohSiteMapClient
          lat={site.lat}
          lng={site.lng}
          siteName={site.site_name}
          address={site.address}
          city={site.city}
          state={site.state}
          lga={site.lga}
          formatType={site.format_type}
          visits={site.visits ?? 0}
          campaignStart={site.campaign_start}
          campaignEnd={site.campaign_end}
        />
      )}

      {/* Search uplift */}
      <SearchUpliftWidget
        upliftRows={upliftRows ?? []}
        siteName={site.site_name}
        siteId={id}
        brandId={site.brand_id}
        totalTrackedVisits={site.visits ?? 0}
      />
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-xl p-4 bg-card">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold mt-1 tabular-nums">{value}</p>
    </div>
  )
}
