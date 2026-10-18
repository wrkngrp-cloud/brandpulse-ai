'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { moduleForPath } from '@/lib/modules'

/**
 * Tells the server which module the user is looking at.
 *
 * Mounted once in the dashboard shell, so it sees every navigation without
 * each of the 69 pages having to remember to report itself.
 *
 * It fires on a module change rather than on every render, and holds the last
 * key it sent so a re-render, a query-string change or a tab regaining focus
 * does not count as a second visit. React in development mounts effects twice,
 * which the same guard covers.
 *
 * `keepalive` matters: without it a navigation that unmounts this component
 * can cancel the request in flight, which loses exactly the visits that led
 * somewhere else.
 */
export function ModuleBeacon() {
  const pathname = usePathname()
  const lastSent = useRef<string | null>(null)

  useEffect(() => {
    const mod = moduleForPath(pathname)
    if (!mod || lastSent.current === mod.key) return
    lastSent.current = mod.key

    fetch('/api/usage/module', {
      method:    'POST',
      headers:   { 'Content-Type': 'application/json' },
      body:      JSON.stringify({ module: mod.key }),
      keepalive: true,
    }).catch(() => {})
  }, [pathname])

  return null
}
