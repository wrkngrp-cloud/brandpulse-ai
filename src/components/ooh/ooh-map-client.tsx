'use client'

import { useEffect, useRef, useState } from 'react'
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

function getRoiTier(visits: number): string {
  if (visits >= 500) return '#16a34a'
  if (visits >= 100) return '#d97706'
  return '#dc2626'
}

function fmtDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
}

export function OohMapClient({ sites, onMapReady }: OohMapClientProps) {
  const mapRef      = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<unknown>(null)
  const markersRef  = useRef<Record<string, unknown>>({})
  const [mapError, setMapError] = useState(false)
  const [loaded, setLoaded]     = useState(false)

  const mappable = sites.filter(s => s.lat != null && s.lng != null)

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token || !mapRef.current || mapInstance.current) return

    import('mapbox-gl').then(({ default: mapboxgl }) => {
      if (!mapRef.current) return
      // Point worker at CDN so Turbopack production builds don't break
      mapboxgl.workerUrl = '/mapbox-gl-csp-worker.js'
      mapboxgl.accessToken = token

      const map = new mapboxgl.Map({
        container: mapRef.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [3.3792, 6.5244],
        zoom: 10,
      })

      map.addControl(new mapboxgl.NavigationControl(), 'top-right')

      map.on('load', () => {
        mappable.forEach(site => {
          if (site.lng == null || site.lat == null) return

          const locationLine = [site.city, site.lga, site.state].filter(Boolean).join(' · ')
          const campaignLine = site.campaign_start
            ? `${fmtDate(site.campaign_start)}${site.campaign_end ? ` – ${fmtDate(site.campaign_end)}` : ''}`
            : ''

          const popup = new mapboxgl.Popup({ offset: 30, closeButton: false, maxWidth: '220px' })
            .setHTML(`
              <div style="font-size:12px;line-height:1.65;padding:2px 0">
                <strong style="font-size:13px;display:block;margin-bottom:3px">${site.site_name}</strong>
                ${site.format_type ? `<span style="color:#6b7280">${site.format_type}</span><br/>` : ''}
                ${locationLine ? `<span>${locationLine}</span><br/>` : ''}
                ${campaignLine ? `<span style="color:#6b7280;font-size:11px">Campaign: ${campaignLine}</span><br/>` : ''}
                <span style="color:${getRoiTier(site.visits)};font-weight:600;margin-top:4px;display:block">
                  ${site.visits.toLocaleString()} tracked visits
                </span>
              </div>
            `)

          const marker = new mapboxgl.Marker({ color: getRoiTier(site.visits) })
            .setLngLat([site.lng, site.lat])
            .setPopup(popup)
            .addTo(map)

          markersRef.current[site.id] = marker
        })

        if (mappable.length === 1 && mappable[0].lng != null && mappable[0].lat != null) {
          map.flyTo({ center: [mappable[0].lng, mappable[0].lat], zoom: 14 })
        } else if (mappable.length > 1) {
          const bounds = mappable.reduce((b, s) => {
            if (s.lng != null && s.lat != null) {
              b[0][0] = Math.min(b[0][0], s.lng)
              b[0][1] = Math.min(b[0][1], s.lat)
              b[1][0] = Math.max(b[1][0], s.lng)
              b[1][1] = Math.max(b[1][1], s.lat)
            }
            return b
          }, [[180, 90], [-180, -90]] as [[number, number], [number, number]])
          map.fitBounds(bounds, { padding: 60 })
        }

        // Expose flyTo to parent dashboard wrapper
        if (onMapReady) {
          onMapReady((lat, lng, siteId) => {
            map.flyTo({ center: [lng, lat], zoom: 15 })
            map.once('moveend', () => {
              const marker = markersRef.current[siteId] as { togglePopup(): void } | undefined
              marker?.togglePopup()
            })
          })
        }

        setLoaded(true)
      })

      map.on('error', () => setMapError(true))
      mapInstance.current = map
    }).catch(() => setMapError(true))

    return () => {
      if (mapInstance.current) {
        ;(mapInstance.current as { remove(): void }).remove()
        mapInstance.current = null
        markersRef.current  = {}
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (mapError) {
    if (mappable.length === 0) return null
    return (
      <div className="border rounded-xl p-4">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {mappable.length} site{mappable.length > 1 ? 's' : ''} with GPS coordinates — add NEXT_PUBLIC_MAPBOX_TOKEN to enable map view.
        </p>
      </div>
    )
  }

  return (
    <div className="relative border rounded-xl overflow-hidden h-72 bg-muted">
      <div ref={mapRef} className="absolute inset-0" />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <p className="text-xs text-muted-foreground">Loading map…</p>
        </div>
      )}
      {mappable.length === 0 && loaded && (
        <div className="absolute bottom-3 left-3 bg-background/90 rounded-lg px-3 py-1.5 text-xs text-muted-foreground">
          Add GPS coordinates to a site to see pins on the map.
        </div>
      )}
      <div className="absolute bottom-3 right-3 bg-background/90 rounded-lg px-3 py-1.5 flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-green-600" /> 500+ visits</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-600" /> 100–499</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-600" /> &lt;100</span>
      </div>
    </div>
  )
}
