'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

import { ArrowRightIcon as ArrowRight, MoonIcon as Moon, SunIcon as Sun } from '@/components/brand/icon'
import { VideoHero } from './video-hero'
import { ProductCards } from './product-cards'
import { AiScene, darkSceneVars, lightSceneVars } from './scenes'
import { BrandLockup } from '@/components/brand/logo'
import { useDarkGround, useMode } from './use-mode'
import { HERO_PHOTOS, INDUSTRY_PHOTOS, PhotoFrame, type Photo } from './photo-frame'
import { HeatRow, ReadingLine, ReadingRail, Tick, TickReveal } from './reading'
import {
  TickFlip, TickRowMask, arcAspect, rowAspect, useArcReveal, useScrubReveal,
  useScrubValue,
} from './tick-mask'

/** Measured once, from the geometry, so no frame can crop its own ticks. */
const HERO_ARC_ASPECT = arcAspect()
const ROW_ASPECT = rowAspect(6)

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
 * Four attempts got here. A drawn dashboard, a gauge reading 95 for nobody,
 * the market in a rectangle beside the type, and then the whole sweep drawn as
 * a mask, which read as a closed horseshoe with a blob at the hot end.
 *
 * This is a segment of the sweep instead, running off both edges at every
 * width, and progressively further off as the viewport grows: 155% of the
 * screen on a phone down to 116% on a wide desktop. So a bigger screen shows a
 * shallower slice of a bigger instrument rather than the same shape blown up,
 * which is what an instrument this size would actually look like.
 *
 * The segment runs 138 to 42 degrees, which is symmetrical about the crown at
 * 90. That matters for more than looks: both ends land at the same height, so
 * the composition has a real centre and the type under it is centred on
 * something rather than parked near the middle and hoping.
 *
 * `fill` comes down to 1.05. At 1.35 the last three apertures fused into one
 * mass. Just over 1 lets the hot neighbours touch while the cold end stands
 * apart, which is the crescendo without the blob.
 */
function Hero() {
  const street = HERO_PHOTOS.street
  const second = HERO_PHOTOS.roundabout
  const hero = useRef<HTMLElement>(null)
  const [shown, setShown] = useState(false)
  /* The arc still opens aperture by aperture on first paint, waiting for the
     photograph so the gesture is not spent on an empty frame. Swapping in the
     flip component dropped this by accident: it had no reveal to pass. */
  const reveal = useArcReveal({ start: shown })
  /* The turn has to finish while the arc is still on screen. Running it to the
     hero's foot looked right on paper and was invisible in practice: the arc
     sits at the top of the section, so it had left the viewport before the
     last tick turned. This completes by the time the section has travelled
     about half a screen, which is while the arc is still in view.
     Reversible, so scrolling back turns it home again.
     Shortened from -45% so the first tick hands over inside the first 60px of
     scroll rather than the first 100: at the old length nothing had visibly
     changed until you were already past the fold. */
  const turn = useScrubValue(hero, { offset: ['start start', 'start -28%'] })

  return (
    <section ref={hero} className="relative isolate overflow-hidden pb-14 pt-20 sm:pt-24" style={{ background: 'var(--bg-ink)' }}>
      {/* The mark's own material, held well behind everything. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{
        backgroundImage: 'radial-gradient(var(--tick-1) 1.4px, transparent 1.4px)',
        backgroundSize: '30px 30px',
        maskImage: 'radial-gradient(70% 55% at 50% 34%, black, transparent)',
        WebkitMaskImage: 'radial-gradient(70% 55% at 50% 34%, black, transparent)',
      }} />

      {/* Not "built in Lagos, for West Africa". That reads as a ceiling: it
          tells a Nairobi or Accra or Johannesburg team the product is not for
          them, and it tells everyone the ambition stops at a region. Lagos is
          proof of how deep the language work goes, so it belongs in the body
          copy as evidence, not in the eyebrow as a boundary. */}
      <p className="mx-auto max-w-6xl px-6 text-center text-[11px]" style={{ color: 'var(--danfo)' }}>
        Brand intelligence that reads your market in its own language
      </p>

      {/* ── The arc, running off both edges ─────────────────────────── */}
      <div className="relative left-1/2 mt-7 w-[168%] -translate-x-1/2 sm:mt-9 sm:w-[142%] lg:w-[124%] xl:w-[112%]"
        style={{ aspectRatio: HERO_ARC_ASPECT }}>
        <TickFlip id="hero-arc" progress={turn} reveal={reveal} className="h-full w-full"
          front={street.src ? (
            <Image src={street.src} alt={street.brief} fill priority
              onLoad={() => setShown(true)}
              sizes="160vw" className="object-cover" />
          ) : null}
          back={second.src ? (
            <Image src={second.src} alt={second.brief} fill
              sizes="160vw" className="object-cover" />
          ) : null}
        />
      </div>

      {/* ── Under the crown ─────────────────────────────────────────── */}
      <div className="relative mx-auto -mt-[32vw] max-w-2xl px-6 text-center sm:-mt-[28vw] lg:-mt-[26vw] xl:-mt-[23.5vw]">
        <ReadingLine
          text="See your brand the way the street sees it."
          accent="street"
          accentStyle={{ color: 'var(--danfo)' }}
          className="text-[2.1rem] font-medium leading-[1.05] tracking-[-0.03em] sm:text-5xl xl:text-[3.5rem]"
          style={{ fontFamily: 'var(--font)', color: 'var(--tx-inv)' }}
        />
        <p className="mx-auto mt-5 max-w-lg text-[15px] leading-relaxed sm:text-base" style={{ color: 'var(--tx-inv-2)' }}>
          Your customers are talking about you in Pidgin, Yoruba, Igbo and Hausa. BrandGauge
          hears all of it and hands you one number you can defend in a budget meeting.
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
    </section>
  )
}

