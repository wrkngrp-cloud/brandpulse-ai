import type { Metadata } from 'next'
import { UseCasesPage } from '@/components/landing/use-cases-page'

export const metadata: Metadata = {
  title: 'Use cases by industry — BrandGauge',
  description: 'How FMCG, fintech, venues, B2B SaaS, marketplaces, beverage and distribution teams use BrandGauge, built only on features that are live today.',
}

export default function Page() {
  return <UseCasesPage />
}
