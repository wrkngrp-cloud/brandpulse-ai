import type { Metadata } from 'next'
import { ToolsDirectory } from '@/components/landing/tools-directory'

export const metadata: Metadata = {
  title: 'BrandGauge Free Tools — better marketing decisions start here',
  description: 'Five free tools for African marketers: track competitor moves, find customer acquisition gaps, measure offline campaigns, audit a landing page and see who is winning the press. No account required to get started.',
  alternates: { canonical: '/tools' },
  openGraph: {
    title: 'BrandGauge Free Tools',
    description: 'Free tools that help you understand your market, uncover opportunities, track competitors, and measure what matters. No account required to get started.',
    url: '/tools',
    type: 'website',
  },
}

export default function ToolsPage() {
  return <ToolsDirectory />
}
