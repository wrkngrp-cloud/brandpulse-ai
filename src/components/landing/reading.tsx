'use client'

import { useRef, useState } from 'react'
import {
  motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform,
} from 'framer-motion'

/**
 * The page, read as a gauge.
 *
 * The mark is an arc of ticks that light cold to hot as a reading rises. That
 * is the one thing this brand owns that no competitor has, and the old landing
 * page did not use it for anything: eight sections of eyebrow, headline,
 * paragraph, grid, and nothing on the page moved at all.
 *
 * So scroll is the needle. The rail below is the arc unrolled down the left
 * gutter, and it fills tick by tick as you read. Every reveal on the page is
 * the same event at a smaller scale: a tick lighting, on the brand's own
 * 90ms / 40ms-stagger timing, never a fade-and-slide-up.
 *
 * `--d-tick` and `--stagger` are the tokens; they are restated here as numbers
 * because Motion needs seconds, not a `var()`.
 */
const D_TICK = 0.09
const STAGGER = 0.04
const EASE_SNAP = [0.4, 0, 0.2, 1] as const

/**
 * Reduced motion is handled in CSS, not in JS.
 *
 * Two wrong turns before this one. Trusting `useReducedMotion()` at first
 * render paints `opacity: 0` before the query is readable, so a reduced-motion
 * reader sees the content flash in. Rendering plain markup first and swapping
 * a motion component in a frame later remounts the node, so *everyone* sees it
 * flash 1 to 0 to 1.
 *
 * So the component never changes identity, and `.bg-lightin` in motion.css
 * forces the final state under `prefers-reduced-motion: reduce` with
 * `!important`, which beats the inline style Motion writes. No render race,
 * and the reduced path costs nothing at runtime.
 */
const LIT = 'bg-lightin'

/**
 * The ramp, coldest to hottest. The head of a lit run is always Flare.
 *
 * `--tick-1` is deliberately NOT in here. It is the unlit track, and a lit
 * tick painted with it is invisible: the first cut of this rail coloured each
 * lit tick by how far back it sat from the head, which left 24 of 28 lit ticks
 * at the unlit tint. The rail read as a four-tick blob sliding down the gutter
 * instead of an arc filling. The ramp now spans the whole lit run.
 */
const RAMP = ['var(--tick-2)', 'var(--tick-3)', 'var(--tick-4)', 'var(--flare)']

/** The unlit track: the ground's own ink, which is what the engine does. */
const TRACK = 'color-mix(in srgb, var(--tx) 14%, transparent)'

const cx = (...v: (string | undefined)[]) => v.filter(Boolean).join(' ')

const RAIL_TICKS = 28

/**
 * The reading rail.
 *
 * Fixed to the left gutter, one tick per 1/28th of the page. Ticks grow in
 * width toward the head, which is the crescendo's own construction: the engine
 * draws the arc exactly this way. Heat is spread across the whole lit run, so
 * the bottom of the reading sits at the coldest ramp step and the head is
 * always Flare. Everything past the reading is the unlit track.
 *
 * Hidden below `lg`, where there is no gutter to put it in, and frozen at full
 * under `prefers-reduced-motion` so it still reads as a graphic.
 */
export function ReadingRail() {
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll()
  // The needle settles. A spring on the raw progress stops the rail juddering
  // one tick back and forth on a trackpad.
  const smooth = useSpring(scrollYProgress, { stiffness: 260, damping: 40, mass: 0.4 })
  const [lit, setLit] = useState(0)
  useMotionValueEvent(smooth, 'change', v => setLit(Math.round(v * RAIL_TICKS)))

  const reading = reduce ? RAIL_TICKS : lit

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-40 hidden h-screen w-[max(1.5rem,calc((100vw-72rem)/2))] flex-col items-center justify-center gap-[6px] lg:flex"
    >
      {Array.from({ length: RAIL_TICKS }, (_, i) => {
        const isLit = i < reading
        // Position within the lit run, not distance from the head: the cold end
        // of the ramp belongs to the bottom of the reading, the head to Flare.
        const through = reading > 1 ? i / (reading - 1) : 1
        const colour = isLit
          ? RAMP[Math.min(RAMP.length - 1, Math.round(through * (RAMP.length - 1)))]
          : TRACK
        // Ticks grow toward the head: 5px at the tail, 13px at the top of the run.
        const width = 5 + Math.round((i / (RAIL_TICKS - 1)) * 8)
        return (
          <span
            key={i}
            style={{
              width, height: 3, borderRadius: 'var(--r-tick)', background: colour,
              transition: `background var(--d-tick) var(--ease-snap)`,
            }}
          />
        )
      })}
    </div>
  )
}

