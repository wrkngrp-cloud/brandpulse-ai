'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, useInView } from 'framer-motion'
import { ArrowRight, Moon, Sun } from 'lucide-react'
import { VideoHero } from './video-hero'
import { HorizontalTour } from './horizontal-tour'
import { AiScene, CLAY, CompetitiveScene, GaugeMark, darkSceneVars, lightSceneVars } from './scenes'

const rise = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
}

// ————— theme palettes —————
export const LIGHT = {
  '--lp-bg': '#FBF9F5', '--lp-ink': '#14182B', '--lp-mut': 'rgba(20,24,43,0.55)',
  '--lp-line': 'rgba(20,24,43,0.10)', '--lp-card': '#FFFFFF', '--lp-glass': 'rgba(255,255,255,0.75)',
  '--lp-chip': 'rgba(20,24,43,0.04)', '--lp-clay': CLAY, '--lp-band': '#14182B', '--lp-band-ink': '#F4EDE4',
  '--lp-dot': 'rgba(20,24,43,0.10)',
} as React.CSSProperties

export const DARK = {
  '--lp-bg': '#080C1A', '--lp-ink': '#F4EDE4', '--lp-mut': 'rgba(244,237,228,0.52)',
  '--lp-line': 'rgba(255,255,255,0.10)', '--lp-card': '#0E1430', '--lp-glass': 'rgba(11,16,34,0.75)',
  '--lp-chip': 'rgba(255,255,255,0.04)', '--lp-clay': '#E06A32', '--lp-band': '#0E1430', '--lp-band-ink': '#F4EDE4',
  '--lp-dot': 'rgba(255,255,255,0.10)',
} as React.CSSProperties

export function Wordmark({ className = 'text-xl' }: { className?: string }) {
  return (
    <span className={`font-extrabold tracking-tight ${className}`} style={{ fontFamily: 'var(--font-display)', color: 'var(--lp-ink)' }}>
      Brand<span style={{ color: 'var(--lp-clay)' }}>Gauge</span>
    </span>
  )
}

export function Nav({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-4 mt-4 flex max-w-6xl items-center justify-between rounded-2xl border px-4 py-3 backdrop-blur-xl sm:mx-6 sm:px-5 lg:mx-auto"
        style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-glass)' }}>
        <Link href="/" className="flex items-center gap-2.5" style={{ color: 'var(--lp-ink)' }}>
          <GaugeMark className="h-7 w-7" />
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-7 font-mono text-[11px] uppercase tracking-[0.18em] md:flex" style={{ color: 'var(--lp-mut)' }}>
          <a href="/#tour" className="transition-opacity hover:opacity-60">Product</a>
          <Link href="/features" className="transition-opacity hover:opacity-60">Features</Link>
          <Link href="/use-cases" className="transition-opacity hover:opacity-60">Industries</Link>
          <a href="/#builtforhere" className="transition-opacity hover:opacity-60">Why us</a>
        </nav>
        <div className="flex items-center gap-2.5">
          <button onClick={onToggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex h-9 w-9 items-center justify-center rounded-full border transition-transform hover:rotate-12"
            style={{ borderColor: 'var(--lp-line)', color: 'var(--lp-ink)' }}>
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link href="/auth/login" className="hidden text-[13px] font-medium transition-opacity hover:opacity-70 sm:block" style={{ color: 'var(--lp-ink)' }}>Sign in</Link>
          <Link href="/auth/signup"
            className="whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-bold text-white shadow-[0_8px_28px_rgba(212,96,42,0.35)] transition-transform hover:scale-[1.04]"
            style={{ background: 'var(--lp-clay)' }}>
            Start free
          </Link>
        </div>
      </div>
    </header>
  )
}

