import type { Metadata } from 'next'
import { Suspense } from 'react'
import { OfflineTrackerPage } from '@/components/tools/offline-tracker-page'

export const metadata: Metadata = {
  title: 'Offline Campaign Tracker — free QR codes and tracking links | BrandGauge',
  description: 'Create trackable QR codes and short links for billboards, events, radio, flyers and activations, and see which placement actually brought people in. Free, no account needed.',
  alternates: { canonical: '/tools/offline-tracker' },
  openGraph: {
    title: 'Offline Campaign Tracker — free QR codes and tracking links',
    description: 'Measure responses from billboards, events, radio and flyers without connecting any marketing accounts. Free, no account needed.',
    url: '/tools/offline-tracker',
    type: 'website',
  },
}

const schema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Offline Campaign Tracker',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: 'Generates per-placement short links and QR codes for offline campaigns, with UTM tagging and visit reporting that separates unique visits from repeats and filters automated link previews.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'NGN' },
  provider: { '@type': 'Organization', name: 'BrandGauge' },
}

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      {/* The saved-campaign token arrives as ?c=, so the body reads the query. */}
      <Suspense fallback={null}><OfflineTrackerPage /></Suspense>
    </>
  )
}
