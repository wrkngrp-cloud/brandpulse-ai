'use client'

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

/** One tick, placed and scaled exactly as `at()` does inside the engine. */
function tickTransform(x: number, y: number, deg: number, size: number) {
  return `translate(${x.toFixed(2)},${y.toFixed(2)}) rotate(${deg.toFixed(2)}) scale(${size.toFixed(3)})`
}

export interface ArcTick {
  transform: string
  /** 0 at the cold tail, 1 at the head. Decides reveal order and heat. */
  t: number
}

/**
 * The arc, as a list of placed ticks.
 *
 * Returned rather than drawn so the same geometry can become a mask, a set of
 * lit chips over a photograph, or both from one source of truth.
 */
export function arcTicks(n: number, R: number, cx: number, cy: number, fill: number): ArcTick[] {
  const [A0, A1] = GEOM.sweep
  const step = Math.abs(A1 - A0) / (n - 1)
  const chord = 2 * R * Math.sin((step * Math.PI) / 180 / 2)
  const D = Math.PI / 180
  return Array.from({ length: n }, (_, k) => {
    const t = k / (n - 1)
    const a = A0 + (A1 - A0) * t
    const size = chord * fill * (GEOM.growth[0] + (GEOM.growth[1] - GEOM.growth[0]) * t)
    return {
      t,
      transform: tickTransform(cx + Math.cos(a * D) * R, cy - Math.sin(a * D) * R, -a, size),
    }
  })
}

/** The crescendo: the arc unrolled into a straight run, for wide images. */
export function rowTicks(n: number, W: number, H: number, fill: number): ArcTick[] {
  const gap = W / n
  return Array.from({ length: n }, (_, k) => {
    const t = k / (n - 1)
    const size = gap * fill * (0.42 + 0.58 * t)
    return { t, transform: tickTransform(gap * (k + 0.5), H / 2, 0, size) }
  })
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
  /** Overlap. Above 1 the hot end coalesces while the cold end stays discrete. */
  fill?: number
}

/**
 * A picture inside the arc.
 *
 * `children` is whatever should show through: an Image, a video, a plane of
 * colour. The mask is the arc; everything outside a tick is cut away.
 */
export function TickArcMask({
  id, children, reveal = 1, className = '', ticks = GEOM.ticks, fill = 1.35,
}: MaskProps) {
  const W = 1000, H = 560
  const arc = arcTicks(ticks, 430, W / 2, H * 0.94, fill)
  const lit = reveal * ticks
  return (
    <div className={`relative ${className}`}>
      <svg aria-hidden width="0" height="0" className="absolute">
        <defs>
          <mask id={id} maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox">
            {arc.map((tk, i) => (
              <g key={i} transform={`scale(${1 / W},${1 / H})`}>
                <g transform={tk.transform}>
                  <path d={ATOM} fill="#fff" fillOpacity={i < lit ? 1 : 0} />
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
  id, children, reveal = 1, className = '', ticks = 6, fill = 1.3,
}: MaskProps) {
  const W = 1000, H = 320
  const row = rowTicks(ticks, W, H, fill)
  const lit = reveal * ticks
  return (
    <div className={`relative ${className}`}>
      <svg aria-hidden width="0" height="0" className="absolute">
        <defs>
          <mask id={id} maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox">
            {row.map((tk, i) => (
              <g key={i} transform={`scale(${1 / W},${1 / H})`}>
                <g transform={tk.transform}>
                  <path d={ATOM} fill="#fff" fillOpacity={i < lit ? 1 : 0} />
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
