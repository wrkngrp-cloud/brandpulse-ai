import type { Metadata } from 'next'
import { BrandGapPage } from '@/components/tools/brand-gap-page'

export const metadata: Metadata = {
  title: 'Brand Perception Gap — free brand positioning check | BrandGauge',
  description: 'See whether the Nigerian market describes your brand the way you describe it. We read your own website against the business press and what AI assistants say about you. Free, no account needed.',
  alternates: { canonical: '/tools/brand-gap' },
  openGraph: {
    title: 'Brand Perception Gap — free brand positioning check',
    description: 'Your brand name and your website, and a sourced reading of the distance between what you say and what the market says back. Free, no account needed.',
    url: '/tools/brand-gap',
    type: 'website',
  },
}

const schema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Brand Perception Gap',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: 'Reads a brand’s stated positioning from its own website, then reads how the Nigerian press and AI assistants describe it, and names the divergences with a source for each one.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'NGN' },
  provider: { '@type': 'Organization', name: 'BrandGauge' },
}

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <BrandGapPage />
    </>
  )
}