/**
 * The rest of the photography, under the film.
 *
 * It was three hairlined frames in a row, which is the grid-of-things family
 * for the fourth time on this page. It is one band: the three shots run
 * together edge to edge and arrive through the arc unrolled.
 *
 * This is the page's one fully scroll-driven reveal, and the right place for
 * it. It sits below the fold, so there is no first-paint problem to solve, and
 * the windows opening left to right as the band crosses the viewport is the
 * reading rising because you are moving. It only ever rises: scanning back up
 * does not shut the apertures.
 *
 * Spacing went the same way as the hero arc. Six windows at fill 1.7 fused the
 * last three into one mass; 1.15 with growth from 0.62 keeps every window its
 * own shape while the run still gets hotter to the right.
 */
/** Where each band shot's subject actually sits in the frame. */
const SHOT_FOCUS: Record<string, string> = {
  'The billboard': '50% 78%',
  'The expressway': '50% 70%',
  'The junction':  '50% 45%',
  'The market':    '50% 55%',
}

/** Three shots side by side, filling a band. */
function Triptych({ shots }: { shots: (Photo | undefined)[] }) {
  /* Filtered rather than indexed straight through. A mistyped key in the photo
     registry used to reach `photo.src` on undefined and 500 the whole page,
     which is a silly way to lose a landing page. */
  return (
    <div className="flex h-full w-full">
      {shots.filter((x): x is Photo => Boolean(x)).map(photo => (
        <div key={photo.slot} className="relative h-full flex-1">
          {photo.src && (
            /* Each window samples a fixed third of the band, so the crop has
               to be aimed. Left at the default, the billboard shot gave two
               windows of empty sky. */
            <Image src={photo.src} alt={photo.brief} fill sizes="34vw"
              className="object-cover" style={{ objectPosition: SHOT_FOCUS[photo.slot] ?? '50% 50%' }} />
          )}
        </div>
      ))}
    </div>
  )
}

function StreetStrip() {
  const shots = [HERO_PHOTOS.aerial, HERO_PHOTOS.billboard, HERO_PHOTOS.roundabout]
  const flip  = [HERO_PHOTOS.street, HERO_PHOTOS.highway, HERO_PHOTOS.aerial]
  const band = useRef<HTMLDivElement>(null)
  /* Two stages, one scroll. The band arrives by lighting its windows on the
     way in, and once it is in view the same windows turn to the second set of
     shots. Reversible, so scrolling back turns them home. */
  const reveal = useScrubReveal(band, { ticks: 6, offset: ['start 0.95', 'end 0.85'] })
  const turn   = useScrubValue(band, { offset: ['start 0.62', 'end 0.15'] })
  return (
    <section aria-label="Where the brand is judged" className="pb-8 pt-20">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="max-w-2xl text-3xl font-medium leading-tight tracking-tight sm:text-4xl"
          style={{ fontFamily: 'var(--font)', color: 'var(--lp-ink)' }}>
          Your spend goes out here. Your proof should come back from here.
        </h2>
        <p className="mt-4 max-w-xl text-[14px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>
          A billboard on the expressway, a market stall in Oshodi, a junction full of danfos.
          BrandGauge ties a vanity link and a UTM to each one, so the board sees what the
          outdoor spend actually returned.
        </p>
      </div>

      <div ref={band} className="mx-auto mt-8 w-full max-w-6xl px-6" style={{ aspectRatio: ROW_ASPECT }}>
        {/* Reveal first, then turn. The reveal mask sits over the flip and
            gates it: a window that has not arrived yet cannot turn. */}
        <TickRowMask id="street-band" reveal={reveal} ticks={6} className="h-full w-full">
          <TickFlip id="street-flip" shape="row" ticks={6} fill={1.15} progress={turn}
            className="h-full w-full"
            front={<Triptych shots={shots} />}
            back={<Triptych shots={flip} />}
          />
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
        <h2 className="max-w-2xl text-3xl font-medium leading-tight tracking-tight sm:text-4xl"
          style={{ fontFamily: 'var(--font)', color: 'var(--lp-ink)' }}>
          Two minutes on a real brand.
        </h2>
        <p className="mt-4 max-w-xl text-[14px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>
          Watch a Lagos food brand go from one connected account to a number its board signed
          off on. If your quarter looks anything like this, you will know by the end of it.
        </p>
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
            <h2 className="mt-4 text-3xl font-medium leading-[1.05] tracking-tight sm:text-5xl"
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
                  <h3 className="text-[19px] font-medium leading-snug sm:text-[22px]"
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
              <h3 className="mt-3 text-2xl font-medium leading-tight tracking-tight sm:text-3xl" style={{ fontFamily: 'var(--font)', color: 'var(--lp-ink)' }}>{s.title}</h3>
              <p className="mt-4 text-[14px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>{s.body}</p>
            </Tick>
            <Tick className="@container h-[430px] flex-1 sm:h-[360px]"><s.Comp t={1} /></Tick>
          </TickReveal>
        ))}
      </div>
    </section>
  )
}