/** Mouse-follow tilt wrapper: the "hold the product in your hand" delighter. */
function Tilt({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [tf, setTf] = useState('rotateX(0deg) rotateY(0deg)')
  function onMove(e: React.MouseEvent) {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    setTf(`rotateX(${(-y * 4).toFixed(2)}deg) rotateY(${(x * 6).toFixed(2)}deg)`)
  }
  return (
    <div ref={ref} style={{ perspective: '1400px' }} onMouseMove={onMove} onMouseLeave={() => setTf('rotateX(0deg) rotateY(0deg)')}>
      <div className="transition-transform duration-300 ease-out will-change-transform" style={{ transform: tf }}>{children}</div>
    </div>
  )
}

/** Adire-inspired concentric circle motif, kept faint. */
function CircleMotif({ className = '', size = 320 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" className={className} aria-hidden>
      {[86, 68, 50, 32, 14].map(r => (
        <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="var(--lp-clay)" strokeOpacity="0.12" strokeWidth="1.2" strokeDasharray={r % 28 === 0 ? '3 6' : undefined} />
      ))}
      <circle cx="100" cy="100" r="4" fill="var(--lp-clay)" fillOpacity="0.25" />
    </svg>
  )
}

/** Faint decorative echo of the BHI gauge arc (225°→315°, ticks at 40/65/80) —
 *  ties "we measure it" into the page's negative space instead of a generic pattern. */
function GaugeArcMotif({ className = '', size = 520, color = 'var(--lp-clay)', opacity = 0.1 }:
  { className?: string; size?: number; color?: string; opacity?: number }) {
  const R = 92
  const toXY = (deg: number) => {
    const r = (deg * Math.PI) / 180
    return { x: (100 + R * Math.cos(r)).toFixed(2), y: (100 - R * Math.sin(r)).toFixed(2) }
  }
  const start = toXY(225), end = toXY(315)
  const d = `M ${start.x} ${start.y} A ${R} ${R} 0 1 1 ${end.x} ${end.y}`
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" className={className} aria-hidden>
      <path d={d} fill="none" stroke={color} strokeOpacity={opacity} strokeWidth="1.4" strokeLinecap="round" strokeDasharray="1 8" />
      {[40, 65, 80].map(pct => {
        const p = toXY(225 - (pct / 100) * 270)
        return <circle key={pct} cx={p.x} cy={p.y} r="2.2" fill={color} fillOpacity={opacity * 1.4} />
      })}
    </svg>
  )
}

function CountUp({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!inView) return
    const t0 = performance.now()
    let raf = 0
    const loop = (now: number) => {
      const p = Math.min(1, (now - t0) / 1200)
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [inView, to])
  return <span ref={ref}>{v}{suffix}</span>
}

