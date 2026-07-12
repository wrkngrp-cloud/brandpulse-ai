'use client'

import { useRef, useState } from 'react'
import { motion, useMotionValueEvent, useScroll } from 'framer-motion'
import { FunnelScene, GaugeScene, SentimentScene, WhatsAppScene, clamp01 } from './scenes'

const SCENES = [
  {
    Comp: GaugeScene,
    kicker: '01 · Brand Health Index',
    title: 'One score your CEO can ask about',
    body: 'Sentiment, awareness, consideration, loyalty and advocacy, blended into a single index and weighted for your industry. When it moves, you know why.',
  },
  {
    Comp: SentimentScene,
    kicker: '02 · Cultural sentiment',
    title: 'Sentiment with street sense',
    body: 'Global tools mislabel Pidgin, Yoruba, Igbo and Hausa. BrandGauge was trained on how your customers actually talk, so the scores hold up.',
  },
  {
    Comp: FunnelScene,
    kicker: '03 · Commercial proof',
    title: 'Marketing you can defend in money',
    body: 'CAC, ROI and funnel movement pulled live from Meta Ads, GA4, Paystack and your site pixel. Real connector data, not estimates typed into a slide.',
  },
  {
    Comp: WhatsAppScene,
    kicker: '04 · WhatsApp research',
    title: 'Surveys where people actually reply',
    body: 'NPS waves and brand studies over WhatsApp, opt-in and NDPR-aware. Response rates email can only dream about.',
  },
]

export function ScrollStage() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const [p, setP] = useState(0)
  useMotionValueEvent(scrollYProgress, 'change', v => setP(v))

  const N = SCENES.length

  return (
    <section ref={ref} aria-label="Product tour" style={{ height: `${N * 120}vh` }} className="relative">
      <div className="sticky top-0 flex h-screen flex-col items-center justify-center overflow-hidden">
        {/* ambient glow */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_45%,rgba(224,106,50,0.07),transparent_70%)]" />

        <div className="w-full max-w-5xl px-6" style={{ perspective: '1400px' }}>
          {SCENES.map((s, i) => {
            // each scene owns window [i/N, (i+1)/N] of section scroll
            const local = clamp01((p - i / N) * N)
            const enter = clamp01(local / 0.22)              // fly in
            const exit  = i === N - 1 ? 0 : clamp01((local - 0.82) / 0.18) // hand off
            const active = local > 0 && (local < 1 || i === N - 1)
            const sceneT = clamp01((local - 0.1) / 0.75)     // internal animation timing

            if (!active && !(i === 0 && p <= 0)) return null

            return (
              <motion.div
                key={s.kicker}
                className="absolute inset-x-6 top-1/2 mx-auto max-w-5xl"
                style={{
                  transformStyle: 'preserve-3d',
                  zIndex: 10 + i,
                  opacity: Math.min(enter, 1 - exit),
                  transform: `
                    translateY(calc(-50% + ${(1 - enter) * 220 - exit * 160}px))
                    rotateX(${(1 - enter) * 32 - exit * 14}deg)
                    scale(${0.82 + enter * 0.18 - exit * 0.1})
                  `,
                }}
              >
                <div className="mb-6 flex flex-col items-start gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-10">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#E8926A]">{s.kicker}</p>
                    <h3 className="mt-2 max-w-md text-2xl font-extrabold leading-tight tracking-tight text-[#F4EDE4] sm:text-3xl"
                      style={{ fontFamily: 'var(--font-display)' }}>
                      {s.title}
                    </h3>
                  </div>
                  <p className="max-w-sm text-[13px] leading-relaxed text-white/50">{s.body}</p>
                </div>
                <div className="h-[380px] sm:h-[420px]">
                  <s.Comp t={sceneT} />
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* progress rail */}
        <div className="absolute right-6 top-1/2 hidden -translate-y-1/2 flex-col gap-2 lg:flex" aria-hidden>
          {SCENES.map((s, i) => {
            const local = clamp01((p - i / N) * N)
            const on = local > 0 && local < 1
            return <span key={s.kicker} className="h-8 w-[3px] rounded-full transition-colors duration-300" style={{ background: on ? '#E06A32' : 'rgba(255,255,255,0.12)' }} />
          })}
        </div>
      </div>
    </section>
  )
}
