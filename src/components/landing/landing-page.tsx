'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Moon, Sun } from 'lucide-react'
import { VideoHero } from './video-hero'
import { HorizontalTour } from './horizontal-tour'
import { AiScene, CompetitiveScene, darkSceneVars, lightSceneVars } from './scenes'
import { BrandLockup } from '@/components/brand/logo'

// Fade-and-slide-up on every element is banned: one reveal group per section,
// maximum, and it is the section's own .bg-reveal group in motion.css. What is
// left here is the shared easing, so the call sites keep reading the same.
const rise = {
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
}

// ————— theme palettes —————
export const LIGHT = {
  '--lp-bg': 'var(--bg-paper)', '--lp-ink': 'var(--bg-ink)', '--lp-mut': 'var(--tx-3)',
  '--lp-line': 'var(--line)', '--lp-card': 'var(--bg-card)', '--lp-glass': 'var(--bg-card)',
  '--lp-chip': 'var(--bg-shell)', '--lp-clay': 'var(--flare)', '--lp-band': 'var(--bg-ink)', '--lp-band-ink': 'var(--bg-shell)',
  '--lp-dot': 'var(--tick-1)',
} as React.CSSProperties

export const DARK = {
  '--lp-bg': 'var(--bg-ink)', '--lp-ink': 'var(--bg-shell)', '--lp-mut': 'var(--tx-3)',
  '--lp-line': 'var(--line)', '--lp-card': 'var(--bg-ink)', '--lp-glass': 'var(--bg-ink-raised)',
  '--lp-chip': 'var(--bg-shell)', '--lp-clay': 'var(--flare)', '--lp-band': 'var(--bg-ink)', '--lp-band-ink': 'var(--bg-shell)',
  '--lp-dot': 'var(--tick-1)',
} as React.CSSProperties

/** The lockup as supplied. The wordmark is not set in type here. */
export function Wordmark({ height = 22, dark = false }: { height?: number; dark?: boolean }) {
  return <BrandLockup height={height} ground={dark ? 'ink' : 'paper'} />
}

export function Nav({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-4 mt-4 flex max-w-6xl items-center justify-between rounded-2xl border px-4 py-3 backdrop-blur-xl sm:mx-6 sm:px-5 lg:mx-auto"
        style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-glass)' }}>
        <Link href="/" className="flex items-center gap-2.5" style={{ color: 'var(--lp-ink)' }}>
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-7 text-[11px] md:flex" style={{ color: 'var(--lp-mut)' }}>
          <a href="/#tour" className="transition-opacity hover:opacity-60">Product</a>
          <Link href="/features" className="transition-opacity hover:opacity-60">Features</Link>
          <Link href="/use-cases" className="transition-opacity hover:opacity-60">Industries</Link>
          <a href="/#builtforhere" className="transition-opacity hover:opacity-60">Why us</a>
        </nav>
        <div className="flex items-center gap-2.5">
          <button onClick={onToggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex h-9 w-9 items-center justify-center rounded-full border transition-transform hover:rotate-12 bg-press"
            style={{ borderColor: 'var(--lp-line)', color: 'var(--lp-ink)' }}>
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link href="/auth/login" className="hidden text-[13px] font-medium transition-opacity hover:opacity-70 sm:block" style={{ color: 'var(--lp-ink)' }}>Sign in</Link>
          <Link href="/auth/signup"
            className="whitespace-nowrap rounded-sm px-4 py-2 text-[13px] font-bold text-tx-inv transition-transform border border-line"
            style={{ background: 'var(--lp-clay)' }}>
            Start free
          </Link>
        </div>
      </div>
    </header>
  )
}

