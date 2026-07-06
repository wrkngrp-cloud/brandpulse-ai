'use client'

import { useState } from 'react'
import Map, { Marker, Popup, NavigationControl, GeolocateControl } from 'react-map-gl/mapbox'
import { MapPin } from 'lucide-react'

interface OohSiteMapClientProps {
  lat: number
  lng: number
  siteName: string
  address?: string | null
  city?: string | null
  state?: string | null
  lga?: string | null
  formatType?: string | null
  visits?: number
  campaignStart?: string | null
  campaignEnd?: string | null
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Africa/Lagos' })
}

export function OohSiteMapClient({
  lat, lng, siteName, address, city, state, lga, formatType, visits = 0,
  campaignStart, campaignEnd,
}: OohSiteMapClientProps) {
  const [showPopup, setShowPopup] = useState(true)
  const [mapError, setMapError]   = useState<string | null>(null)

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  if (!token) {
    return (
      <div className="border rounded-xl p-4">
        <p className="text-xs text-muted-foreground">Map token not configured.</p>
      </div>
    )
  }

  if (mapError) {
    return (
      <div className="border rounded-xl p-4">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {lat.toFixed(5)}, {lng.toFixed(5)} — map error: {mapError}
        </p>
      </div>
    )
  }

  const locationLine  = [city, lga, state].filter(Boolean).join(' · ')
  const campaignLine  = campaignStart
    ? `${fmtDate(campaignStart)}${campaignEnd ? ` – ${fmtDate(campaignEnd)}` : ''}`
    : ''

  return (
    <div className="border rounded-xl overflow-hidden bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Location</span>
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </span>
      </div>

      <div style={{ height: '16rem' }}>
        <Map
          mapboxAccessToken={token}
          initialViewState={{ longitude: lng, latitude: lat, zoom: 15 }}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          onError={(e) => setMapError(e.error?.message ?? 'Unknown error')}
        >
          <NavigationControl position="top-right" />
          <GeolocateControl
            position="top-right"
            positionOptions={{ enableHighAccuracy: true }}
            trackUserLocation
            showUserHeading
          />
          <Marker
            longitude={lng}
            latitude={lat}
            color="#2563eb"
            onClick={(e) => { e.originalEvent.stopPropagation(); setShowPopup(v => !v) }}
          />
          {showPopup && (
            <Popup
              longitude={lng}
              latitude={lat}
              offset={30}
              closeButton
              onClose={() => setShowPopup(false)}
              maxWidth="240px"
            >
              <div style={{ fontSize: '12px', lineHeight: 1.7, padding: '2px 0' }}>
                <strong style={{ fontSize: '13px', display: 'block', marginBottom: '3px' }}>{siteName}</strong>
                {formatType  && <span style={{ color: '#6b7280' }}>{formatType}<br /></span>}
                {address     && <span>{address}<br /></span>}
                {locationLine && <span style={{ color: '#6b7280' }}>{locationLine}<br /></span>}
                {campaignLine && <span style={{ color: '#6b7280', fontSize: '11px' }}>Campaign: {campaignLine}<br /></span>}
                <span style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px', display: 'block' }}>
                  {lat.toFixed(5)}, {lng.toFixed(5)}
                </span>
              </div>
            </Popup>
          )}
        </Map>
      </div>

      <div className="px-4 py-2.5 border-t bg-muted/30">
        <p className="text-xs text-muted-foreground">
          Click the pin to see site details. Use the locate button (top-right) to find your position relative to this billboard.
        </p>
      </div>
    </div>
  )
}
