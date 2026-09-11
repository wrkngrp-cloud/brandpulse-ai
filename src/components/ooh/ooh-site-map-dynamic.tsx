'use client'

import dynamic from 'next/dynamic'

export const OohSiteMapDynamic = dynamic(
  () => import('./ooh-site-map-client').then(m => m.OohSiteMapClient),
  { ssr: false, loading: () => <div className="bg-skeleton-block h-72" /> },
)
