import { createClient } from '@/lib/supabase/server'
import { MapPin, TrendingUp, DollarSign, Link2, BarChart2 } from 'lucide-react'
import Link from 'next/link'

interface Props {
  campaignId: string
  currency: string
}

function fmtMoney(amount: number | null, currency = 'NGN') {
  if (!amount) return '—'
  return `${currency} ${Number(amount).toLocaleString('en-NG')}`
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000)      return `${(n / 1000).toFixed(0)}K`
  return n.toLocaleString()
}

// Deduplication factor: accounts for audience overlap across sites in the same city
const DEDUP_FACTOR = 0.65

export async function CampaignOohSummary({ campaignId, currency }: Props) {
  const supabase = await createClient()

  const [{ data: sites }, { data: visits }] = await Promise.all([
    supabase
      .from('ooh_sites')
      .select('id, site_name, city, state, format_type, daily_traffic, monthly_cost, campaign_start, campaign_end, lat, lng, vanity_slug')
      .eq('campaign_id', campaignId)
      .neq('status', 'draft'),
    supabase
      .from('ooh_visits')
      .select('site_id')
      .in(
        'site_id',
        // sub-select site ids — done via two-step since Supabase JS doesn't support subqueries
        (await supabase.from('ooh_sites').select('id').eq('campaign_id', campaignId)).data?.map(s => s.id) ?? [],
      ),
  ])

  if (!sites?.length) return null

  const visitsBySite: Record<string, number> = {}
  for (const v of visits ?? []) {
    visitsBySite[v.site_id] = (visitsBySite[v.site_id] ?? 0) + 1
  }

  const totalSpend = sites.reduce((s, site) => s + (Number(site.monthly_cost) || 0), 0)
  const totalVanityVisits = Object.values(visitsBySite).reduce((a, b) => a + b, 0)

  // Deduplicated reach: sum(daily_traffic × active_days) × 0.65
  let rawImpressions = 0
  for (const site of sites) {
    if (!site.daily_traffic) continue
    const start  = site.campaign_start ? new Date(site.campaign_start) : new Date()
    const end    = site.campaign_end   ? new Date(site.campaign_end)   : new Date()
    const days   = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
    rawImpressions += site.daily_traffic * days
  }
  const dedupImpressions = Math.round(rawImpressions * DEDUP_FACTOR)
  const blendedCpm       = dedupImpressions > 0 && totalSpend > 0
    ? (totalSpend / dedupImpressions) * 1000
    : null

  const sitesWithCoords = sites.filter(s => s.lat != null && s.lng != null)

  return (
    <div className="border rounded-xl p-5 bg-card space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">OOH Campaign Summary</h3>
        </div>
        <span className="text-xs text-muted-foreground">{sites.length} site{sites.length !== 1 ? 's' : ''}</span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-muted/40 rounded-lg p-3 space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            Est. Reach
          </div>
          <p className="text-lg font-bold tabular-nums">{dedupImpressions > 0 ? fmtNum(dedupImpressions) : '—'}</p>
          <p className="text-xs text-muted-foreground">65% dedup applied</p>
        </div>
        <div className="bg-muted/40 rounded-lg p-3 space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <DollarSign className="h-3 w-3" />
            Total Spend
          </div>
          <p className="text-lg font-bold tabular-nums">{fmtMoney(totalSpend || null, currency)}</p>
          <p className="text-xs text-muted-foreground">across all sites / mo</p>
        </div>
        <div className="bg-muted/40 rounded-lg p-3 space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link2 className="h-3 w-3" />
            Link Visits
          </div>
          <p className="text-lg font-bold tabular-nums">{fmtNum(totalVanityVisits)}</p>
          <p className="text-xs text-muted-foreground">vanity URLs</p>
        </div>
        <div className="bg-muted/40 rounded-lg p-3 space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <BarChart2 className="h-3 w-3" />
            Blended CPM
          </div>
          <p className="text-lg font-bold tabular-nums">
            {blendedCpm !== null ? fmtMoney(Math.round(blendedCpm), currency) : '—'}
          </p>
          <p className="text-xs text-muted-foreground">per 1,000 impressions</p>
        </div>
      </div>

      {/* Site list */}
      <div className="divide-y border rounded-lg overflow-hidden">
        {sites.map(site => (
          <div key={site.id} className="flex items-center gap-3 px-3 py-2.5 text-xs bg-background hover:bg-muted/30 transition-colors">
            <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <Link href={`/dashboard/ooh/${site.id}`} className="font-medium hover:underline truncate block">
                {site.site_name}
              </Link>
              <span className="text-muted-foreground">
                {[site.city, site.state].filter(Boolean).join(', ')}
                {site.format_type ? ` · ${site.format_type}` : ''}
              </span>
            </div>
            <span className="shrink-0 tabular-nums">
              {visitsBySite[site.id] ? fmtNum(visitsBySite[site.id]) : '—'}
              <span className="text-muted-foreground ml-1">visits</span>
            </span>
          </div>
        ))}
      </div>

      {sitesWithCoords.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {sitesWithCoords.length} of {sites.length} sites have coordinates — visible on the site detail maps.
        </p>
      )}
    </div>
  )
}
