import type { Metadata } from 'next'
import { FeaturesPage } from '@/components/landing/features-page'
import { ChatWidget } from '@/components/support/chat-widget'

export const metadata: Metadata = {
  title: 'Features — BrandGauge',
  description: 'Every BrandGauge module that is live today: Brand Health Index, cultural sentiment, commercial proof, offline attribution, surveys, competitive intelligence and more.',
}

export default function Page() {
  return (
    <>
      <FeaturesPage />
      <ChatWidget source="site" />
    </>
  )
}
