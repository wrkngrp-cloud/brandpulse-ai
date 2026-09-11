'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useInView } from 'framer-motion'
import { ArrowRightIcon as ArrowRight, MoonIcon as Moon, SunIcon as Sun } from '@/components/brand/icon'
import { VideoHero } from './video-hero'
import { ProductCards } from './product-cards'
import { AiScene, darkSceneVars, lightSceneVars } from './scenes'
import { BrandLockup } from '@/components/brand/logo'
import { useDarkGround, useMode } from './use-mode'
import { HERO_PHOTOS } from './photo-frame'
import { HeatRow, ReadingLine, ReadingRail, Tick, TickReveal } from './reading'
import { ARC_ASPECT, TickArcMask, TickRowMask, rowAspect, useArcReveal } from './tick-mask'

/** The unrolled run's proportion, measured once. */
const ROW_ASPECT = rowAspect(6, 1.7)

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

/**
 * The hero.
 *
 * Three earlier attempts failed the same way. A drawn dashboard, then a gauge
 * on a card reading 95 for nobody, then a split with the photograph in a
 * rectangle on the right. All three put the mark *beside* the page instead of
 * making it the page, and the last one was the worst of them: a picture in a
 * box is a picture in a box, whoever owns the box.
 *
 * So the arc is the subject. The market comes through the mark's own seven
 * ticks, on the engine's sweep and the engine's growth curve, and the claim
 * sits in the bowl the arc leaves under itself. Nothing is decorating anything:
 * the shape is holding the photograph up, and the negative space it encloses is
 * where the type had to go.
 *
 * It reads cold to hot left to right because that is the only direction heat
 * runs in this system, and it arrives one aperture at a time because that is
 * how a reading rises. By the time the last tick opens on the right, the
 * picture is densest exactly where the gauge would be hottest.
 */
export function Hero() {
  const street = HERO_PHOTOS.street
  const [shown, setShown] = useState(false)
  const reveal = useArcReveal({ start: shown })
  return (
    <section className="relative isolate overflow-hidden" style={{ background: 'var(--bg-ink)' }}>
      {/* The mark's own material, held well behind everything. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{
        backgroundImage: 'radial-gradient(var(--tick-1) 1.4px, transparent 1.4px)',
        backgroundSize: '30px 30px',
        maskImage: 'radial-gradient(60% 50% at 50% 30%, black, transparent)',
        WebkitMaskImage: 'radial-gradient(60% 50% at 50% 30%, black, transparent)',
      }} />

      <div className="mx-auto w-full max-w-6xl px-6 pb-14 pt-24 sm:pt-28 lg:pb-20 lg:pt-32">
        <p className="text-center text-[11px]" style={{ color: 'var(--danfo)' }}>
          Brand intelligence built in Lagos, for West Africa
        </p>

        {/* ── The arc ────────────────────────────────────────────────
            The frame is the arc's own measured proportion, so the head tick
            keeps its full width and depth. Two earlier hand-set boxes cropped
            it, which loses the hot end: the one end that carries the reading. */}
        <div className="relative mt-8 w-full sm:mt-10" style={{ aspectRatio: ARC_ASPECT }}>
          <TickArcMask id="hero-arc" reveal={reveal} className="h-full w-full">
            <div className="relative h-full w-full">
              {street.src && (
                <Image src={street.src} alt={street.brief} fill priority
                  onLoad={() => setShown(true)}
                  sizes="(max-width: 1152px) 100vw, 1152px" className="object-cover" />
              )}
            </div>
          </TickArcMask>
          <span className="bg-label absolute bottom-0 left-0 hidden lg:block" style={{ color: 'var(--tx-inv-2)' }}>
            {street.slot}, 07:40
          </span>

          {/* ── The bowl ───────────────────────────────────────────────
              In flow under the arc on a phone, where the sweep is too
              shallow to hold anything. Lifted into the negative space from
              lg, and positioned rather than pulled up by a negative margin:
              a margin shortens the section, which cropped the head tick off
              the foot of the frame. Centred on the bowl at 44% rather than on
              the frame at 50%, because the sweep is not symmetrical and the
              type wants to sit away from the dense end, not under it. */}
          <div className="relative mx-auto mt-10 max-w-xl text-center lg:absolute lg:left-[44%] lg:top-[40%] lg:mt-0 lg:w-[52%] lg:max-w-none lg:-translate-x-1/2">
            <div aria-hidden className="pointer-events-none absolute -inset-x-12 -inset-y-8 -z-10 hidden lg:block" style={{
              background: 'radial-gradient(62% 62% at 50% 52%, var(--bg-ink) 58%, transparent)',
            }} />
            <ReadingLine
              text="See your brand the way the street sees it."
              accent="street"
              accentStyle={{ color: 'var(--danfo)' }}
              className="text-[2.25rem] font-black leading-[1.04] tracking-[-0.03em] sm:text-5xl xl:text-[3.4rem]"
              style={{ fontFamily: 'var(--font)', color: 'var(--tx-inv)' }}
            />
            <p className="mx-auto mt-5 max-w-lg text-[15px] leading-relaxed sm:text-base" style={{ color: 'var(--tx-inv-2)' }}>
              BrandGauge reads sentiment in Pidgin, Yoruba, Igbo and Hausa. It measures every
              channel, from Instagram to a billboard on the expressway. Then it turns it all
              into numbers your board will trust.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row sm:gap-4">
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
          </div>
        </div>
      </div>

      {/* ── What it reads from ───────────────────────────────────────── */}
      <div className="border-t border-line-inv">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-6 gap-y-2 px-6 py-5 text-[10px]"
          style={{ color: 'var(--tx-inv-2)' }}>
          {['Meta Ads', 'Instagram', 'X', 'GA4', 'Paystack', 'Mailchimp', 'Site Pixel', 'First-party API'].map(c => (
            <span key={c}>{c}</span>
          ))}
        </div>
      </div>
    </section>
  )
}

