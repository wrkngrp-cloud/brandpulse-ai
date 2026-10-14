import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'The Desk | BrandGauge',
  // The Desk is internal. Nothing about it belongs in a search index.
  robots: { index: false, follow: false },
}

export default function DeskRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
