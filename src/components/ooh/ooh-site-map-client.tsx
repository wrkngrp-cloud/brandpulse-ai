'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import 'mapbox-gl/dist/mapbox-gl.css'

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
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
}

export function OohSiteMapClient({
  lat, lng, siteName, address, city, state, lga, formatType, visits = 0,
  campaignStart, campaignEnd,
}: OohSiteMapClientProps) {
  const mapRef      = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<unknown>(null)
  const [mapError, setMapError] = useState(false)
  const [loaded, setLoaded]     = useState(false)

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token || !mapRef.current || mapInstance.current) return

    import('mapbox-gl').then(({ default: mapboxgl }) => {
      if (!mapRef.current) return
      mapboxgl.accessToken = token

      const map = new mapboxgl.Map({
        container: mapRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [lng, lat],
        zoom: 15,
      })

      map.addControl(new mapboxgl.NavigationControl(), 'top-right')

      // Geolocate control — lets field teams see their position relative to the billboard
      map.addControl(
        new mapboxgl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
          showUserHeading: true,
        }),
        'top-right',
      )

      map.on('load', () => {
        const locationLine = [city, lga, state].filter(Boolean).join(' · ')
        const campaignLine = campaignStart
          ? `${fmtDate(campaignStart)}${campaignEnd ? ` – ${fmtDate(campaignEnd)}` : ''}`
          : ''

        const popup = new mapboxgl.Popup({ offset: 30, closeButton: false, maxWidth: '240px' })
          .setHTML(`
            <div style="font-size:12px;line-height:1.7;padding:2px 0">
              <strong style="font-size:13px;display:block;margin-bottom:3px">${siteName}</strong>
              ${formatType ? `<span style="color:#6b7280">${formatType}</span><br/>` : ''}
              ${address ? `<span>${address}</span><br/>` : ''}
              ${locationLine ? `<span style="color:#6b7280">${locationLine}</span><br/>` : ''}
              ${campaignLine ? `<span style="color:#6b7280;font-size:11px">Campaign: ${campaignLine}</span><br/>` : ''}
              <span style="font-size:11px;color:#6b7280;margin-top:2px;display:block">
                ${lat.toFixed(5)}, ${lng.toFixed(5)}
              </span>
            </div>
          `)

        new mapboxgl.Marker({ color: '#2563eb' })
          .setLngLat([lng, lat])
          .setPopup(popup)
          .addTo(map)

        setLoaded(true)
      })

      map.on('error', () => setMapError(true))
      mapInstance.current = map
    }).catch(() => setMapError(true))

    return () => {
      if (mapInstance.current) {
        ;(mapInstance.current as { remove(): void }).remove()
        mapInstance.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (mapError) {
    return (
      <div className="border rounded-xl p-4">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {lat.toFixed(5)}, {lng.toFixed(5)} — add NEXT_PUBLIC_MAPBOX_TOKEN to enable map.
        </p>
      </div>
    )
  }

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
      <div className="relative h-64">
        <div ref={mapRef} className="absolute inset-0" />
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <p className="text-xs text-muted-foreground">Loading map…</p>
          </div>
        )}
      </div>
      {loaded && (
        <div className="px-4 py-2.5 border-t bg-muted/30">
          <p className="text-xs text-muted-foreground">
            Click the pin to see site details. Use the locate button (top-right) to find your position relative to this billboard.
          </p>
        </div>
      )}
    </div>
  )
}
