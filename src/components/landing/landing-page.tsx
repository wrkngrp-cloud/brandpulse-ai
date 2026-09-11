'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ArrowRightIcon as ArrowRight, MoonIcon as Moon, SunIcon as Sun } from '@/components/brand/icon'
import { VideoHero } from './video-hero'
import { ProductCards } from './product-cards'
import { AiScene, darkSceneVars, lightSceneVars } from './scenes'
import { BrandLockup } from '@/components/brand/logo'
import { useDarkGround, useMode } from './use-mode'
import { HERO_PHOTOS } from './photo-frame'

// Fade-and-slide-up on every element is banned: one reveal group per section,
// maximum, and it is the section's own .bg-reveal group in motion.css. What is
// left here is the shared easing, so the call sites keep reading the same.
const rise = {
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
}

// ————— theme —————
/**
 * One palette. The `--lp-*` variables map onto the tokens, and the tokens flip
 * under [data-mode="dark"], so the page cannot disagree with the app's mode.
 * Two hand-kept copies is how the headline ended up ink on ink.
 *
 * `--lp-band` is the raised ink plane, one value in both modes: on Paper it
 * reads as the ink band, and on Ink it still stands off the ground instead of
 * collapsing into it. Its type is therefore fixed Paper.
 */
export const LP_VARS = {
  '--lp-bg': 'var(--bg-paper)',
  '--lp-ink': 'var(--tx)',
  '--lp-mut': 'var(--tx-3)',
  '--lp-line': 'var(--line)',
  '--lp-card': 'var(--bg-card)',
  '--lp-glass': 'var(--bg-paper)',   /* the nav bar: the ground plane, so the supplied lockup's own ground matches it */
  '--lp-chip': 'var(--bg-shell)',
  '--lp-clay': 'var(--flare)',
  '--lp-band': 'var(--bg-ink-raised)',
  '--lp-band-ink': 'var(--tx-inv)',
  '--lp-dot': 'var(--tick-1)',
} as React.CSSProperties

/** Kept for the film, which renders these scenes outside the app. */
export const LIGHT = LP_VARS
export const DARK = LP_VARS

/**
 * The lockup as supplied. The wordmark is not set in type here.
 *
 * Ground follows the document mode: each supplied file carries its own
 * full-bleed ground rect, so the Paper lockup draws a Paper box on ink.
 */
export function Wordmark({ height = 22 }: { height?: number }) {
  const dark = useDarkGround()
  return <BrandLockup height={height} ground={dark ? 'ink' : 'paper'} />
}

/**
 * The masthead.
 *
 * It was a floating pill: `rounded-2xl` on a system with four radii, none of
 * them 16px, and it landed in the middle of the hero photograph like a sticker.
 * A full-width bar closed by a hairline is both the correct radius (none) and
 * the right shape for a page whose hero now runs edge to edge.
 */
