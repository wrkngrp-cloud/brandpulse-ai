import type { Metadata } from 'next'
import { CompetitorTrackerPage } from '@/components/tools/competitor-tracker-page'

export const metadata: Metadata = {
  title: 'Competitor Move Tracker — free competitive intelligence | BrandGauge',
  description: 'Find the product launches, pricing changes, partnerships and expansion moves your competitors made in the last thirty days. Every finding carries its source. Free, no account needed.',
  alternates: { canonical: '/tools/competitor-tracker' },
  openGraph: {
    title: 'Competitor Move Tracker — free competitive intelligence',
    description: 'Two website addresses, and a source-backed brief on what your competitor has actually done. Free, no account needed.',
    url: '/tools/competitor-tracker',
    type: 'website',
  },
}

/**
 * Structured data, so the tool can be found by someone searching for the job
 * rather than for BrandGauge. SoftwareApplication with a zero price is the
 * accurate shape: it is a free tool, not an article about one.
 */
const schema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Competitor Move Tracker',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: 'Reads a competitor’s own website and thirty days of Nigerian business press for product launches, pricing changes, partnerships and expansion, with a source for every finding.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'NGN' },
  provider: { '@type': 'Organization', name: 'BrandGauge' },
}

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <CompetitorTrackerPage />
    </>
  )
}
