import type { Metadata } from 'next'
import { ScoreboardPage } from '@/components/landing/scoreboard-page'

export const metadata: Metadata = {
  title: 'Category press scoreboard | BrandGauge',
  description:
    'Thirty days of Nigerian press for your brand and three rivals, weighted by readership and priced in Naira. Free, no account, nothing to connect.',
}

export default function Page() {
  return <ScoreboardPage />
}
