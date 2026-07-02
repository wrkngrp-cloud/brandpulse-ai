'use client'

import { usePathname } from 'next/navigation'
import { TourTrigger } from './tour-trigger'
import { getModuleForPath } from '@/lib/tour-definitions'

// Persistent topbar entry point — lets you re-open the current page's tour
// at any time, not just on first visit. No autoStart: that's handled by the
// in-page TourTrigger already on modules that have one.
export function GlobalTourButton() {
  const pathname   = usePathname()
  const moduleName = getModuleForPath(pathname)

  if (!moduleName) return null

  return <TourTrigger module={moduleName} variant="icon" />
}