/**
 * A tick lighting, applied to a block of content.
 *
 * One reveal group per section, which is the system's own rule, and the
 * children come on in sequence rather than all together so the group reads as
 * an arc filling rather than a panel fading. 90ms per tick, 40ms apart.
 */
export function TickReveal({
  children, className, delay = 0, amount = 0.35,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  amount?: number
}) {
  return (
    <motion.div
      className={className}
      initial="off"
      whileInView="on"
      viewport={{ once: true, amount }}
      variants={{
        off: {},
        on: { transition: { staggerChildren: STAGGER, delayChildren: delay } },
      }}
    >
      {children}
    </motion.div>
  )
}

/** One atom inside a `TickReveal`. Lights; does not slide. */
export function Tick({
  children, className, style, as = 'div',
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  as?: 'div' | 'li' | 'span' | 'p'
}) {
  const Comp = motion[as]
  return (
    <Comp
      className={cx(LIT, className)}
      style={style}
      variants={{
        // Opacity and a 4px lift. Not the banned fade-and-slide-up: that rule
        // is about every element on the page doing it independently on scroll.
        // This is one group, one event, and the travel is a quarter of it.
        off: { opacity: 0, y: 4 },
        on: { opacity: 1, y: 0, transition: { duration: D_TICK * 2.6, ease: EASE_SNAP } },
      }}
    >
      {children}
    </Comp>
  )
}

/**
 * A headline that arrives a word at a time.
 *
 * Words, not letters: letter-by-letter is a typewriter, and this is a reading
 * being taken. Runs once, on first paint, at the gauge's own tick cadence.
 */
export function ReadingLine({
  text, className, style, accent, accentStyle,
}: {
  text: string
  className?: string
  style?: React.CSSProperties
  /** The one word that carries the accent colour. */
  accent?: string
  accentStyle?: React.CSSProperties
}) {
  const words = text.split(' ')
  return (
    <motion.h1
      className={className}
      style={style}
      initial="off"
      animate="on"
      variants={{ off: {}, on: { transition: { staggerChildren: STAGGER * 1.4 } } }}
    >
      {words.map((w, i) => (
        <motion.span
          key={i}
          className={cx(LIT, 'inline-block')}
          style={w === accent ? accentStyle : undefined}
          variants={{
            off: { opacity: 0, y: '0.18em' },
            on: { opacity: 1, y: 0, transition: { duration: 0.42, ease: EASE_SNAP } },
          }}
        >
          {w}{i < words.length - 1 ? ' ' : ''}
        </motion.span>
      ))}
    </motion.h1>
  )
}

/**
 * A row whose heat rises as it enters.
 *
 * Used by the numbered list that replaced six identical feature cards. The
 * row's own index decides where on the ramp its rule sits, so the list reads
 * as one crescendo from top to bottom instead of six equal boxes.
 */
export function HeatRow({
  index, total, children,
}: {
  index: number
  total: number
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center center'] })
  // scaleX, not width. Width is a layout property, so animating it forces
  // layout on every scroll frame; a full-width rule scaled from its left edge
  // is the same picture and stays on the compositor.
  const scaleX = useTransform(scrollYProgress, [0, 1], [0, 1])
  const heat = RAMP[Math.min(RAMP.length - 1, Math.round((index / Math.max(1, total - 1)) * (RAMP.length - 1)))]

  return (
    <div ref={ref} className="relative">
      {/* The rule under each row fills as the row arrives, and each row's fill
          sits a step further up the ramp than the one above it. */}
      <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: 'var(--line)' }} />
      <motion.span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px origin-left"
        style={{ scaleX: reduce ? 1 : scaleX, background: heat }}
      />
      {children}
    </div>
  )
}