/** Mouse-follow tilt wrapper: the "hold the product in your hand" delighter. */
/** The demo sits flat. Nothing in this brand tilts toward the cursor. */
function Tilt({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
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

/** A reading is printed, not counted up to. The reading is not a slot machine. */
function Reading({ to, suffix = '' }: { to: number; suffix?: string }) {
  return <span>{to}{suffix}</span>
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
        <div className="absolute -left-24 top-40 opacity-70"><div><CircleMotif /></div></div>
        <div className="absolute -right-16 top-[560px] opacity-50"><div><CircleMotif size={220} /></div></div>
        <div className="absolute left-1/2 top-[-180px] h-[420px] w-[820px] -translate-x-1/2 rounded-sm blur-[130px]"
          style={{ background: 'var(--bg-shell)' }} />
        <div className="absolute left-1/2 top-[380px] h-[380px] w-[700px] -translate-x-1/2 rounded-sm blur-[130px]"
          style={{ background: 'var(--bg-shell)' }} />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 text-center">
        <motion.p {...rise} className="text-[11px]" style={{ color: 'var(--tx-flare)' }}>
          Brand intelligence built in Lagos, for West Africa
        </motion.p>
        <h1 className="mx-auto mt-5 max-w-4xl text-5xl font-black leading-[1.02] tracking-[-0.03em] sm:text-7xl"
          style={{ fontFamily: 'var(--font)', color: 'var(--lp-ink)' }}>
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
          BrandGauge reads sentiment in Pidgin, Yoruba, Igbo and Hausa. It measures every
          channel, from Instagram to a billboard on the expressway. Then it turns it all
          into numbers your board will trust.
        </motion.p>
        <motion.div {...rise} transition={{ ...rise.transition, delay: 0.6 }} className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Link href="/auth/signup"
            className="group flex items-center gap-2 rounded-sm px-6 py-3.5 text-[14px] font-bold text-tx-inv transition-transform border border-line"
            style={{ background: 'var(--lp-clay)' }}>
            Start free in beta
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a href="#demo" className="rounded-sm border px-6 py-3.5 text-[14px] font-medium transition-colors"
            style={{ borderColor: 'var(--lp-line)', color: 'var(--lp-ink)' }}>
            Watch the demo
          </a>
        </motion.div>

        {/* the unveil film, framed and held in the viewer's hand */}
        <motion.div id="demo" {...rise} transition={{ ...rise.transition, delay: 0.72 }} className="relative mx-auto mt-16 max-w-4xl scroll-mt-28">
          <Tilt><VideoHero /></Tilt>
        </motion.div>
        {/* The connectors, listed. Nothing here loops. */}
        <div className="relative mt-16">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[10px]" style={{ color: 'var(--lp-mut)' }}>
            {['Meta Ads', 'Instagram', 'X', 'GA4', 'Paystack', 'Mailchimp', 'Site Pixel', 'First-party API'].map(c => (
              <span key={c}>{c}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

const DIFFS = [
  { n: '01', title: 'It speaks your market’s language', body: 'Sentiment models that understand Pidgin, Yoruba, Igbo and Hausa, tuned on how customers here actually talk about brands. Global tools guess. This one knows.' },
  { n: '02', title: 'Your field team becomes a data source', body: 'Ambassadors capture leads at events through a phone-first app. Field officers log store visits. It all lands on the same dashboard as your ads.' },
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
        <div className="absolute -left-20 -top-16 opacity-40"><div><CircleMotif size={200} /></div></div>
        <div className="absolute -bottom-32 -right-24"><div><GaugeArcMotif size={560} opacity={0.24} /></div></div>
        <div className="absolute right-0 top-0 h-[360px] w-[560px] rounded-sm blur-[130px]"
          style={{ background: 'var(--bg-shell)' }} />
        <div className="absolute -bottom-40 left-0 h-[340px] w-[600px] rounded-sm blur-[130px]"
          style={{ background: 'var(--bg-shell)' }} />
      </div>

      <div className="relative mx-auto max-w-6xl px-6">
        <motion.p {...rise} className="text-[11px]" style={{ color: 'var(--tx-flare)' }}>Why BrandGauge</motion.p>
        <motion.h2 {...rise} className="mt-4 max-w-2xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl"
          style={{ fontFamily: 'var(--font)', color: 'var(--lp-ink)' }}>
          Built for here. Not adapted for here.
        </motion.h2>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DIFFS.map((d, i) => (
            <motion.div key={d.n} {...rise} transition={{ ...rise.transition, delay: i * 0.05 }}
              className="group relative overflow-hidden rounded-2xl border p-7 transition-colors duration-300"
              style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-card)' }}>
              {/* clay corner sweep on hover */}
              <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                style={{ background: 'var(--bg-shell)' }} />
              <span className="bg-num text-[11px]" style={{ color: 'var(--tx-flare)' }}>{d.n}</span>
              <h3 className="mt-3 text-[17px] font-bold leading-snug" style={{ fontFamily: 'var(--font)', color: 'var(--lp-ink)' }}>{d.title}</h3>
              <p className="mt-2.5 text-[13px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>{d.body}</p>
            </motion.div>
          ))}
        </div>

        {/* stats band */}
        <motion.div {...rise} className="relative mt-16 grid grid-cols-2 gap-4 rounded-2xl border p-8 text-center sm:grid-cols-4"
          style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-chip)' }}>
          <div className="pointer-events-none absolute -bottom-16 -right-10"><div><GaugeArcMotif size={220} opacity={0.3} /></div></div>
          {[
            { v: 4,  s: '',  label: 'languages read natively' },
            { v: 7,  s: '',  label: 'industry playbooks' },
            { v: 10, s: '+', label: 'live connectors' },
            { v: 5,  s: '',  label: 'offline channels measured' },
          ].map(st => (
            <div key={st.label} className="relative">
              <p className="text-4xl font-black bg-num" style={{ fontFamily: 'var(--font-num)', color: 'var(--tx-flare)' }}>
                <Reading to={st.v} suffix={st.s} />
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
        <div className="absolute -left-32 top-1/4 opacity-30"><div><CircleMotif size={380} /></div></div>
        <div className="absolute -right-20 top-0 h-[360px] w-[520px] rounded-sm blur-[140px]"
          style={{ background: 'var(--bg-shell)' }} />
        <div className="absolute -left-10 bottom-0 h-[320px] w-[480px] rounded-sm blur-[140px]"
          style={{ background: 'var(--bg-shell)' }} />
      </div>

      <div className="relative mx-auto max-w-6xl space-y-24 px-6">
        {[
          { Comp: AiScene, kicker: 'AI command layer', title: 'Ask your data anything',
            body: 'Plain questions, straight answers, sourced from your own numbers. And once a week, BrandGauge asks the big AI assistants about your category. It scores how you show up.' },
          { Comp: CompetitiveScene, kicker: 'Competitive intelligence', title: 'Know their moves before Monday',
            body: 'Share of voice, competitor sightings and an auto-written briefing at the start of every week. When a rival cuts prices, you hear it from us first.' },
        ].map((s, i) => (
          <motion.div key={s.kicker} {...rise}
            className={`flex flex-col gap-10 lg:items-center ${i % 2 ? 'lg:flex-row-reverse' : 'lg:flex-row'}`}>
            <div className="lg:w-[38%]">
              <p className="text-[10px]" style={{ color: 'var(--tx-flare)' }}>{s.kicker}</p>
              <h3 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl" style={{ fontFamily: 'var(--font)', color: 'var(--lp-ink)' }}>{s.title}</h3>
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
          <div><GaugeArcMotif size={620} opacity={0.22} /></div>
        </div>
        <div className="absolute left-1/2 top-0 h-[300px] w-[560px] -translate-x-1/2 rounded-sm blur-[130px]"
          style={{ background: 'var(--bg-shell)' }} />
      </div>

      <div className="relative mx-auto max-w-6xl px-6">
        <motion.h2 {...rise} className="text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ fontFamily: 'var(--font)', color: 'var(--lp-ink)' }}>
          One gauge. Seven industries.
        </motion.h2>
        <motion.p {...rise} className="mx-auto mt-4 max-w-xl text-[14px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>
          Pick your industry once. The health index, funnel signals and connector
          recommendations reshape themselves around how your business actually works.
        </motion.p>
        <motion.div {...rise} className="mt-10 flex flex-wrap justify-center gap-3">
          {list.map((v, i) => (
            <button key={v.name} onClick={() => setActive(i)} onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)}
              className="rounded-sm border px-5 py-2.5 text-[13px] transition-colors duration-200 bg-press"
              style={active === i
                ? { borderColor: 'var(--flare)', color: 'var(--bg-paper)', background: 'var(--flare)' }
                : { borderColor: 'var(--lp-line)', color: 'var(--lp-ink)', background: 'var(--lp-card)' }}>
              {v.name}
            </button>
          ))}
        </motion.div>
        <p className="mx-auto mt-6 h-6 max-w-md text-[11px]" style={{ color: 'var(--lp-mut)' }}>
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
          backgroundImage: 'radial-gradient(var(--tick-1) 1px, transparent 1px)', backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(70% 80% at 50% 50%, black, transparent)',
        }} />
        <div className="pointer-events-none absolute -right-16 -top-16">
          <div><GaugeArcMotif size={300} color="var(--bg-shell)" opacity={0.2} /></div>
        </div>
        <motion.h2 {...rise} className="relative mx-auto max-w-3xl text-4xl font-black leading-[1.05] tracking-[-0.02em] sm:text-6xl"
          style={{ fontFamily: 'var(--font)', color: 'var(--lp-band-ink)' }}>
          Your brand already has a reputation. Start measuring it.
        </motion.h2>
        <motion.p {...rise} className="relative mx-auto mt-6 max-w-xl text-[15px]" style={{ color: 'var(--tx-inv-2)' }}>
          Free while in beta. Connect a social account and see your first Brand Health Index in minutes.
        </motion.p>
        <motion.div {...rise} className="relative mt-10">
          <Link href="/auth/signup"
            className="inline-flex items-center gap-2 rounded-sm px-8 py-4 text-[15px] font-bold text-tx-inv transition-transform border border-line"
            style={{ background: 'var(--ember)' }}>
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
          <Wordmark height={16} />
        </div>
        <p className="text-[10px]" style={{ color: 'var(--lp-mut)' }}>
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

/**
 * Cursor-reactive backdrop driver. Desktop pointer-fine only, and respects
 * prefers-reduced-motion. A single rAF loop eases the pointer toward its target and
 * writes the result to CSS custom properties on the root element (`--lp-x/--lp-y` in
 * viewport px for the spotlight mask, `--lp-px/--lp-py` normalised -0.5..0.5 for
 * parallax, `--lp-glow` for fade). Nothing here calls setState on move, so the
 * backdrop animates with zero React re-renders. Returns whether the effect is live so
 * the caller can skip rendering the overlay entirely on touch / reduced-motion.
 */
function useCursorBackdrop(ref: React.RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof window === 'undefined' || !window.matchMedia) return
    const fine = window.matchMedia('(pointer: fine)')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!fine.matches || reduce.matches) return
    const activateId = requestAnimationFrame(() => setActive(true))

    const tgt = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    const cur = { x: tgt.x, y: tgt.y }
    let raf = 0
    let running = false
    let lastMove = 0

    const write = () => {
      el.style.setProperty('--lp-x', cur.x.toFixed(1) + 'px')
      el.style.setProperty('--lp-y', cur.y.toFixed(1) + 'px')
      el.style.setProperty('--lp-px', (cur.x / window.innerWidth - 0.5).toFixed(4))
      el.style.setProperty('--lp-py', (cur.y / window.innerHeight - 0.5).toFixed(4))
    }
    const tick = () => {
      cur.x += (tgt.x - cur.x) * 0.14
      cur.y += (tgt.y - cur.y) * 0.14
      write()
      const settled = Math.hypot(tgt.x - cur.x, tgt.y - cur.y) < 0.4
      if (settled && performance.now() - lastMove > 250) { running = false; return }
      raf = requestAnimationFrame(tick)
    }
    const run = () => { if (!running) { running = true; raf = requestAnimationFrame(tick) } }
    const onMove = (e: PointerEvent) => {
      tgt.x = e.clientX
      tgt.y = e.clientY
      lastMove = performance.now()
      el.style.setProperty('--lp-glow', '1')
      run()
    }
    const onLeave = () => el.style.setProperty('--lp-glow', '0')

    write()
    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)
    window.addEventListener('blur', onLeave)
    return () => {
      cancelAnimationFrame(activateId)
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('blur', onLeave)
    }
  }, [ref])
  return active
}

/** Viewport-fixed layer that trails the cursor: a soft clay glow plus the Adire dot-grid
 *  lighting up in place through a radial mask that follows the pointer. Sits behind all
 *  content (main sets `isolation: isolate`). Movement is transform / mask only. */
function CursorField() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10"
      style={{ opacity: 'var(--lp-glow, 0)', transition: 'opacity 0.5s ease' }}>
      {/* clay glow blob, moved by transform (compositor-only) */}
      <div className="absolute left-0 top-0 h-[620px] w-[620px] rounded-sm blur-[85px]"
        style={{
          transform: 'translate3d(var(--lp-x, -9999px), var(--lp-y, -9999px), 0) translate(-50%, -50%)',
          background: 'var(--bg-shell)',
          willChange: 'transform',
        }} />
      {/* a defined ring right at the cursor, so the pointer itself reads as the source */}
      <div className="absolute left-0 top-0 h-[70px] w-[70px] rounded-sm"
        style={{
          transform: 'translate3d(var(--lp-x, -9999px), var(--lp-y, -9999px), 0) translate(-50%, -50%)',
          border: '1px solid var(--lp-clay)',
          opacity: 0.18,
          willChange: 'transform',
        }} />
      {/* dot grid revealed in place around the pointer via a cursor-tracking radial mask */}
      <div className="absolute inset-0"
        style={{
          backgroundImage: 'var(--lp-clay)',
          backgroundSize: '26px 26px',
          opacity: 0.5,
          WebkitMaskImage: 'radial-gradient(260px circle at var(--lp-x, -999px) var(--lp-y, -999px), rgba(0,0,0,0.95), transparent 72%)',
          maskImage: 'radial-gradient(260px circle at var(--lp-x, -999px) var(--lp-y, -999px), rgba(0,0,0,0.95), transparent 72%)',
        }} />
    </div>
  )
}

export function LandingPage() {
  const [dark, setDark] = useState(false)
  const rootRef = useRef<HTMLElement>(null)
  const cursorLive = useCursorBackdrop(rootRef)
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
      ref={rootRef}
      className="min-h-screen antialiased transition-colors duration-500"
      style={{ ...(dark ? DARK : LIGHT), ...(dark ? darkSceneVars : lightSceneVars), background: 'var(--lp-bg)', color: 'var(--lp-ink)', isolation: 'isolate' }}
    >
      {cursorLive && <CursorField />}
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