/**
 * Seven verticals, with a picture each.
 *
 * It was seven words on an empty plane, and a word is not an industry. Picking
 * "Fintech" told you nothing about what the product would do differently. Now
 * choosing a vertical swaps the photograph of the place that brand is judged in
 * and the line of signals the index reweights toward, so the claim that the
 * gauge reshapes itself is something you can see rather than read.
 */
function Industries() {
  const list = [
    { key: 'fmcg', name: 'FMCG', hint: 'Shelf visibility, share of voice, distributor pull' },
    { key: 'fintech', name: 'Fintech', hint: 'Trust signals: social comments, street discourse, NPS' },
    { key: 'venue', name: 'Venues & Restaurants', hint: 'Footfall, Google Maps reviews, event ROI' },
    { key: 'b2b_saas', name: 'B2B SaaS', hint: 'G2 reviews, developer health, pipeline lift' },
    { key: 'marketplace', name: 'Marketplaces', hint: 'Seller ratings, GMV attribution, buyer NPS' },
    { key: 'beverage_alcohol', name: 'Beverage & Alcohol', hint: 'Venue sightings, sponsorships, cultural moments' },
    { key: 'b2b_distribution', name: 'B2B Distribution', hint: 'Trade partner scores, field reports, coverage' },
  ]
  const [active, setActive] = useState(0)
  const shot = INDUSTRY_PHOTOS[list[active].key]
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

      <div className="relative mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 lg:grid-cols-12 lg:gap-14">
        <TickReveal className="lg:col-span-7">
          <Tick as="div"><h2 className="text-3xl font-medium tracking-tight sm:text-4xl"
            style={{ fontFamily: 'var(--font)', color: 'var(--lp-ink)' }}>
            A fintech and a beer brand are not the same brand.
          </h2></Tick>
          <Tick as="p" className="mt-4 max-w-xl text-[14px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>
            Pick your industry once. The score, the funnel signals and the connectors it asks
            you for all reweight around how your business actually makes money. Tap through and
            watch what changes.
          </Tick>
          <Tick className="mt-9 flex flex-wrap gap-2.5">
            {list.map((v, i) => (
              <button key={v.name} onClick={() => setActive(i)} onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)}
                aria-pressed={active === i}
                className="rounded-sm border px-4 py-2.5 text-[13px] transition-colors duration-200 bg-press"
                style={active === i
                  ? { borderColor: 'var(--tx)', color: 'var(--bg-paper)', background: 'var(--tx)' }
                  : { borderColor: 'var(--lp-line)', color: 'var(--lp-ink)', background: 'var(--lp-card)' }}>
                {v.name}
              </button>
            ))}
          </Tick>
          <p className="mt-6 min-h-[3rem] max-w-md text-[13px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>
            <span className="bg-label" style={{ color: 'var(--tx-flare)' }}>What the index leans on</span>
            <span className="mt-1.5 block">{list[active].hint}</span>
          </p>
        </TickReveal>

        <TickReveal className="lg:col-span-5">
          <Tick>
            {/* Keyed on the vertical so the frame remounts and lights again as
                you move through the list: the same 90ms tick, not a crossfade. */}
            <PhotoFrame key={shot.slot} photo={shot} ratio="4 / 3"
              sizes="(max-width: 1024px) 100vw, 38vw" />
            <p className="bg-label mt-2.5" style={{ color: 'var(--lp-mut)' }}>{shot.slot}</p>
          </Tick>
        </TickReveal>
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
        <Tick as="div"><h2 className="relative mx-auto max-w-3xl text-4xl font-medium leading-[1.05] tracking-[-0.02em] sm:text-6xl"
          style={{ fontFamily: 'var(--font)', color: 'var(--lp-band-ink)' }}>
          {/* Two sentences, two lines. Left to wrap on its own it broke after
              "measuring" and left "it." alone on a third line, which is a
              widow and reads as a mistake at this size. Each sentence is its
              own block so the break lands where the meaning already does. */}
          <span className="block [text-wrap:balance]">Your brand already has a reputation.</span>
          <span className="block [text-wrap:balance]">Start measuring it.</span>
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
          Made for marketers who have to prove it
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
