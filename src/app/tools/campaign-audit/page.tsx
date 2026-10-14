import type { Metadata } from 'next'
import { CampaignAuditPage } from '@/components/tools/campaign-audit-page'

export const metadata: Metadata = {
  title: 'Campaign Conversion Audit — free landing page audit | BrandGauge',
  description: 'Check your campaign landing page before you scale spend: measured mobile performance, accessibility failures, broken calls to action, conversion friction and local-market readiness. Free, no account needed.',
  alternates: { canonical: '/tools/campaign-audit' },
  openGraph: {
    title: 'Campaign Conversion Audit — free landing page audit',
    description: 'Find the mobile performance issues, broken journeys and unclear offers losing you customers before you spend more on ads. Free, no account needed.',
    url: '/tools/campaign-audit',
    type: 'website',
  },
}

const schema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Campaign Conversion Audit',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: 'Audits a campaign landing page for mobile performance, accessibility, call-to-action validity, conversion friction, local market readiness and visible tracking, separating measured findings from AI-assisted readings.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'NGN' },
  provider: { '@type': 'Organization', name: 'BrandGauge' },
}

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <CampaignAuditPage />
    </>
  )
}