/**
 * The rest of the photography, under the film.
 *
 * It was three hairlined frames in a row, which is the grid-of-things family
 * again and the fourth time this page used it. It is one band now: the three
 * shots run together edge to edge and the whole strip arrives through the
 * crescendo, the arc unrolled. Same ticks, same growth curve, same cold to hot
 * reading as the hero and the product rail, at a fourth scale and lying flat.
 *
 * The ticks light left to right as the band comes into view, which is the only
 * direction heat runs here. Names of the three shots sit under it as a rule, so
 * nothing is lost by taking the boxes away.
 */
function StreetStrip() {
  const shots = [HERO_PHOTOS.aerial, HERO_PHOTOS.billboard, HERO_PHOTOS.roundabout]
  const band = useRef<HTMLDivElement>(null)
  const inView = useInView(band, { once: true, amount: 0.35 })
  const reveal = useArcReveal({ start: inView, startDelayMs: 60 })
  return (
    <section aria-label="Where the brand is judged" className="pb-10 pt-20">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="max-w-2xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl"
          style={{ fontFamily: 'var(--font)', color: 'var(--lp-ink)' }}>
          Your budget goes out here. So should your measurement.
        </h2>
      </div>

      <div ref={band} className="mx-auto mt-10 w-full max-w-6xl px-6" style={{ aspectRatio: ROW_ASPECT }}>
        <TickRowMask id="street-band" reveal={reveal} ticks={6} fill={1.7} className="h-full w-full">
          <div className="flex h-full w-full">
            {shots.map(photo => (
              <div key={photo.slot} className="relative h-full flex-1">
                {photo.src && (
                  <Image src={photo.src} alt={photo.brief} fill sizes="34vw" className="object-cover" />
                )}
              </div>
            ))}
          </div>
        </TickRowMask>
      </div>

      <div className="mx-auto mt-5 flex max-w-6xl flex-wrap gap-x-8 gap-y-2 px-6">
        {shots.map(photo => (
          <span key={photo.slot} className="bg-label" style={{ color: 'var(--lp-mut)' }}>{photo.slot}</span>
        ))}
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
        <h2 className="max-w-2xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl"
          style={{ fontFamily: 'var(--font)', color: 'var(--lp-ink)' }}>
          The whole thing, start to finish.
        </h2>
        <div id="demo" className="scroll-mt-28">
          <TickReveal className="mt-10">
            <Tick><VideoHero /></Tick>
          </TickReveal>
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

/**
 * Why this, and not a global tool.
 *
 * This was six identical cards in a three-column grid, which is the single
 * most templated shape on the web and the reason the page read as generated.
 * Six equal boxes also say the six things carry equal weight, and they do not.
 *
 * It is a numbered column now: one claim per row, the rule under each row
 * filling as the row arrives, and each row's rule sitting a step further up
 * the ramp than the one above it. Read top to bottom it is a crescendo, which
 * is the same graphic as the gauge and the same graphic as the rail in the
 * gutter. The numbers are Disket, tabular, because they are numerals.
 */
function Differentiators() {
  return (
    <section id="builtforhere" className="relative scroll-mt-24 py-28">
      <div className="relative mx-auto max-w-6xl px-6">
        <TickReveal className="max-w-3xl">
          <Tick as="p" className="text-[11px]" style={{ color: 'var(--tx-flare)' }}>Why BrandGauge</Tick>
          <Tick>
            <h2 className="mt-4 text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl"
              style={{ fontFamily: 'var(--font)', color: 'var(--lp-ink)' }}>
              Built for here. Not adapted for here.
            </h2>
          </Tick>
        </TickReveal>

        <div className="mt-16">
          {DIFFS.map((d, i) => (
            <HeatRow key={d.n} index={i} total={DIFFS.length}>
              <TickReveal className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 py-8 sm:grid-cols-[4rem_1fr_minmax(0,24rem)] sm:gap-x-10">
                <Tick as="span" className="bg-num text-[13px] leading-none" style={{ color: 'var(--tx-flare)' }}>
                  {d.n}
                </Tick>
                <Tick>
                  <h3 className="text-[19px] font-bold leading-snug sm:text-[22px]"
                    style={{ fontFamily: 'var(--font)', color: 'var(--lp-ink)' }}>
                    {d.title}
                  </h3>
                </Tick>
                <Tick as="p"
                  className="col-start-2 text-[13.5px] leading-relaxed sm:col-start-3 sm:pt-1"
                  style={{ color: 'var(--lp-mut)' }}>
                  {d.body}
                </Tick>
              </TickReveal>
            </HeatRow>
          ))}
          <span aria-hidden className="block h-px" style={{ background: 'var(--line)' }} />
        </div>

        {/* The four readings that close the section. Type, not cards. */}
        <TickReveal className="mt-20 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
          {[
            { v: '4',   label: 'languages read natively' },
            { v: '7',   label: 'industry playbooks' },
            { v: '10+', label: 'live connectors' },
            { v: '5',   label: 'offline channels measured' },
          ].map(st => (
            <Tick key={st.label}>
              <p className="bg-num text-[40px] leading-none" style={{ color: 'var(--lp-ink)' }}>{st.v}</p>
              <p className="mt-2.5 max-w-[18ch] text-[12.5px] leading-snug" style={{ color: 'var(--lp-mut)' }}>
                {st.label}
              </p>
            </Tick>
          ))}
        </TickReveal>
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
          <TickReveal key={s.kicker}
            className={`flex flex-col gap-10 lg:items-center ${i % 2 ? 'lg:flex-row-reverse' : 'lg:flex-row'}`}>
            <Tick className="lg:w-[38%]">
              <h3 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl" style={{ fontFamily: 'var(--font)', color: 'var(--lp-ink)' }}>{s.title}</h3>
              <p className="mt-4 text-[14px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>{s.body}</p>
            </Tick>
            <Tick className="@container h-[430px] flex-1 sm:h-[360px]"><s.Comp t={1} /></Tick>
          </TickReveal>
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
        <TickReveal>
        <Tick as="div"><h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ fontFamily: 'var(--font)', color: 'var(--lp-ink)' }}>
          One gauge. Seven industries.
        </h2></Tick>
        <Tick as="p" className="mt-4 max-w-xl text-[14px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>
          Pick your industry once. The health index, funnel signals and connector
          recommendations reshape themselves around how your business actually works.
        </Tick>
        <Tick className="mt-10 flex flex-wrap gap-3">
          {list.map((v, i) => (
            <button key={v.name} onClick={() => setActive(i)} onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)}
              className="rounded-sm border px-5 py-2.5 text-[13px] transition-colors duration-200 bg-press"
              style={active === i
                ? { borderColor: 'var(--tx)', color: 'var(--bg-paper)', background: 'var(--tx)' }
                : { borderColor: 'var(--lp-line)', color: 'var(--lp-ink)', background: 'var(--lp-card)' }}>
              {v.name}
            </button>
          ))}
        </Tick>
        </TickReveal>
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
        <TickReveal>
        <Tick as="div"><h2 className="relative mx-auto max-w-3xl text-4xl font-black leading-[1.05] tracking-[-0.02em] sm:text-6xl"
          style={{ fontFamily: 'var(--font)', color: 'var(--lp-band-ink)' }}>
          Your brand already has a reputation. Start measuring it.
        </h2></Tick>
        <Tick as="p" className="relative mx-auto mt-6 max-w-xl text-[15px]" style={{ color: 'var(--tx-inv-2)' }}>
          Free while in beta. Connect a social account and see your first Brand Health Index in minutes.
        </Tick>
        <Tick className="relative mt-10">
          <Link href="/auth/signup"
            className="inline-flex items-center gap-2 rounded-sm px-8 py-4 text-[15px] font-bold border border-line"
            style={{ background: 'var(--flare)', color: 'var(--on-hot)' }}>
            Create your workspace <ArrowRight className="h-4 w-4" />
          </Link>
        </Tick>
        </TickReveal>
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
      <ReadingRail />
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
