import type { Metadata } from 'next'
import { MarketDemandPage } from '@/components/tools/market-demand-page'

export const metadata: Metadata = {
  title: 'Market Demand Gap Finder — free acquisition opportunities | BrandGauge',
  description: 'Find the customer searches your competitors are visible for and you are not. Reads your website, works out how buyers in your market search, and shows the gaps with evidence. Free, no account needed.',
  alternates: { canonical: '/tools/market-demand' },
  openGraph: {
    title: 'Market Demand Gap Finder — free acquisition opportunities',
    description: 'Discover overlooked customer needs and competitive visibility gaps in your market. Free, no account needed.',
    url: '/tools/market-demand',
    type: 'website',
  },
}

const schema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Market Demand Gap Finder',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: 'Reads a company website, identifies the buyer searches that matter in its market, and reports the visibility and content gaps where competitors appear instead.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'NGN' },
  provider: { '@type': 'Organization', name: 'BrandGauge' },
}

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <MarketDemandPage />
    </>
  )
}
