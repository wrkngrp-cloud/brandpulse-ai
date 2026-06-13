'use client'

import { useRef } from 'react'
import { OohMapClient } from '@/components/ooh/ooh-map-client'
import { OohSitesList } from '@/components/ooh/ooh-sites-list'

interface Site {
  id: string
  site_name: string
  lat: number | null
  lng: number | null
  address?: string | null
  city: string | null
  state?: string | null
  country?: string | null
  format_type: string | null
  illuminated?: boolean
  daily_traffic?: number | null
  monthly_cost?: number | null
  currency?: string | null
  campaign_start: string | null
  campaign_end: string | null
  lga: string | null
  vanity_slug: string | null
  landing_url?: string | null
  visits: number
  qr_token?: string | null
  qr_scan_count?: number
  photo_url?: string | null
  notes?: string | null
}

interface OohDashboardClientProps {
  sites: Site[]
  appUrl: string
}

export function OohDashboardClient({ sites, appUrl }: OohDashboardClientProps) {
  const flyToRef = useRef<((lat: number, lng: number, siteId: string) => void) | null>(null)

  return (
    <div className="space-y-6">
      <OohMapClient
        sites={sites}
        onMapReady={flyTo => { flyToRef.current = flyTo }}
      />
      <OohSitesList
        sites={sites}
        appUrl={appUrl}
        onLocateSite={(lat, lng, siteId) => flyToRef.current?.(lat, lng, siteId)}
      />
    </div>
  )
}
