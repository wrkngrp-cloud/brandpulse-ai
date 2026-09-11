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
 * One deliberate departure from the engine. `GEOM.fill` is 0.80, which leaves
 * air between ticks on a 7-tick gauge and reads as a dial. At the densities a
 * photograph needs (18 to 28) that same value shreds the picture into slivers,
 * so `fill` is a prop here and the masks run it above 1 to let neighbours meet.
 * The shape, the sweep and the growth curve are untouched.
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
  /** Tick count. Higher reads as a photograph, lower reads as a dial. */
  ticks?: number
  /** Overlap. Above 1 the neighbours meet, which a photograph needs. */
  fill?: number
}

/**
 * A picture inside the arc.
 *
 * `children` is whatever should show through: an Image, a video, a plane of
 * colour. The mask is the arc; everything outside a tick is cut away.
 */
export function TickArcMask({
  id, children, reveal = 1, className = '', ticks = 22, fill = 1.22,
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
  id, children, reveal = 1, className = '', ticks = 26, fill = 1.18,
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
