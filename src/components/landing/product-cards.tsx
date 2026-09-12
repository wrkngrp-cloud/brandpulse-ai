'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion'
import { ArrowLeftIcon, ArrowRightIcon } from '@/components/brand/icon'
import { SHOTS, ProductShotFrame, type ProductShot } from './product-shots'

/**
 * The product section, as cards.
 *
 * The first version was a sticky track driven by vertical scroll: the page
 * froze, panels slid sideways, and each panel drew a re-creation of a dashboard
 * rather than the screen itself. Both halves were wrong. Scroll-jacking takes
 * the scrollbar off the reader, and a re-creation is a mockup, which is the one
 * thing the eyebrow above it promises this is not.
 *
 * The second was a grid. Honest, and inert.
 *
 * This is the third: a rail that pans itself as the section crosses the
 * viewport, and that you can also pan by hand. Both, and that is the point.
 * Waiting for a reader to discover a control and work through five cards one
 * click at a time is how a section gets skipped, so scroll moves it for them.
 * But the moment anyone touches it, by wheel, drag, key or arrow, the
 * auto-drive stands down for good and the rail is theirs. Nothing is ever
 * wrestled back, and the page's own scrollbar is never captured: the section
 * travels normally, the track just moves sideways while it does.
 *
 * What makes it the brand's rather than any rail on the web is what sits under
 * it. Position in the run is drawn as a crescendo, the same arc of ticks as
 * the mark, lit cold to hot as you pan. Getting to the end of the product is a
 * reading reaching full.
 *
 * Card widths stay uneven for the same reason the grid spans were: a catalogue
 * of equal boxes says every one of these carries equal weight, and they do not.
 */
interface Card {
  shot: ProductShot
  title: string
  body: string
  /** How wide the card sits in the rail. Uneven on purpose. */
  width: string
}

const CARDS: Card[] = [
  {
    shot: SHOTS.commercial,
    title: 'Marketing you can defend in money',
    body: 'Revenue, spend, CAC, ROI and ROAS on one row, pulled from Meta Ads, GA4, Paystack and your site pixel. Every figure carries its change since last month, so the budget conversation starts with evidence.',
    width: 'w-[min(86vw,40rem)]',
  },
  {
    shot: SHOTS.zones,
    title: 'One score, and what it means',
    body: 'Five signals weighted for your industry, landing in one of four zones. The score tells you where you are. The zone tells you what to do about it.',
    width: 'w-[min(86vw,26rem)]',
  },
  {
    shot: SHOTS.sentiment,
    title: 'Sentiment with street sense',
    body: 'Pidgin, Yoruba, Igbo and Hausa read the way a Lagos marketer would read them, across X and Instagram, refreshed nightly at 4 AM Lagos time.',
    width: 'w-[min(86vw,26rem)]',
  },
  {
    shot: SHOTS.trend,
    title: 'Watch the number move',
    body: 'The index plotted daily, so a campaign, a crisis or a price change shows up as a shape you can point at in a meeting.',
    width: 'w-[min(86vw,40rem)]',
  },
  {
    shot: SHOTS.briefing,
    title: 'A briefing written every Monday',
    body: 'Your position, your blind spots and the two things to fix this week, written from live connector data and named competitors. Not a chart you have to interpret. A paragraph you can forward.',
    width: 'w-[min(86vw,46rem)]',
  },
]

/**
 * Position in the rail, drawn as the mark.
 *
 * The obvious thing here is a scrollbar or a row of dots. Both are generic and
 * neither says anything. This is the same arc as the gauge and the reading rail,
 * unrolled: ticks that grow toward the head and light cold to hot. Heat is
 * spread across the whole lit run rather than measured back from the head,
 * which is the bug that made the first reading rail read as a four-tick blob.
 */
const RAIL_TICKS = 22
const RAIL_RAMP = ['var(--tick-2)', 'var(--tick-3)', 'var(--tick-4)', 'var(--flare)']

function RailCrescendo({ progress }: { progress: number }) {
  const lit = Math.round(progress * RAIL_TICKS)
  return (
    <div aria-hidden className="flex h-4 items-end gap-1">
      {Array.from({ length: RAIL_TICKS }, (_, i) => {
        const t = i / (RAIL_TICKS - 1)
        const on = i < Math.max(lit, 1)
        const step = lit > 1 ? Math.min(RAIL_RAMP.length - 1, Math.round((i / (lit - 1)) * (RAIL_RAMP.length - 1))) : 0
        return (
          <span
            key={i}
            className="rounded-[2.5px]"
            style={{
              width: 2 + t * 4,
              height: 6 + t * 10,
              background: on ? RAIL_RAMP[step] : 'var(--tick-1)',
              transition: 'background var(--d-tick,90ms) var(--ease-snap,cubic-bezier(.4,0,.2,1))',
            }}
          />
        )
      })}
    </div>
  )
}

