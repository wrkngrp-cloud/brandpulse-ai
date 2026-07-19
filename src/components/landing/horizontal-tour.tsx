'use client'

import { useRef, useState } from 'react'
import { useMotionValueEvent, useScroll } from 'framer-motion'
import { FunnelScene, GaugeScene, OohScene, SentimentScene, WhatsAppScene, clamp01 } from './scenes'

const PANELS = [
  {
    Comp: GaugeScene,
    kicker: '01 · Brand Health Index',
    title: 'One score your CEO can ask about',
    body: 'Five signals, one number, weighted for your industry. This is the exact gauge from the live dashboard.',
  },
  {
    Comp: SentimentScene,
    kicker: '02 · Cultural sentiment',
    title: 'Sentiment with street sense',
    body: 'Pidgin, Yoruba, Igbo and Hausa classified the way a Lagos marketer would read them.',
  },
  {
    Comp: FunnelScene,
    kicker: '03 · Commercial proof',
    title: 'Marketing you can defend in money',
    body: 'CAC, ROI and funnel movement from Meta Ads, GA4, Paystack and your site pixel.',
  },
  {
    Comp: WhatsAppScene,
    kicker: '04 · WhatsApp research',
    title: 'Surveys where people actually reply',
    body: 'NPS waves over WhatsApp, opt-in and NDPR-aware, scored as replies land.',
  },
  {
    Comp: OohScene,
    kicker: '05 · Offline attribution',
    title: 'From billboard to bank alert',
    body: 'Vanity links, search uplift and geo attribution for OOH, radio, TV and print.',
  },
]

/**
 * Vertical scroll drives a horizontal track: the section is tall, the viewport
 * sticks, and panels slide sideways with a light parallax swivel.
 */
export function HorizontalTour() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const [p, setP] = useState(0)
  useMotionValueEvent(scrollYProgress, 'change', v => setP(v))

  const N = PANELS.length
  // Track slides (N-1) panel widths across the section
  const slide = p * (N - 1)

  return (
    <section ref={ref} aria-label="Product tour" style={{ height: `${N * 105}vh` }} className="relative">
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">
        {/* header */}
        <div className="mx-auto mb-8 w-full max-w-6xl px-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: 'var(--lp-clay)' }}>The product, not a mockup</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <h2 className="max-w-xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--lp-ink)' }}>
              Scroll sideways through the dashboard.
            </h2>
            {/* progress dots */}
            <div className="flex items-center gap-2 pb-1.5">
              {PANELS.map((panel, i) => {
                const on = Math.round(slide) === i
                return <span key={panel.kicker} className="h-1.5 rounded-full transition-all duration-300"
                  style={{ width: on ? 28 : 10, background: on ? 'var(--lp-clay)' : 'var(--lp-line)' }} />
              })}
            </div>
          </div>
        </div>

        {/* track */}
        <div className="relative w-full" style={{ perspective: '1600px', '--slot': 'min(780px, 94vw)' } as React.CSSProperties}>
          <div
            className="flex will-change-transform"
            style={{ transform: `translateX(calc(50vw - (var(--slot) / 2) - (${slide} * var(--slot))))` }}
          >
            {PANELS.map((panel, i) => {
              // panel focus: 1 when centred, →0 one slot away
              const focus = clamp01(1 - Math.abs(slide - i))
              const sceneT = clamp01((focus - 0.15) / 0.8)
              return (
                <div key={panel.kicker} className="w-[var(--slot)] shrink-0 px-5" style={{ transformStyle: 'preserve-3d' }}>
                  <div
                    className="transition-shadow duration-300"
                    style={{
                      transform: `rotateY(${(i - slide) * -7}deg) scale(${0.9 + focus * 0.1})`,
                      opacity: 0.35 + focus * 0.65,
                    }}
                  >
                    <div className="mb-4 flex items-end justify-between gap-6">
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.24em]" style={{ color: 'var(--lp-clay)' }}>{panel.kicker}</p>
                        <h3 className="mt-1.5 text-xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--lp-ink)' }}>{panel.title}</h3>
                      </div>
                      <p className="hidden max-w-[260px] text-[12px] leading-relaxed sm:block" style={{ color: 'var(--lp-mut)' }}>{panel.body}</p>
                    </div>
                    <div className="@container h-[420px] sm:h-[400px]">
                      <panel.Comp t={sceneT} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <p className="mt-8 text-center font-mono text-[10px] uppercase tracking-[0.24em]" style={{ color: 'var(--lp-mut)' }}>
          Keep scrolling — the dashboard keeps moving
        </p>
      </div>
    </section>
  )
}
