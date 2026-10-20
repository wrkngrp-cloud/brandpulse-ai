'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMotionValueEvent, useReducedMotion, useScroll, useSpring } from 'framer-motion'
import { ArrowLeftIcon, ArrowRightIcon } from '@/components/brand/icon'
import { SHOTS, ProductShotFrame, type ProductShot } from './product-shots'

/**
 * The product section, as cards.
 *
 * The first version was a sticky track driven by vertical scroll, abandoned
 * for a version that panned itself as the section crossed the viewport with
 * nothing pinned: no scrollbar capture, never frozen. That version had a real
 * bug underneath the design choice, not just inside it - the pan's own timing
 * window was measured against the rail's rendered height, which capped it at
 * roughly half a viewport regardless of screen size, so the run finished in a
 * couple of wheel ticks and the cards were gone before anyone had read one.
 * Widening that window could only trade one failure for the other: a short
 * window skips past the cards, a long one keeps panning after they have
 * already scrolled out of view, because nothing was holding them in place
 * either way. There is no window length that fixes an unpinned rail.
 *
 * So this is the first version again, done on purpose rather than by
 * accident: the heading, rail and crescendo pin for a fixed scroll distance
 * while the page keeps moving under them, same as any sticky element - nobody
 * loses the scrollbar, nothing freezes, and now each card gets to actually be
 * read before the next one arrives. You can also pan by hand at any point,
 * and the moment anyone does, by wheel, drag, touch or arrow, the auto-drive
 * stands down for good and the rail is theirs.
 *
 * What makes it the brand's rather than any rail on the web is what sits
 * under it. Position in the run is drawn as a crescendo, the same arc of
 * ticks as the mark, lit cold to hot as you pan. Getting to the end of the
 * product is a reading reaching full.
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

/** How long the pin lasts, in scroll pixels, once the content sticks. Fixed
 *  rather than tied to the rail's own horizontal span: the cards barely get
 *  narrower across screen widths, but the viewport someone is reading this on
 *  varies far more, and the pin only has to outlast a comfortable read, not
 *  match the cards pixel for pixel. */
const PIN_SCROLL_PX = 1400

