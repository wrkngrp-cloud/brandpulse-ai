'use client'

import { useEffect, useRef, useState } from 'react'
import Map, { Marker, Popup, NavigationControl, type MapRef } from 'react-map-gl/mapbox'
import { MapPin } from 'lucide-react'

interface Site {
  id: string
  site_name: string
  lat: number | null
  lng: number | null
  address?: string | null
  city: string | null
  state?: string | null
  format_type: string | null
  visits: number
  lga: string | null
  campaign_start: string | null
  campaign_end: string | null
}

interface OohMapClientProps {
  sites: Site[]
  onMapReady?: (flyTo: (lat: number, lng: number, siteId: string) => void) => void
}

function getRoiColor(visits: number): string {
  if (visits >= 500) return '#16a34a'
  if (visits >= 100) return '#d97706'
  return '#dc2626'
}

function fmtDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Africa/Lagos' })
}

export function OohMapClient({ sites, onMapReady }: OohMapClientProps) {
  const mapRef                    = useRef<MapRef>(null)
  const [popupId, setPopupId]     = useState<string | null>(null)
  const [mapError, setMapError]   = useState<string | null>(null)

  const token    = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const mappable = sites.filter(s => s.lat != null && s.lng != null)

  useEffect(() => {
    if (!onMapReady) return
    onMapReady((lat, lng, siteId) => {
      mapRef.current?.flyTo({ center: [lng, lat], zoom: 15 })
      setPopupId(siteId)
    })
  }, [onMapReady])

  if (!token || mappable.length === 0) return null

  if (mapError) {
    return (
      <div className="border rounded-xl p-4">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {mappable.length} site{mappable.length > 1 ? 's' : ''} with GPS — map error: {mapError}
        </p>
      </div>
    )
  }

  const lngs  = mappable.map(s => s.lng!)
  const lats  = mappable.map(s => s.lat!)
  const bounds: [[number, number], [number, number]] = [
    [Math.min(...lngs) - 0.02, Math.min(...lats) - 0.02],
    [Math.max(...lngs) + 0.02, Math.max(...lats) + 0.02],
  ]

  const initState = mappable.length === 1
    ? { longitude: mappable[0].lng!, latitude: mappable[0].lat!, zoom: 14 }
    : { bounds, fitBoundsOptions: { padding: 60 } }

  const popupSite = popupId ? mappable.find(s => s.id === popupId) ?? null : null

  return (
    <div className="relative border rounded-xl overflow-hidden bg-muted" style={{ height: '18rem' }}>
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        initialViewState={initState as never}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        onError={(e) => setMapError(e.error?.message ?? 'Unknown error')}
      >
        <NavigationControl position="top-right" />

        {mappable.map(site => (
          <Marker
            key={site.id}
            longitude={site.lng!}
            latitude={site.lat!}
            color={getRoiColor(site.visits)}
            onClick={(e) => {
              e.originalEvent.stopPropagation()
              setPopupId(id => id === site.id ? null : site.id)
            }}
          />
        ))}

        {popupSite && (
          <Popup
            longitude={popupSite.lng!}
            latitude={popupSite.lat!}
            offset={30}
            closeButton={false}
            maxWidth="220px"
            onClose={() => setPopupId(null)}
          >
            <div style={{ fontSize: '12px', lineHeight: 1.65, padding: '2px 0' }}>
              <strong style={{ fontSize: '13px', display: 'block', marginBottom: '3px' }}>{popupSite.site_name}</strong>
              {popupSite.format_type && <span style={{ color: '#6b7280' }}>{popupSite.format_type}<br /></span>}
              {[popupSite.city, popupSite.lga, popupSite.state].filter(Boolean).join(' · ')
                ? <span>{[popupSite.city, popupSite.lga, popupSite.state].filter(Boolean).join(' · ')}<br /></span>
                : null}
              {popupSite.campaign_start && (
                <span style={{ color: '#6b7280', fontSize: '11px' }}>
                  Campaign: {fmtDate(popupSite.campaign_start)}{popupSite.campaign_end ? ` – ${fmtDate(popupSite.campaign_end)}` : ''}<br />
                </span>
              )}
              <span style={{ color: getRoiColor(popupSite.visits), fontWeight: 600, marginTop: '4px', display: 'block' }}>
                {popupSite.visits.toLocaleString()} tracked visits
              </span>
            </div>
          </Popup>
        )}
      </Map>

      <div className="absolute bottom-3 right-3 bg-background/90 rounded-lg px-3 py-1.5 flex items-center gap-3 text-xs z-10 pointer-events-none">
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-green-600" /> 500+ visits</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-600" /> 100–499</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-600" /> &lt;100</span>
      </div>
    </div>
  )
}