export function Nav({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b" style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-glass)' }}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <Link href="/" className="flex items-center gap-2.5" style={{ color: 'var(--lp-ink)' }}>
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-7 text-[11px] md:flex" style={{ color: 'var(--lp-mut)' }}>
          <Link href="/#tour" className="transition-opacity hover:opacity-60">Product</Link>
          <Link href="/features" className="transition-opacity hover:opacity-60">Features</Link>
          <Link href="/use-cases" className="transition-opacity hover:opacity-60">Industries</Link>
          <Link href="/#builtforhere" className="transition-opacity hover:opacity-60">Why us</Link>
        </nav>
        <div className="flex items-center gap-2.5">
          <button onClick={onToggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex h-9 w-9 items-center justify-center rounded-sm border bg-press"
            style={{ borderColor: 'var(--lp-line)', color: 'var(--lp-ink)' }}>
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link href="/auth/login" className="hidden text-[13px] font-medium transition-opacity hover:opacity-70 sm:block" style={{ color: 'var(--lp-ink)' }}>Sign in</Link>
          <Link href="/auth/signup"
            className="whitespace-nowrap rounded-sm border border-line px-4 py-2 text-[13px] font-bold bg-press" style={{ background: 'var(--tx)', color: 'var(--bg-paper)' }}>
            Start free
          </Link>
        </div>
      </div>
    </header>
  )
}

/** A reading is printed, not counted up to. The reading is not a slot machine. */
function Reading({ to, suffix = '' }: { to: number; suffix?: string }) {
  return <span>{to}{suffix}</span>
}

/**
 * The hero.
 *
 * Two earlier attempts failed for the same reason: a widget sat in it. First a
 * drawn dashboard, then the gauge on a card in the bottom-right corner. A gauge
 * reading 95 that belongs to nobody is a decoration of a number, and putting it
 * beside the headline asks the reader to trust a figure before they know what it
 * measures. The real gauge is a scroll away, attached to a real workspace.
 *
 * What replaces it is a split: type on the ink plane, photograph flush to the
 * right edge and bleeding off it, a hairline between them, and a rule of four
 * readouts closing the block. The photograph is the subject — the street the
 * brand is being judged on — so it gets its own plane rather than being buried
 * under a scrim so the type can survive on top of it.
 */
function Hero() {
  const street = HERO_PHOTOS.street
  return (
    <section className="relative isolate" style={{ background: 'var(--bg-ink)' }}>
      <div className="mx-auto grid w-full grid-cols-1 lg:grid-cols-12">
        {/* ── Type ─────────────────────────────────────────────────────── */}
        <div className="relative order-2 flex flex-col justify-center px-6 pb-16 pt-14 sm:px-10 lg:order-1 lg:col-span-7 lg:min-h-[86vh] lg:py-40 lg:pl-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))] lg:pr-16">
          {/* The mark's own material, held well behind the type. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{
            backgroundImage: 'radial-gradient(var(--tick-1) 1.4px, transparent 1.4px)',
            backgroundSize: '30px 30px',
            maskImage: 'radial-gradient(70% 60% at 20% 40%, black, transparent)',
            WebkitMaskImage: 'radial-gradient(70% 60% at 20% 40%, black, transparent)',
          }} />

          <motion.div {...rise}>
            <p className="text-[11px]" style={{ color: 'var(--danfo)' }}>
              Brand intelligence built in Lagos, for West Africa
            </p>
            <h1 className="mt-5 text-5xl font-black leading-[1.02] tracking-[-0.03em] sm:text-6xl xl:text-7xl"
              style={{ fontFamily: 'var(--font)', color: 'var(--tx-inv)' }}>
              See your brand the way the{' '}
              <span style={{ color: 'var(--danfo)' }}>street</span> sees it.
            </h1>
            <p className="mt-6 max-w-xl text-[15px] leading-relaxed sm:text-lg" style={{ color: 'var(--tx-inv-2)' }}>
              BrandGauge reads sentiment in Pidgin, Yoruba, Igbo and Hausa. It measures every
              channel, from Instagram to a billboard on the expressway. Then it turns it all
              into numbers your board will trust.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:gap-4">
              <Link href="/auth/signup"
                className="flex items-center justify-center gap-2 rounded-sm px-6 py-3.5 text-[14px] font-bold text-on-hot bg-press"
                style={{ background: 'var(--flare)' }}>
                Start free in beta
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#demo" className="rounded-sm border px-6 py-3.5 text-center text-[14px] font-medium"
                style={{ borderColor: 'var(--line-inv)', color: 'var(--tx-inv)' }}>
                Watch the demo
              </a>
            </div>
            <div className="mt-12 flex max-w-xl flex-wrap gap-x-6 gap-y-2 text-[10px]" style={{ color: 'var(--tx-inv-2)' }}>
              {['Meta Ads', 'Instagram', 'X', 'GA4', 'Paystack', 'Mailchimp', 'Site Pixel', 'First-party API'].map(c => (
                <span key={c}>{c}</span>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ── The street ───────────────────────────────────────────────── */}
        <div className="relative order-1 min-h-[46vh] border-line-inv pt-16 lg:order-2 lg:col-span-5 lg:min-h-0 lg:border-l lg:pt-0">
          {street.src && (
            <Image src={street.src} alt={street.brief} fill priority
              sizes="(max-width: 1024px) 100vw, 42vw" className="object-cover" />
          )}
          {/* A short hold at the foot of the frame so the caption has a ground. */}
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-32" style={{
            background: 'linear-gradient(to top, color-mix(in srgb, var(--bg-ink) 82%, transparent), transparent)',
          }} />
          <span className="bg-label absolute bottom-5 left-5" style={{ color: 'var(--tx-inv)' }}>
            The market, 07:40
          </span>
        </div>
      </div>

      {/* ── The rule that closes the block ───────────────────────────── */}
      <div className="border-t border-line-inv">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-6 sm:grid-cols-4">
          {HERO_READINGS.map(r => (
            <div key={r.label} className="py-7 sm:py-8">
              <dt className="text-[10px]" style={{ color: 'var(--tx-inv-2)' }}>{r.label}</dt>
              <dd className="bg-num mt-2 text-3xl leading-none" style={{ color: 'var(--tx-inv)' }}>{r.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

const HERO_READINGS = [
  { value: '7', label: 'Industries the index reshapes for' },
  { value: '4', label: 'Nigerian languages read natively' },
  { value: '04:00', label: 'Nightly refresh, Lagos time' },
  { value: '1', label: 'Number your board asks about' },
]

/**
 * The rest of the photography, under the film.
 *
 * Three frames, hairlined, each labelled with what it is. The page argues that
 * a brand is judged out on the road, so the road belongs on the page more than
 * once.
 */
function StreetStrip() {
  const shots = [HERO_PHOTOS.aerial, HERO_PHOTOS.billboard, HERO_PHOTOS.roundabout]
  return (
    <section aria-label="Where the brand is judged" className="px-6 pb-8 pt-20">
      <div className="mx-auto max-w-6xl">
        <p className="text-[11px]" style={{ color: 'var(--tx-flare)' }}>Where the brand is judged</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl"
          style={{ fontFamily: 'var(--font)', color: 'var(--lp-ink)' }}>
          Your budget goes out here. So should your measurement.
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {shots.map((photo, i) => (
            <figure key={photo.slot} className={i === 1 ? 'sm:mt-12' : undefined}>
              <div className="relative w-full overflow-hidden rounded-sm border border-line"
                style={{ aspectRatio: i === 1 ? '4 / 5' : '4 / 3' }}>
                {photo.src && (
                  <Image src={photo.src} alt={photo.brief} fill
                    sizes="(max-width: 640px) 100vw, 31vw" className="object-cover" />
                )}
              </div>
              <figcaption className="bg-label mt-2.5" style={{ color: 'var(--lp-mut)' }}>{photo.slot}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

/**
 * The film, on Paper, directly under the hero.
 *
 * It used to float at `max-w-4xl` while every section around it ran to
 * `max-w-6xl`, so it sat narrower and centred against left-aligned headings —
 * the page looked like two pages. Same column, same left edge, with a heading
 * of its own so it reads as a section instead of an orphaned box.
 */
function HeroFilm() {
  return (
    <section className="px-6 pb-4 pt-24">
      <div className="mx-auto max-w-6xl">
        <p className="text-[11px]" style={{ color: 'var(--tx-flare)' }}>Ninety seconds</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl"
          style={{ fontFamily: 'var(--font)', color: 'var(--lp-ink)' }}>
          The whole thing, start to finish.
        </h2>
        <motion.div id="demo" {...rise} className="mt-10 scroll-mt-28">
          <VideoHero />
        </motion.div>
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
      {/* The tick field, and nothing else. */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(var(--lp-dot) 1px, transparent 1px)',
          backgroundSize: '26px 26px',
          maskImage: 'radial-gradient(65% 70% at 50% 0%, black, transparent)',
        }} />
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
              className="relative overflow-hidden rounded-sm border p-7"
              style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-card)' }}>
              <span className="bg-num text-[11px]" style={{ color: 'var(--tx-flare)' }}>{d.n}</span>
              <h3 className="mt-3 text-[17px] font-bold leading-snug" style={{ fontFamily: 'var(--font)', color: 'var(--lp-ink)' }}>{d.title}</h3>
              <p className="mt-2.5 text-[13px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>{d.body}</p>
            </motion.div>
          ))}
        </div>

        {/* stats band */}
        <motion.div {...rise} className="relative mt-16 grid grid-cols-2 divide-y divide-line rounded-sm border sm:grid-cols-4 sm:divide-x sm:divide-y-0"
          style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-chip)' }}>
          {[
            { v: 4,  s: '',  label: 'languages read natively' },
            { v: 7,  s: '',  label: 'industry playbooks' },
            { v: 10, s: '+', label: 'live connectors' },
            { v: 5,  s: '',  label: 'offline channels measured' },
          ].map(st => (
            <div key={st.label} className="relative p-7">
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

/**
 * The AI command layer.
 *
 * This was two panels. The second one, Competitive intelligence, said the same
 * thing as the Monday-briefing card in the product grid above it — and said it
 * with a drawing, on a page that has just promised the screens are real. The
 * card with the actual screenshot wins.
 */
function DeepDives() {
  return (
    <section className="relative overflow-hidden py-16">

      <div className="relative mx-auto max-w-6xl space-y-24 px-6">
        {[
          { Comp: AiScene, kicker: 'AI command layer', title: 'Ask your data anything',
            body: 'Plain questions, straight answers, sourced from your own numbers. And once a week, BrandGauge asks the big AI assistants about your category. It scores how you show up.' },
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
    <section id="industries" className="relative overflow-hidden scroll-mt-24 py-24">
      {/* The tick field, bookending the hero's. */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(var(--lp-dot) 1px, transparent 1px)',
          backgroundSize: '26px 26px',
          maskImage: 'radial-gradient(60% 65% at 50% 50%, black, transparent)',
        }} />
      </div>

      <div className="relative mx-auto max-w-6xl px-6">
        <motion.p {...rise} className="text-[11px]" style={{ color: 'var(--tx-flare)' }}>Seven verticals</motion.p>
        <motion.h2 {...rise} className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ fontFamily: 'var(--font)', color: 'var(--lp-ink)' }}>
          One gauge. Seven industries.
        </motion.h2>
        <motion.p {...rise} className="mt-4 max-w-xl text-[14px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>
          Pick your industry once. The health index, funnel signals and connector
          recommendations reshape themselves around how your business actually works.
        </motion.p>
        <motion.div {...rise} className="mt-10 flex flex-wrap gap-3">
          {list.map((v, i) => (
            <button key={v.name} onClick={() => setActive(i)} onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)}
              className="rounded-sm border px-5 py-2.5 text-[13px] transition-colors duration-200 bg-press"
              style={active === i
                ? { borderColor: 'var(--tx)', color: 'var(--bg-paper)', background: 'var(--tx)' }
                : { borderColor: 'var(--lp-line)', color: 'var(--lp-ink)', background: 'var(--lp-card)' }}>
              {v.name}
            </button>
          ))}
        </motion.div>
        <p className="mt-6 h-6 max-w-md text-[11px]" style={{ color: 'var(--lp-mut)' }}>
          {list[active].hint}
        </p>
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="px-6 pb-24 pt-8">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-sm px-6 py-24 text-center"
        style={{ background: 'var(--lp-band)' }}>
        <div className="pointer-events-none absolute inset-0" style={{
          backgroundImage: 'radial-gradient(var(--tick-1) 1px, transparent 1px)', backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(70% 80% at 50% 50%, black, transparent)',
        }} />
        <motion.h2 {...rise} className="relative mx-auto max-w-3xl text-4xl font-black leading-[1.05] tracking-[-0.02em] sm:text-6xl"
          style={{ fontFamily: 'var(--font)', color: 'var(--lp-band-ink)' }}>
          Your brand already has a reputation. Start measuring it.
        </motion.h2>
        <motion.p {...rise} className="relative mx-auto mt-6 max-w-xl text-[15px]" style={{ color: 'var(--tx-inv-2)' }}>
          Free while in beta. Connect a social account and see your first Brand Health Index in minutes.
        </motion.p>
        <motion.div {...rise} className="relative mt-10">
          <Link href="/auth/signup"
            className="inline-flex items-center gap-2 rounded-sm px-8 py-4 text-[15px] font-bold border border-line"
            style={{ background: 'var(--flare)', color: 'var(--on-hot)' }}>
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
// A layer that trails the cursor is decoration: it represents no value, no
// state and no touch, so it does not ship. The dot field it lit is now a
// static tick field behind the hero.

export function LandingPage() {
  const { dark, toggle } = useMode()
  const rootRef = useRef<HTMLElement>(null)

  return (
    <main
      ref={rootRef}
      className="min-h-screen antialiased transition-colors duration-500"
      style={{ ...LP_VARS, ...(dark ? darkSceneVars : lightSceneVars), background: 'var(--lp-bg)', color: 'var(--lp-ink)', isolation: 'isolate' }}
    >
      <Nav dark={dark} onToggle={toggle} />
      <Hero />
      <HeroFilm />
      <ProductCards />
      <StreetStrip />
      <Differentiators />
      <DeepDives />
      <Industries />
      <FinalCta />
      <Footer />
    </main>
  )
}