export function ProductCards() {
  const rail = useRef<HTMLDivElement>(null)
  const section = useRef<HTMLElement>(null)
  const [progress, setProgress] = useState(0)
  const [ends, setEnds] = useState({ start: true, end: false })
  /* Once true, scroll stops driving the rail for the rest of the session. A
     control that keeps yanking itself back after you have moved it is worse
     than one that never moved. */
  const taken = useRef(false)
  const reduce = useReducedMotion()

  /* Read from the element's own scroll, not the window's. The banned listener
     is the one that drives page effects off window scroll; a control reporting
     where it has been panned to is the control doing its job. One rAF per
     burst, so a trackpad flick cannot queue a hundred state writes. */
  const measure = useCallback(() => {
    const el = rail.current
    if (!el) return
    const span = el.scrollWidth - el.clientWidth
    const p = span > 0 ? el.scrollLeft / span : 0
    setProgress(p)
    setEnds({ start: el.scrollLeft < 8, end: el.scrollLeft > span - 8 })
  }, [])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  /* The section's own progress through the viewport, mapped onto scrollLeft.
     Scroll position is the value on display here, which is the one case the
     motion law allows it to drive anything. */
  const { scrollYProgress } = useScroll({
    target: section,
    offset: ['start 0.85', 'end 0.35'],
  })
  useMotionValueEvent(scrollYProgress, 'change', v => {
    const el = rail.current
    if (!el || taken.current || reduce) return
    const span = el.scrollWidth - el.clientWidth
    if (span <= 0) return
    el.scrollLeft = Math.max(0, Math.min(span, v * span))
  })

  const takeOver = () => { taken.current = true }

  const queued = useRef(false)
  const onScroll = () => {
    if (queued.current) return
    queued.current = true
    requestAnimationFrame(() => { queued.current = false; measure() })
  }

  const step = (dir: 1 | -1) => {
    const el = rail.current
    if (!el) return
    taken.current = true
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    /* The raised ink band. The page runs Paper almost end to end, and five
       light screenshots on light paper disappeared into it: the mat has to be a
       different plane, not a different shade of the same one. `--lp-band` is
       the one value that holds in both modes, so this section reads the same
       whichever way the toggle is set. */
    <section ref={section} id="tour" aria-label="Product" className="scroll-mt-24 py-28" style={{ background: 'var(--lp-band)' }}>
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-[11px]" style={{ color: 'var(--danfo)' }}>Inside BrandGauge</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl"
          style={{ fontFamily: 'var(--font)', color: 'var(--lp-band-ink)' }}>
          This is your Monday morning.
        </h2>
        <p className="mt-4 max-w-xl text-[14px] leading-relaxed" style={{ color: 'var(--tx-inv-2)' }}>
          One page tells you where the brand stands, what moved it last week, and what it cost
          to move. No exports, no chasing four dashboards before a 10am meeting.
        </p>
      </div>

      {/* The rail bleeds off the right edge so it reads as a run that continues,
          rather than a row that happens to end where the container does. */}
      <div
        ref={rail}
        onScroll={onScroll}
        onWheel={takeOver}
        onPointerDown={takeOver}
        onTouchStart={takeOver}
        onKeyDown={takeOver}
        tabIndex={0}
        role="group"
        aria-label="Product screens, pan sideways"
        className="mt-12 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-pl-6 pb-2 pl-6 pr-6 [&::-webkit-scrollbar]:hidden lg:scroll-pl-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))] lg:pl-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))]"
        style={{ scrollbarWidth: 'none' }}
      >
        {CARDS.map(card => (
          <article
            key={card.shot.src}
            className={`flex shrink-0 snap-start flex-col overflow-hidden rounded-sm border border-line-inv ${card.width}`}
          >
            <ProductShotFrame shot={card.shot} className="border-b border-line-inv" />
            <div className="flex flex-1 flex-col p-6">
              <h3 className="text-xl font-bold tracking-tight"
                style={{ fontFamily: 'var(--font)', color: 'var(--lp-band-ink)' }}>
                {card.title}
              </h3>
              <p className="mt-3 max-w-[62ch] text-[13.5px] leading-relaxed" style={{ color: 'var(--tx-inv-2)' }}>
                {card.body}
              </p>
            </div>
          </article>
        ))}
      </div>

      {/* Where you are in the run, and the two ways to move through it that do
          not need a trackpad. */}
      <div className="mx-auto mt-6 flex max-w-6xl items-center gap-5 px-6">
        <RailCrescendo progress={progress} />
        <span className="bg-label ml-auto hidden sm:block" style={{ color: 'var(--tx-inv-2)' }}>Pan</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => step(-1)} disabled={ends.start} aria-label="Previous screens"
            className="flex h-9 w-9 items-center justify-center rounded-sm border border-line-inv bg-press disabled:opacity-35"
            style={{ color: 'var(--lp-band-ink)' }}>
            <ArrowLeftIcon className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => step(1)} disabled={ends.end} aria-label="More screens"
            className="flex h-9 w-9 items-center justify-center rounded-sm border border-line-inv bg-press disabled:opacity-35"
            style={{ color: 'var(--lp-band-ink)' }}>
            <ArrowRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  )
}
