'use client'

import { useEffect } from 'react'

const HREF = 'https://api.mapbox.com/mapbox-gl-js/v3.24.0/mapbox-gl.css'

/**
 * Loads Mapbox's stylesheet the first time a map actually mounts.
 *
 * It used to sit in the root layout, so every page — the marketing site, the
 * sign-in screen, every dashboard screen without a map on it — opened a
 * render-blocking request to api.mapbox.com for a stylesheet it would never
 * use. Only three components draw a map; they can ask for it themselves.
 */
export function useMapboxCss() {
  useEffect(() => {
    if (document.querySelector(`link[href="${HREF}"]`)) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = HREF
    document.head.appendChild(link)
  }, [])
}