export function ProductCards() {
  const rail = useRef<HTMLDivElement>(null)
  /* The track is the section itself: its height is the sticky content's own
     height plus PIN_SCROLL_PX, so position: sticky has somewhere to hold
     while the page keeps moving. The sticky div is what actually pins. */
  const track = useRef<HTMLDivElement>(null)
  const sticky = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)
  const [ends, setEnds] = useState({ start: true, end: false })
  /* Once true, scroll stops driving the rail for the rest of the session. A
     control that keeps yanking itself back after you have moved it is worse
     than one that never moved.
     Mirrored into state because snap has to change with it, and a ref alone
     cannot re-render the class. */
  const taken = useRef(false)
  const [manual, setManual] = useState(false)
  /* The last position the scroll driver wrote. Divergence from it is how a
     real gesture is detected. Listening for wheel and pointer events instead
     was the bug: one vertical wheel tick with the cursor anywhere over the
     rail counted as a horizontal pan and killed the drive on the spot. */
  const wrote = useRef(-1)
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

  /* Whether the pin can hold at all, and how tall the track needs to be if
     so. Measured rather than guessed: the sticky content's own height moves
     with copy length and viewport width, and a track shorter than that
     height cannot pin for any distance. On a viewport shorter than the
     content - a landscape phone, mainly - there is no position where
     sticky can show all of it at once, so this falls back to a plain,
     unpinned section instead of clipping anything. Swiping the rail by hand
     is the obvious gesture there anyway. */
  const [trackHeight, setTrackHeight] = useState<number | null>(null)
  const [canPin, setCanPin] = useState(true)
  const measureTrack = useCallback(() => {
    const content = sticky.current
    if (!content) return
    const h = content.getBoundingClientRect().height
    /* No safety margin here on purpose: a laptop at ~870px tall is the
       common case this has to work on, not the exception, and the content
       is ~860px. Losing the pin on any viewport a few px short of the
       content defeats the point for most real screens, not just the rare
       short one. */
    setCanPin(h <= window.innerHeight)
    setTrackHeight(h + PIN_SCROLL_PX)
  }, [])

  useEffect(() => {
    measure()
    measureTrack()
    window.addEventListener('resize', measure)
    window.addEventListener('resize', measureTrack)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('resize', measureTrack)
    }
  }, [measure, measureTrack])

  /* The track's own progress through the viewport, mapped onto the rail's
     scrollLeft. Scroll position is the value on display here, which is the
     one case the motion law allows it to drive anything.

     This used to be measured against the rail itself rather than the track,
     which is the bug underneath two earlier attempts at this same number.
     Nothing was pinned then, so the rail scrolled past at a fixed rate no
     matter how the window was sized: too short a window skipped past the
     cards before anyone read one, too long a one kept panning after they had
     already scrolled out of view. Tracking the track instead of the rail
     only works because the track is tall by exactly PIN_SCROLL_PX more than
     the content pinned inside it - 'start start' to 'end end' on that
     element is precisely the scroll distance the pin lasts. */
  const { scrollYProgress } = useScroll({
    target: track,
    offset: ['start start', 'end end'],
  })
  /* Written straight from raw progress, one trackpad flick would still
     teleport the rail even with the longer window. The spring gives it the
     system's own settle instead, so a fast scroll arrives rather than jumps.
     It never overshoots, which is the needle's rule as much as the rail's. */
  const drive = useSpring(scrollYProgress, { stiffness: 110, damping: 26, restDelta: 0.0005 })
  useMotionValueEvent(drive, 'change', v => {
    const el = rail.current
    if (!el || taken.current || reduce || !canPin) return
    const span = el.scrollWidth - el.clientWidth
    if (span <= 0) return
    const to = Math.round(Math.max(0, Math.min(span, v * span)))
    wrote.current = to
    el.scrollLeft = to
  })

  const takeOver = () => {
    taken.current = true
    setManual(true)
  }

  const queued = useRef(false)
  const onScroll = () => {
    /* Any position we did not write is a person moving the rail, whatever
       they used to do it: wheel, drag, touch, keyboard, a screen reader. That
       is the whole detection, and it cannot mistake a vertical page scroll
       for a horizontal pan the way an input listener did. */
    const el = rail.current
    if (el && !taken.current && Math.abs(el.scrollLeft - wrote.current) > 4) takeOver()
    if (queued.current) return
    queued.current = true
    requestAnimationFrame(() => { queued.current = false; measure() })
  }

  const step = (dir: 1 | -1) => {
    const el = rail.current
    if (!el) return
    takeOver()
    const reduceNow = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reduceNow ? 'auto' : 'smooth' })
  }

  return (
    /* The raised ink band. The page runs Paper almost end to end, and five
       light screenshots on light paper disappeared into it: the mat has to be a
       different plane, not a different shade of the same one. `--lp-band` is
       the one value that holds in both modes, so this section reads the same
       whichever way the toggle is set. The background sits on the track
       rather than the sticky content, so it still fills the whole pinned
       scroll distance rather than just the content's own height. */
    /* The hairline is not decoration. The band is a permanent ink plane, so on
       Paper it announces itself and on Ink it sits two steps off the ground
       and all but disappears. Elevation in this system is a one-pixel line, so
       the band draws one and reads as a plane in both modes. */
    <section
      ref={track}
      id="tour"
      aria-label="Product"
      className="scroll-mt-24 relative border-y border-line-inv"
      style={{ background: 'var(--lp-band)', height: canPin && trackHeight ? trackHeight : undefined }}
    >
      {/* py-16 rather than the standard py-28: every pixel here counts
          directly against canPin's budget, and the pinned content does not
          need as much breathing room as a normal static section gets - it is
          never competing with whatever comes right before or after it the
          way a scrolling section is. */}
      <div ref={sticky} className={canPin ? 'sticky top-0 py-16' : 'py-16'}>
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-[11px]" style={{ color: 'var(--danfo)' }}>Inside BrandGauge</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-medium leading-tight tracking-tight sm:text-4xl"
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
        <div className="mt-12">
        <div
          ref={rail}
          onScroll={onScroll}
          tabIndex={0}
          role="group"
          aria-label="Product screens, pan sideways"
          className={`flex gap-5 overflow-x-auto scroll-pl-6 pb-2 pl-6 pr-6 [&::-webkit-scrollbar]:hidden lg:scroll-pl-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))] lg:pl-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))] ${manual ? 'snap-x snap-mandatory' : ''}`}
          style={{ scrollbarWidth: 'none' }}
        >
          {CARDS.map(card => (
            <article
              key={card.shot.src}
              className={`flex shrink-0 snap-start flex-col overflow-hidden rounded-sm border border-line-inv ${card.width}`}
            >
              <ProductShotFrame shot={card.shot} className="border-b border-line-inv" />
              <div className="flex flex-1 flex-col p-6">
                <h3 className="text-xl font-medium tracking-tight"
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
      </div>
    </section>
  )
}
