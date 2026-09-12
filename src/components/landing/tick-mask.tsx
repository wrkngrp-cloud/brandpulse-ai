'use client'

import { useEffect, useState, type RefObject } from 'react'
import { useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion'
import { ATOM, GEOM } from '@brand/engine.js'

/**
 * Photographs, read through the gauge.
 *
 * The page had photography and it had the mark, and the two never met: a
 * rectangle of street, then separately a logo. This is the join. The mask is
 * the mark's own arc, built from the same `ATOM` path and the same sweep the
 * engine draws (163.3 degrees to 2.4, growth 0.34 to 1.00), so the picture
 * arrives through the ticks rather than inside a box.
 *
 * That gives the reveal somewhere to go. A reading rises by lighting ticks, so
 * an image behind this mask arrives tick by tick, coldest end first. It is the
 * same event as the gauge filling, the rail in the gutter, and a HeatRow rule,
 * at a fourth scale.
 *
 * Tick count is the mark's own seven. The first cut of this used 22 to 28 on
 * the theory that a photograph needs more apertures, which is backwards: more
 * ticks makes each window smaller, and at 22 the street came out as confetti.
 * Seven gives a head aperture about a fifth of the frame, which holds a
 * readable slice of a market.
 *
 * The one real departure is `fill`, and the reason is worth keeping. The
 * engine runs 0.80, which stands the ticks apart and reads as a dial. Above 1
 * the neighbours meet, and because tick size already grows toward the head,
 * they meet *unevenly*: the cold end stays discrete while the hot end
 * coalesces into one mass. So the density of the picture is itself the
 * reading. That is not a workaround for slivers, which is what an earlier
 * version of this comment claimed. It is the crescendo performed by the
 * photograph instead of drawn beside it.
 *
 * Shape, sweep and growth curve are the engine's, untouched.
 */

/**
 * How an aperture opens: `--d-tick` at the settle curve, never a bounce.
 *
 * A tick that snaps from 0 to 1 opacity reads as a glitch when what is behind
 * it is a photograph rather than a flat chip, so it comes up on its own centre
 * as well, from 0.88. Same duration the rest of the system lights a tick at.
 */
const TICK_SETTLE: React.CSSProperties = {
  transition: 'fill-opacity var(--d-tick,90ms) var(--ease-settle,cubic-bezier(.16,.84,.28,1)), transform var(--d-tick,90ms) var(--ease-settle,cubic-bezier(.16,.84,.28,1))',
}

/** One tick, placed and scaled exactly as `at()` does inside the engine. */
function tickTransform(x: number, y: number, deg: number, size: number) {
  return `translate(${x.toFixed(2)},${y.toFixed(2)}) rotate(${deg.toFixed(2)}) scale(${size.toFixed(3)})`
}

export interface ArcTick {
  transform: string
  /** 0 at the cold tail, 1 at the head. Decides reveal order and heat. */
  t: number
  /** Centre and scale, kept so a run can be measured as well as drawn. */
  x: number
  y: number
  size: number
}

/**
 * Half the diagonal of the `ATOM` path, in its own unit scale.
 *
 * A tick is placed by its centre and rotated, so the only safe radius around
 * that centre is the corner distance. Measured from the path itself rather
 * than assumed, because the shape is the engine's to change.
 */
const ATOM_RADIUS = (() => {
  const pts = [...ATOM.matchAll(/(-?\d*\.?\d+)[, ](-?\d*\.?\d+)/g)]
  let hx = 0, hy = 0
  for (const m of pts) { hx = Math.max(hx, Math.abs(+m[1])); hy = Math.max(hy, Math.abs(+m[2])) }
  return Math.hypot(hx, hy)
})()

/** The box a run of ticks actually occupies, corners and all. */
export function tickBounds(ticks: ArcTick[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const tk of ticks) {
    const r = tk.size * ATOM_RADIUS
    x0 = Math.min(x0, tk.x - r); x1 = Math.max(x1, tk.x + r)
    y0 = Math.min(y0, tk.y - r); y1 = Math.max(y1, tk.y + r)
  }
  return { x0, y0, w: x1 - x0, h: y1 - y0 }
}

/**
 * The arc, as a list of placed ticks.
 *
 * Returned rather than drawn so the same geometry can become a mask, a set of
 * lit chips over a photograph, or both from one source of truth.
 */
export function arcTicks(
  n: number, R: number, cx: number, cy: number, fill: number,
  sweep: readonly [number, number] = GEOM.sweep,
  growth: readonly [number, number] = GEOM.growth,
): ArcTick[] {
  const [A0, A1] = sweep
  const step = Math.abs(A1 - A0) / (n - 1)
  const chord = 2 * R * Math.sin((step * Math.PI) / 180 / 2)
  const D = Math.PI / 180
  return Array.from({ length: n }, (_, k) => {
    const t = k / (n - 1)
    const a = A0 + (A1 - A0) * t
    const size = chord * fill * (growth[0] + (growth[1] - growth[0]) * t)
    const x = cx + Math.cos(a * D) * R
    const y = cy - Math.sin(a * D) * R
    return { t, x, y, size, transform: tickTransform(x, y, -a, size) }
  })
}

/** The crescendo: the arc unrolled into a straight run, for wide images. */
export function rowTicks(
  n: number, W: number, H: number, fill: number,
  growth: readonly [number, number] = [0.62, 1],
): ArcTick[] {
  const gap = W / n
  return Array.from({ length: n }, (_, k) => {
    const t = k / (n - 1)
    const size = gap * fill * (growth[0] + (growth[1] - growth[0]) * t)
    const x = gap * (k + 0.5)
    return { t, x, y: H / 2, size, transform: tickTransform(x, H / 2, 0, size) }
  })
}

/**
 * A segment of the sweep, not the whole horseshoe.
 *
 * The full 163 to 2 degrees drawn as a mask reads as a closed emblem: a
 * horseshoe sitting in the middle of the frame with a heavy blob at the hot
 * end. A middle segment reads as part of a much larger instrument that runs
 * off both edges, which is what the mark actually is at any real scale.
 *
 * Degrees are the engine's own bearings, so this is a crop of the sweep rather
 * than a different sweep.
 */
export const ARC_SEGMENT = [150, 30] as const

/**
 * The hero arc's growth range, tightened from the engine's 0.34 to 1.00.
 *
 * At full range the size gradient beats the curvature: the cold tail is a
 * quarter the size of the head, so the run reads as a descending diagonal
 * rather than an arc, and the frame has to be tall enough for the head, which
 * leaves a lot of empty sky. From 0.58 the crescendo is still plainly there,
 * 1.7 times from tail to head, and what you read first is the curve.
 */
export const ARC_GROWTH = [0.58, 1] as const

/**
 * The arc's own proportion, for callers that need to reserve its frame.
 *
 * Derived from the same measurement the mask uses, so a hand-typed aspect
 * ratio can never drift out of step with the geometry and crop it again.
 */
export function arcAspect(
  ticks = GEOM.ticks, fill = 1, sweep: readonly [number, number] = ARC_SEGMENT,
  growth: readonly [number, number] = ARC_GROWTH,
) {
  const b = tickBounds(arcTicks(ticks, 360, 500, 478, fill, sweep, growth))
  return b.w / b.h
}

/** The same, for the unrolled run. */
export function rowAspect(
  ticks = GEOM.ticks, fill = 1.15, growth: readonly [number, number] = [0.62, 1],
) {
  const b = tickBounds(rowTicks(ticks, 1000, 320, fill, growth))
  return b.w / b.h
}

interface MaskProps {
  /** Unique id: two masks with the same id on one page silently merge. */
  id: string
  children: React.ReactNode
  /** How much of the run is revealed, 0 to 1. */
  reveal?: number
  className?: string
  /** Tick count. The mark's seven by default; more makes each window smaller. */
  ticks?: number
  /**
   * Overlap. Just over 1 lets the hot neighbours touch while the cold end
   * stands apart, which is the crescendo. Well above 1 fuses the last three
   * into one mass, which reads as a blob rather than a reading.
   */
  fill?: number
  /** Which part of the engine's sweep to draw. Defaults to the mid segment. */
  sweep?: readonly [number, number]
  /** Tick scale at tail and head. Narrower than the engine's on wide arcs. */
  growth?: readonly [number, number]
}

/**
 * A picture inside the arc.
 *
 * `children` is whatever should show through: an Image, a video, a plane of
 * colour. The mask is the arc; everything outside a tick is cut away.
 */
export function TickArcMask({
  id, children, reveal = 1, className = '', ticks = GEOM.ticks, fill = 1,
  sweep = ARC_SEGMENT, growth = ARC_GROWTH,
}: MaskProps) {
  // The box is fitted to the ticks, not the centre line they sit on. Hand-set
  // numbers clipped the head twice: it is the largest tick and the lowest, so
  // a box sized to the arc amputates exactly the end that carries the reading.
  const arc = arcTicks(ticks, 360, 500, 478, fill, sweep, growth)
  const box = tickBounds(arc)
  const W = box.w, H = box.h
  const lit = reveal * ticks
  return (
    <div className={`relative ${className}`}>
      <svg aria-hidden width="0" height="0" className="absolute">
        <defs>
          <mask id={id} maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox">
            {arc.map((tk, i) => (
              <g key={i} transform={`scale(${1 / W},${1 / H}) translate(${-box.x0},${-box.y0})`}>
                {/* Scale is appended after the placement transform, so it runs
                    about the tick's own centre: the aperture opens where it
                    sits instead of sliding in from anywhere. */}
                <g transform={`${tk.transform} scale(${i < lit ? 1 : 0.88})`} style={TICK_SETTLE}>
                  <path d={ATOM} fill="#fff" fillOpacity={i < lit ? 1 : 0} style={TICK_SETTLE} />
                </g>
              </g>
            ))}
          </mask>
        </defs>
      </svg>
      <div style={{ mask: `url(#${id})`, WebkitMask: `url(#${id})` }} className="h-full w-full">
        {children}
      </div>
    </div>
  )
}

/**
 * A picture inside the crescendo.
 *
 * The wide sibling of the arc, for images that want to run across a column
 * rather than curve. Same ticks, unrolled.
 */
export function TickRowMask({
  id, children, reveal = 1, className = '', ticks = GEOM.ticks, fill = 1.15,
  growth = [0.62, 1],
}: MaskProps) {
  // Fitted to the ticks, same as the arc: the head tick is the widest and a
  // box sized to the centre line shaves it off the right edge.
  const row = rowTicks(ticks, 1000, 320, fill, growth)
  const box = tickBounds(row)
  const W = box.w, H = box.h
  const lit = reveal * ticks
  return (
    <div className={`relative ${className}`}>
      <svg aria-hidden width="0" height="0" className="absolute">
        <defs>
          <mask id={id} maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox">
            {row.map((tk, i) => (
              <g key={i} transform={`scale(${1 / W},${1 / H}) translate(${-box.x0},${-box.y0})`}>
                <g transform={`${tk.transform} scale(${i < lit ? 1 : 0.88})`} style={TICK_SETTLE}>
                  <path d={ATOM} fill="#fff" fillOpacity={i < lit ? 1 : 0} style={TICK_SETTLE} />
                </g>
              </g>
            ))}
          </mask>
        </defs>
      </svg>
      <div style={{ mask: `url(#${id})`, WebkitMask: `url(#${id})` }} className="h-full w-full">
        {children}
      </div>
    </div>
  )
}

/**
 * The arc filling, once, on first paint.
 *
 * A reading rises by lighting ticks, so the reveal is a count from the cold
 * tail to the head rather than a fade. `--d-tick` is 90ms, which is the
 * interval the whole system lights a tick at. Seven of them is under a second.
 *
 * `start` holds the count until whatever is behind the mask is actually there.
 * Opening seven apertures onto a photograph that has not decoded yet spends the
 * one gesture on an empty frame, which is what the first cut of this did. The
 * fallback timer means a picture that never arrives cannot leave the mask shut.
 *
 * Returns 1 immediately under `prefers-reduced-motion`: the design system calls
 * that non-negotiable, and a mask stuck at 0 would hide the picture.
 */
export function useArcReveal({
  ticks = GEOM.ticks, stepMs = 90, startDelayMs = 240, start = true, waitMs = 2000,
}: { ticks?: number; stepMs?: number; startDelayMs?: number; start?: boolean; waitMs?: number } = {}) {
  const reduce = useReducedMotion()
  const [lit, setLit] = useState(0)
  const [expired, setExpired] = useState(false)
  useEffect(() => {
    if (reduce || start) return
    const t = setTimeout(() => setExpired(true), waitMs)
    return () => clearTimeout(t)
  }, [reduce, start, waitMs])
  const go = start || expired
  useEffect(() => {
    // Nothing to schedule under reduced motion: the return below reads 1
    // directly, so the mask is open on first paint rather than counting up.
    if (reduce || !go) return
    let tick: ReturnType<typeof setInterval> | undefined
    let n = 0
    const begin = setTimeout(() => {
      tick = setInterval(() => {
        n += 1
        setLit(n)
        if (n >= ticks) clearInterval(tick)
      }, stepMs)
    }, startDelayMs)
    return () => { clearTimeout(begin); if (tick) clearInterval(tick) }
  }, [reduce, go, ticks, stepMs, startDelayMs])
  return reduce ? 1 : lit / ticks
}

/**
 * The arc filling as you scroll, rather than on a timer.
 *
 * A timed reveal is a thing that happens to you: miss the first second and the
 * page simply looks finished. Driving it from scroll position makes the reading
 * rise because you are moving, which is the whole metaphor, and it means the
 * gesture cannot be missed.
 *
 * The count only ever rises. Scrolling back up does not un-light ticks: a
 * needle settles, it does not flicker back and forth, and a mask that opens
 * and shuts as you scan a page is nausea rather than motion.
 */
export function useScrubReveal(
  ref: RefObject<HTMLElement | null>,
  { ticks = GEOM.ticks, offset = ['start 0.9', 'end 0.4'] }: {
    ticks?: number
    /** Where in the viewport the run starts and finishes filling. */
    offset?: (string | number)[]
  } = {},
) {
  const reduce = useReducedMotion()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { scrollYProgress } = useScroll({ target: ref, offset: offset as any })
  const [lit, setLit] = useState(0)
  useMotionValueEvent(scrollYProgress, 'change', v => {
    const n = Math.min(ticks, Math.round(v * ticks))
    setLit(prev => (n > prev ? n : prev))
  })
  return reduce ? 1 : lit / ticks
}

/**
 * Raw scroll progress through an element, 0 to 1, and reversible.
 *
 * `useScrubReveal` is deliberately one-way: a reading rises and does not fall,
 * so scanning back up cannot shut its apertures. A flip is the opposite case.
 * A tick turning back as you scroll up is the same mechanism running backwards,
 * which is what a physical louvre does, so this one tracks the value both ways.
 *
 * Quantised to 120 steps. The flip only needs enough resolution to look
 * continuous, and rounding keeps React from re-rendering a mask on every
 * single scroll frame.
 */
export function useScrubValue(
  ref: RefObject<HTMLElement | null>,
  { offset = ['start start', 'end start'], steps = 120 }: {
    offset?: (string | number)[]
    steps?: number
  } = {},
) {
  const reduce = useReducedMotion()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { scrollYProgress } = useScroll({ target: ref, offset: offset as any })
  const [v, setV] = useState(0)
  useMotionValueEvent(scrollYProgress, 'change', p => {
    const q = Math.round(Math.max(0, Math.min(1, p)) * steps) / steps
    setV(prev => (prev === q ? prev : q))
  })
  return reduce ? 0 : v
}

/** One tick mid-turn: how squashed it is, and which face is showing. */
function flipState(i: number, n: number, g: number, dwell = 0.45) {
  const stride = n > 1 ? (1 - dwell) / (n - 1) : 0
  const p = Math.max(0, Math.min(1, (g - i * stride) / dwell))
  return { scaleY: Math.abs(1 - 2 * p), back: p > 0.5 }
}

interface FlipProps {
  id: string
  /** What shows before the turn. */
  front: React.ReactNode
  /** What shows after it. */
  back: React.ReactNode
  /** 0 is fully front, 1 is fully back. Reversible. */
  progress: number
  className?: string
  ticks?: number
  fill?: number
  /** 'arc' for the hero's segment, 'row' for the unrolled band. */
  shape?: 'arc' | 'row'
  sweep?: readonly [number, number]
  growth?: readonly [number, number]
}

/**
 * The ticks turn, and the picture behind them changes.
 *
 * Each aperture squashes along its own short axis to nothing and opens again
 * on the other side, staggered along the run, so the arc turns the way a row
 * of louvres or a split-flap board does. It is the one motion a tick can make
 * that is still mechanical: it rotates about its own centre and never
 * translates, tilts or drifts, so nothing here is parallax.
 *
 * Two mask layers rather than a crossfade. Each tick is drawn in both, opaque
 * in exactly one of them depending on whether it has passed its half-turn, so
 * at any moment some apertures show the first photograph and some show the
 * second. A fade would dissolve the two images into mud; this keeps every
 * window a hard-edged view of one place.
 */
export function TickFlip({
  id, front, back, progress, className = '', ticks = GEOM.ticks, fill = 1,
  shape = 'arc', sweep = ARC_SEGMENT, growth = ARC_GROWTH,
}: FlipProps) {
  const run = shape === 'arc'
    ? arcTicks(ticks, 360, 500, 478, fill, sweep, growth)
    : rowTicks(ticks, 1000, 320, fill)
  const box = tickBounds(run)
  const W = box.w, H = box.h
  const layer = (face: 'a' | 'b') => (
    <mask id={`${id}-${face}`} maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox">
      {run.map((tk, i) => {
        const { scaleY, back: showBack } = flipState(i, ticks, progress)
        const on = face === 'b' ? showBack : !showBack
        return (
          <g key={i} transform={`scale(${1 / W},${1 / H}) translate(${-box.x0},${-box.y0})`}>
            <g transform={`${tk.transform} scale(1,${Math.max(scaleY, 0.001).toFixed(4)})`}>
              <path d={ATOM} fill="#fff" fillOpacity={on ? 1 : 0} />
            </g>
          </g>
        )
      })}
    </mask>
  )
  return (
    <div className={`relative ${className}`}>
      <svg aria-hidden width="0" height="0" className="absolute">
        <defs>{layer('a')}{layer('b')}</defs>
      </svg>
      <div style={{ mask: `url(#${id}-a)`, WebkitMask: `url(#${id}-a)` }} className="absolute inset-0">
        {front}
      </div>
      <div style={{ mask: `url(#${id}-b)`, WebkitMask: `url(#${id}-b)` }} className="absolute inset-0">
        {back}
      </div>
    </div>
  )
}
