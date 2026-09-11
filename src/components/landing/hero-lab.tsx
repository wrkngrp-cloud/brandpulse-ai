'use client'

import { Hero, LP_VARS } from './landing-page'
import { HeroGround } from './hero-ground'
import { darkSceneVars } from './scenes'

/**
 * The two treatments of the arc, stacked, for a side by side read.
 *
 * A is the arc as subject: the mark holds the photograph up and the claim sits
 * in the negative space it encloses. B is the arc as ground: the same mask
 * oversized past the edges until it is material rather than object, with the
 * claim on top of it.
 */
export function HeroLab() {
  return (
    <main className="min-h-screen antialiased"
      style={{ ...LP_VARS, ...darkSceneVars, background: 'var(--lp-bg)', color: 'var(--lp-ink)', isolation: 'isolate' }}>
      <Rule label="A. The arc as subject" note="The mark holds the picture up. The claim sits in the bowl it leaves." />
      <Hero />
      <Rule label="B. The arc as ground" note="The same mask, oversized past the edges. Material rather than object." />
      <HeroGround />
      <div className="px-6 py-10 text-[12px]" style={{ color: 'var(--lp-mut)' }}>
        Temporary comparison page. It goes away once one of these is chosen.
      </div>
    </main>
  )
}

function Rule({ label, note }: { label: string; note: string }) {
  return (
    <div className="border-b border-line px-6 py-5" style={{ background: 'var(--lp-bg)' }}>
      <p className="bg-label" style={{ color: 'var(--tx-flare)' }}>{label}</p>
      <p className="mt-1.5 text-[13px]" style={{ color: 'var(--lp-mut)' }}>{note}</p>
    </div>
  )
}
