'use client'

import dynamic from 'next/dynamic'

export const OohSiteMapDynamic = dynamic(
  () => import('./ooh-site-map-client').then(m => m.OohSiteMapClient),
  { ssr: false, loading: () => <div className="h-72 rounded-xl bg-muted animate-pulse" /> },
)