function Hero() {
  const words = 'See your brand the way the street sees it.'.split(' ')
  return (
    <section className="relative overflow-hidden pb-24 pt-36 sm:pt-44">
      {/* patterned backdrop: dot grid + washes + adire motifs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(var(--lp-dot) 1px, transparent 1px)',
          backgroundSize: '26px 26px',
          maskImage: 'radial-gradient(75% 55% at 50% 32%, black, transparent)',
        }} />
        <div className="absolute -left-24 top-40 opacity-70"><CircleMotif /></div>
        <div className="absolute -right-16 top-[560px] opacity-50"><CircleMotif size={220} /></div>
        <div className="absolute left-1/2 top-[-180px] h-[420px] w-[820px] -translate-x-1/2 rounded-full blur-[130px]"
          style={{ background: 'rgba(43,89,255,0.10)' }} />
        <div className="absolute left-1/2 top-[380px] h-[380px] w-[700px] -translate-x-1/2 rounded-full blur-[130px]"
          style={{ background: 'rgba(212,96,42,0.10)' }} />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 text-center">
        <motion.p {...rise} className="font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: 'var(--lp-clay)' }}>
          Brand intelligence · Lagos to Accra
        </motion.p>
        <h1 className="mx-auto mt-5 max-w-4xl text-5xl font-black leading-[1.02] tracking-[-0.03em] sm:text-7xl"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--lp-ink)' }}>
          {words.map((w, i) => (
            <motion.span key={i} className="inline-block whitespace-pre"
              initial={{ opacity: 0, y: 34, rotate: 2 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{ delay: 0.1 + i * 0.055, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}>
              {w === 'street' ? <span style={{ color: 'var(--lp-clay)' }}>{w}</span> : w}{' '}
            </motion.span>
          ))}
        </h1>
        <motion.p {...rise} transition={{ ...rise.transition, delay: 0.5 }}
          className="mx-auto mt-6 max-w-2xl text-[15px] leading-relaxed sm:text-lg" style={{ color: 'var(--lp-mut)' }}>
          BrandGauge reads sentiment in Pidgin, Yoruba, Igbo and Hausa, measures every channel
          from Instagram to a billboard on the expressway, and turns it all into numbers your
          board will trust.
        </motion.p>
        <motion.div {...rise} transition={{ ...rise.transition, delay: 0.6 }} className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Link href="/auth/signup"
            className="group flex items-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-bold text-white shadow-[0_14px_44px_rgba(212,96,42,0.4)] transition-transform hover:scale-[1.03]"
            style={{ background: 'var(--lp-clay)' }}>
            Start free in beta
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a href="#demo" className="rounded-full border px-6 py-3.5 text-[14px] font-medium transition-colors"
            style={{ borderColor: 'var(--lp-line)', color: 'var(--lp-ink)' }}>
            Watch the demo
          </a>
        </motion.div>

        {/* the unveil film, framed and held in the viewer's hand */}
        <motion.div id="demo" {...rise} transition={{ ...rise.transition, delay: 0.72 }} className="relative mx-auto mt-16 max-w-4xl scroll-mt-28">
          <Tilt><VideoHero /></Tilt>
        </motion.div>

        {/* connector marquee */}
        <div className="relative mt-16 overflow-hidden" style={{ maskImage: 'linear-gradient(90deg, transparent, black 12%, black 88%, transparent)' }}>
          <div className="flex w-max animate-[lp-marquee_26s_linear_infinite] gap-10 font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--lp-mut)' }}>
            {[...Array(2)].flatMap((_, k) =>
              ['Meta Ads', 'Instagram', 'X', 'GA4', 'Paystack', 'Mailchimp', 'Site Pixel', 'First-party API'].map(c => (
                <span key={`${k}-${c}`} className="flex items-center gap-10">
                  <span>{c}</span><span style={{ color: 'var(--lp-clay)' }}>·</span>
                </span>
              )),
            )}
          </div>
        </div>
      </div>
      <style>{`@keyframes lp-marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
    </section>
  )
}

const DIFFS = [
  { n: '01', title: 'It speaks your market’s language', body: 'Sentiment models that understand Pidgin, Yoruba, Igbo and Hausa, tuned on how customers here actually talk about brands. Global tools guess. This one knows.' },
  { n: '02', title: 'Your field team becomes a data source', body: 'Ambassadors capture leads at events through a phone-first app, field officers log store visits, and it all lands on the same dashboard as your ads.' },
  { n: '03', title: 'Offline media finally measured', body: 'Billboards, radio, TV and print get vanity links, geo attribution and AI media-plan analysis. The biggest slice of your budget stops being a blind spot.' },
  { n: '04', title: 'Numbers for the boardroom', body: 'CAC, ROI, funnel lift and an AI-written business case, generated from live connector data. Walk into the budget meeting with proof.' },
  { n: '05', title: 'Tracks how AI talks about you', body: 'A weekly check on what ChatGPT, Gemini and Perplexity say when customers ask about your category. A channel your competitors ignore.' },
  { n: '06', title: 'Built for seven industries', body: 'FMCG, fintech, venues, B2B SaaS, marketplaces, beverages and distribution. The index, funnel and recommendations reshape for each.' },
]

function Differentiators() {
  return (
    <section id="builtforhere" className="relative overflow-hidden scroll-mt-24 py-28">
      {/* patterned backdrop: dot grid + adire motif + gauge echo + washes */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(var(--lp-dot) 1px, transparent 1px)',
          backgroundSize: '26px 26px',
          maskImage: 'radial-gradient(65% 70% at 50% 0%, black, transparent)',
        }} />
        <div className="absolute -left-20 -top-16 opacity-40"><CircleMotif size={200} /></div>
        <div className="absolute -bottom-32 -right-24"><GaugeArcMotif size={560} opacity={0.24} /></div>
        <div className="absolute right-0 top-0 h-[360px] w-[560px] rounded-full blur-[130px]"
          style={{ background: 'rgba(43,89,255,0.08)' }} />
        <div className="absolute -bottom-40 left-0 h-[340px] w-[600px] rounded-full blur-[130px]"
          style={{ background: 'rgba(212,96,42,0.09)' }} />
      </div>

      <div className="relative mx-auto max-w-6xl px-6">
        <motion.p {...rise} className="font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: 'var(--lp-clay)' }}>Why BrandGauge</motion.p>
        <motion.h2 {...rise} className="mt-4 max-w-2xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--lp-ink)' }}>
          Built for here. Not adapted for here.
        </motion.h2>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DIFFS.map((d, i) => (
            <motion.div key={d.n} {...rise} transition={{ ...rise.transition, delay: i * 0.05 }}
              className="group relative overflow-hidden rounded-2xl border p-7 transition-all duration-300 hover:-translate-y-1.5"
              style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-card)', boxShadow: '0 1px 2px rgba(20,24,43,0.04)' }}>
              {/* clay corner sweep on hover */}
              <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                style={{ background: 'rgba(212,96,42,0.22)' }} />
              <span className="font-mono text-[11px]" style={{ color: 'var(--lp-clay)' }}>{d.n}</span>
              <h3 className="mt-3 text-[17px] font-bold leading-snug" style={{ fontFamily: 'var(--font-display)', color: 'var(--lp-ink)' }}>{d.title}</h3>
              <p className="mt-2.5 text-[13px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>{d.body}</p>
            </motion.div>
          ))}
        </div>

        {/* stats band */}
        <motion.div {...rise} className="relative mt-16 grid grid-cols-2 gap-4 rounded-2xl border p-8 text-center sm:grid-cols-4"
          style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-chip)' }}>
          <div className="pointer-events-none absolute -bottom-16 -right-10"><GaugeArcMotif size={220} opacity={0.3} /></div>
          {[
            { v: 4,  s: '',  label: 'languages read natively' },
            { v: 7,  s: '',  label: 'industry playbooks' },
            { v: 10, s: '+', label: 'live connectors' },
            { v: 5,  s: '',  label: 'offline channels measured' },
          ].map(st => (
            <div key={st.label} className="relative">
              <p className="text-4xl font-black tabular-nums" style={{ fontFamily: 'var(--font-display)', color: 'var(--lp-clay)' }}>
                <CountUp to={st.v} suffix={st.s} />
              </p>
              <p className="mt-1 text-[12px]" style={{ color: 'var(--lp-mut)' }}>{st.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

function DeepDives() {
  return (
    <section className="relative overflow-hidden py-16">
      {/* patterned backdrop: diagonal wash pair + a faint circle motif cropped at the edge */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-1/4 opacity-30"><CircleMotif size={380} /></div>
        <div className="absolute -right-20 top-0 h-[360px] w-[520px] rounded-full blur-[140px]"
          style={{ background: 'rgba(212,96,42,0.07)' }} />
        <div className="absolute -left-10 bottom-0 h-[320px] w-[480px] rounded-full blur-[140px]"
          style={{ background: 'rgba(43,89,255,0.08)' }} />
      </div>

      <div className="relative mx-auto max-w-6xl space-y-24 px-6">
        {[
          { Comp: AiScene, kicker: 'AI command layer', title: 'Ask your data anything',
            body: 'Plain questions, straight answers, sourced from your own numbers. And once a week, BrandGauge asks the big AI assistants about your category and scores how you show up.' },
          { Comp: CompetitiveScene, kicker: 'Competitive intelligence', title: 'Know their moves before Monday',
            body: 'Share of voice, competitor sightings and an auto-written briefing at the start of every week. When a rival cuts prices, you hear it from us first.' },
        ].map((s, i) => (
          <motion.div key={s.kicker} {...rise}
            className={`flex flex-col gap-10 lg:items-center ${i % 2 ? 'lg:flex-row-reverse' : 'lg:flex-row'}`}>
            <div className="lg:w-[38%]">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em]" style={{ color: 'var(--lp-clay)' }}>{s.kicker}</p>
              <h3 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--lp-ink)' }}>{s.title}</h3>
              <p className="mt-4 text-[14px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>{s.body}</p>
            </div>
            <div className="@container h-[430px] flex-1 sm:h-[360px]"><s.Comp t={1} /></div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

function Industries() {
  const list = [
    { name: 'FMCG', hint: 'Shelf visibility, share of voice, distributor pull' },
    { name: 'Fintech', hint: 'Trust signals: social comments, street discourse, NPS' },
    { name: 'Venues & Restaurants', hint: 'Footfall, Google Maps reviews, event ROI' },
    { name: 'B2B SaaS', hint: 'G2 reviews, developer health, pipeline lift' },
    { name: 'Marketplaces', hint: 'Seller ratings, GMV attribution, buyer NPS' },
    { name: 'Beverage & Alcohol', hint: 'Venue sightings, sponsorships, cultural moments' },
    { name: 'B2B Distribution', hint: 'Trade partner scores, field reports, coverage' },
  ]
  const [active, setActive] = useState(1)
  return (
    <section id="industries" className="relative overflow-hidden scroll-mt-24 py-24 text-center">
      {/* patterned backdrop: radial dot grid bookending the hero + a large centred gauge echo
          ("one gauge" made literal in the negative space) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(var(--lp-dot) 1px, transparent 1px)',
          backgroundSize: '26px 26px',
          maskImage: 'radial-gradient(60% 65% at 50% 50%, black, transparent)',
        }} />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <GaugeArcMotif size={620} opacity={0.22} />
        </div>
        <div className="absolute left-1/2 top-0 h-[300px] w-[560px] -translate-x-1/2 rounded-full blur-[130px]"
          style={{ background: 'rgba(212,96,42,0.07)' }} />
      </div>

      <div className="relative mx-auto max-w-6xl px-6">
        <motion.h2 {...rise} className="text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--lp-ink)' }}>
          One gauge. Seven industries.
        </motion.h2>
        <motion.p {...rise} className="mx-auto mt-4 max-w-xl text-[14px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>
          Pick your industry once. The health index, funnel signals and connector
          recommendations reshape themselves around how your business actually works.
        </motion.p>
        <motion.div {...rise} className="mt-10 flex flex-wrap justify-center gap-3">
          {list.map((v, i) => (
            <button key={v.name} onClick={() => setActive(i)} onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)}
              className="rounded-full border px-5 py-2.5 text-[13px] transition-all duration-200"
              style={active === i
                ? { borderColor: 'var(--lp-clay)', color: 'var(--lp-clay)', background: 'rgba(212,96,42,0.08)', transform: 'translateY(-2px)' }
                : { borderColor: 'var(--lp-line)', color: 'var(--lp-ink)', background: 'var(--lp-card)' }}>
              {v.name}
            </button>
          ))}
        </motion.div>
        <p className="mx-auto mt-6 h-6 max-w-md font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: 'var(--lp-mut)' }}>
          {list[active].hint}
        </p>
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="px-6 pb-24 pt-8">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl px-6 py-24 text-center"
        style={{ background: 'var(--lp-band)' }}>
        <div className="pointer-events-none absolute inset-0" style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)', backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(70% 80% at 50% 50%, black, transparent)',
        }} />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[320px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]"
          style={{ background: 'rgba(224,106,50,0.20)' }} />
        <div className="pointer-events-none absolute -right-16 -top-16">
          <GaugeArcMotif size={300} color="#F4EDE4" opacity={0.2} />
        </div>
        <motion.h2 {...rise} className="relative mx-auto max-w-3xl text-4xl font-black leading-[1.05] tracking-[-0.02em] sm:text-6xl"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--lp-band-ink)' }}>
          Your brand already has a reputation. Start measuring it.
        </motion.h2>
        <motion.p {...rise} className="relative mx-auto mt-6 max-w-xl text-[15px]" style={{ color: 'rgba(244,237,228,0.6)' }}>
          Free while in beta. Connect a social account and see your first Brand Health Index in minutes.
        </motion.p>
        <motion.div {...rise} className="relative mt-10">
          <Link href="/auth/signup"
            className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-[15px] font-bold text-white shadow-[0_0_60px_rgba(224,106,50,0.45)] transition-transform hover:scale-[1.04]"
            style={{ background: '#E06A32' }}>
            Create your workspace <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="border-t px-6 py-10" style={{ borderColor: 'var(--lp-line)' }}>
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-2" style={{ color: 'var(--lp-ink)' }}>
          <GaugeMark className="h-5 w-5" />
          <Wordmark className="text-sm" />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--lp-mut)' }}>
          Made for West African marketers
        </p>
        <div className="flex gap-6 text-[12px]" style={{ color: 'var(--lp-mut)' }}>
          <Link href="/features" className="transition-opacity hover:opacity-60">Features</Link>
          <Link href="/use-cases" className="transition-opacity hover:opacity-60">Industries</Link>
          <Link href="/privacy-policy" className="transition-opacity hover:opacity-60">Privacy</Link>
          <a href="mailto:hello@brandgauge.app" className="transition-opacity hover:opacity-60">Contact</a>
        </div>
      </div>
    </footer>
  )
}

export function LandingPage() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (window.localStorage.getItem('bg-landing-theme') === 'dark') setDark(true)
    })
    return () => cancelAnimationFrame(id)
  }, [])
  function toggle() {
    setDark(d => {
      window.localStorage.setItem('bg-landing-theme', d ? 'light' : 'dark')
      return !d
    })
  }
  return (
    <main
      className="min-h-screen antialiased transition-colors duration-500"
      style={{ ...(dark ? DARK : LIGHT), ...(dark ? darkSceneVars : lightSceneVars), background: 'var(--lp-bg)', color: 'var(--lp-ink)' }}
    >
      <Nav dark={dark} onToggle={toggle} />
      <Hero />
      <div id="tour" className="scroll-mt-20"><HorizontalTour /></div>
      <Differentiators />
      <DeepDives />
      <Industries />
      <FinalCta />
      <Footer />
    </main>
  )
}
