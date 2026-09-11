import type { Metadata } from 'next'
import { HeroLab } from '@/components/landing/hero-lab'

/**
 * Two heroes, one page, for choosing between them.
 *
 * Temporary. Delete this route and `hero-lab.tsx` once the arc's role is
 * settled, and keep whichever one wins in `landing-page.tsx`.
 */
export const metadata: Metadata = { title: 'Hero lab', robots: { index: false, follow: false } }

export default function Page() {
  return <HeroLab />
}
