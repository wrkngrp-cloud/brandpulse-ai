'use client'

import Link                from 'next/link'
import { Badge }           from '@/components/ui/badge'
import { buttonVariants }  from '@/components/ui/button'
import { cn }              from '@/lib/utils'
import { MapPin, ExternalLink, Copy } from 'lucide-react'
import { toast }           from 'sonner'

interface Site {
  id: string
  site_name: string
  city: string | null
  state: string | null
  format_type: string | null
  illuminated: boolean
  daily_traffic: number | null
  weekly_cost: number | null
  currency: string | null
  campaign_start: string | null
  campaign_end: string | null
  cultural_zone: string | null
  vanity_slug: string | null
  visits: number
}

interface OohSitesListProps {
  sites: Site[]
  appUrl: string
}

function campaignStatus(start: string | null, end: string | null): 'live' | 'upcoming' | 'ended' | 'no-dates' {
  if (!start || !end) return 'no-dates'
  const now   = new Date()
  const s     = new Date(start)
  const e     = new Date(end)
  if (now >= s && now <= e) return 'live'
  if (now < s) return 'upcoming'
  return 'ended'
}

const STATUS_STYLES: Record<string, string> = {
  live:     'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300',
  upcoming: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
  ended:    'bg-muted text-muted-foreground',
  'no-dates': 'bg-muted text-muted-foreground',
}

const STATUS_LABELS: Record<string, string> = {
  live: 'Live', upcoming: 'Upcoming', ended: 'Ended', 'no-dates': 'No dates',
}

export function OohSitesList({ sites, appUrl }: OohSitesListProps) {
  function copyVanity(slug: string) {
    navigator.clipboard.writeText(`${appUrl}/go/${slug}`)
      .then(() => toast.success('Link copied!'))
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">All Sites</h2>
      <div className="divide-y border rounded-xl overflow-hidden">
        {sites.map(site => {
          const status = campaignStatus(site.campaign_start, site.campaign_end)
          return (
            <div key={site.id} className="flex items-center gap-4 px-4 py-3 bg-card hover:bg-muted/30 transition-colors">
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/dashboard/ooh/${site.id}`} className="text-sm font-medium hover:underline truncate">
                    {site.site_name}
                  </Link>
                  <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', STATUS_STYLES[status])}>
                    {STATUS_LABELS[status]}
                  </span>
                  {site.format_type && (
                    <span className="text-xs text-muted-foreground">{site.format_type}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {[site.city, site.state].filter(Boolean).join(', ')}
                  {site.cultural_zone ? ` · ${site.cultural_zone}` : ''}
                  {site.daily_traffic ? ` · ${site.daily_traffic.toLocaleString()}/day est.` : ''}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums">{site.visits.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">visits</p>
              </div>

              <div className="shrink-0 flex items-center gap-1.5">
                {site.vanity_slug && (
                  <button
                    onClick={() => copyVanity(site.vanity_slug!)}
                    className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted transition-colors"
                    title="Copy vanity link"
                  >
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
                <Link
                  href={`/dashboard/ooh/${site.id}`}
                  className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'h-7 px-2 text-xs')}
                >
                  View
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
