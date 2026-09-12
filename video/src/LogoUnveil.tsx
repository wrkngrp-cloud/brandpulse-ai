import { useEffect, useId, useState } from 'react'
import {
  AbsoluteFill, Easing, continueRender, delayRender, interpolate, staticFile, useCurrentFrame,
} from 'remotion'
import { rowTicks, tickBounds } from '../../src/components/landing/tick-mask'
import { ATOM } from '@brand/engine.js'

/**
 * The logo, opening.
 *
 * The mark is an arc of ticks that light cold to hot as a reading rises, and
 * a needle that settles into it. That is the one gesture this brand owns, so
 * the logo animation is that gesture performed on the logo itself rather than
 * a swoosh applied to it:
 *
 *   1. the crescendo runs, seven ticks lighting tail to head at 90ms apart
 *   2. the needle sweeps up the dial and settles, no bounce
 *   3. the wordmark unveils through the same crescendo lying flat, the row of
 *      apertures opening left to right
 *
 * Nothing here is redrawn. The paths come out of the supplied lockup SVG at
 * runtime and are measured in the browser, so the animation cannot drift away
 * from the artwork: change `brand/logo/*.svg` and this changes with it. The
 * needle's pivot is a circle fitted to the seven measured tick centres, not a
 * ratio typed in by hand.
 */

export const FPS = 30

/** 90ms, the interval this system lights a tick at, in frames. */
const D_TICK = 3
/** The settle curve from brand/tokens.css, as an easing function. */
const SETTLE = Easing.bezier(0.16, 0.84, 0.28, 1)

const ARC_TICKS = 7          // the mark's own count
const WORD_TICKS = 9         // apertures across the wordmark

/* Beat boundaries, in frames. */
const ARC_START   = 6
const ARC_END     = ARC_START + (ARC_TICKS - 1) * D_TICK + D_TICK   // 27
const NEEDLE_IN   = ARC_END - 2
const NEEDLE_DUR  = 18
const WORD_IN     = NEEDLE_IN + NEEDLE_DUR - 2
const WORD_END    = WORD_IN + (WORD_TICKS - 1) * D_TICK + D_TICK
export const LOGO_UNVEIL_DURATION = WORD_END + 34   // ~3.1s at 30fps

export type Ground = 'paper' | 'ink' | 'transparent'

/** Which supplied lockup each ground uses. Paper art on paper, ink art on ink;
 *  the transparent cut takes the paper art, which is the one drawn for light
 *  grounds and the one most brand assets sit on. */
const ART: Record<Ground, string> = {
  paper:       'brand-logo/brandgauge-lockup-duotone-paper.svg',
  ink:         'brand-logo/brandgauge-lockup-duotone-ink.svg',
  transparent: 'brand-logo/brandgauge-lockup-duotone-paper.svg',
}

const GROUND: Record<Ground, string> = {
  paper:       'var(--bg-paper)',
  ink:         'var(--tx)',
  transparent: 'transparent',
}

interface Part { d: string; fill: string; x: number; y: number; w: number; h: number }
interface Parts {
  vb: { x: number; y: number; w: number; h: number }
  /** The seven arc ticks, cold tail first. */
  ticks: Part[]
  needle: Part[]
  word: Part[]
  wordBox: { x: number; y: number; w: number; h: number }
  pivot: { x: number; y: number }
  /** Degrees from the needle's drawn rest position back to the cold tail.
   *  Negative, because winding back down the dial is anticlockwise. */
  sweep: number
}

/**
 * The mark and the wordmark live in one file, so they are told apart by where
 * they sit: every point of the mark is left of x=300 in the lockup's own
 * 1300x200 box, every point of the wordmark is right of it. Colour cannot do
 * this job, because the head tick and the word "Gauge" are both Flare and the
 * needle and the word "Brand" are both Char.
 */
const MARK_EDGE = 300

/** Circle through a set of points, algebraic least-squares fit.
 *  x^2 + y^2 = 2ax + 2by + c, solved for (a, b, c) by Gaussian elimination. */
function fitCircle(pts: { x: number; y: number }[]) {
  const M = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
  for (const { x, y } of pts) {
    const row = [2 * x, 2 * y, 1, x * x + y * y]
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) M[i][j] += row[i] * row[j]
  }
  for (let c = 0; c < 3; c++) {
    let p = c
    for (let r = c + 1; r < 3; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r
    ;[M[c], M[p]] = [M[p], M[c]]
    for (let r = 0; r < 3; r++) {
      if (r === c || M[c][c] === 0) continue
      const f = M[r][c] / M[c][c]
      for (let j = c; j < 4; j++) M[r][j] -= f * M[c][j]
    }
  }
  return { x: M[0][3] / M[0][0], y: M[1][3] / M[1][1] }
}

const deg = (rad: number) => (rad * 180) / Math.PI

/**
 * Read the lockup, split it, and measure it.
 *
 * getBBox needs a live document, and Remotion renders in a real browser, so
 * the measurement is taken once off-screen and the render waits for it.
 */
function useLogoParts(ground: Ground): Parts | null {
  const [parts, setParts] = useState<Parts | null>(null)
  const [handle] = useState(() => delayRender('logo-artwork'))

  useEffect(() => {
    let stage: SVGSVGElement | null = null
    ;(async () => {
      const text = await (await fetch(staticFile(ART[ground]))).text()
      const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
      const src = doc.querySelector('svg')
      if (!src) throw new Error('lockup SVG has no <svg> root')
      const [vx, vy, vw, vh] = (src.getAttribute('viewBox') ?? '0 0 1300 200').split(/\s+/).map(Number)

      // Off-screen stage, so getBBox has a layout to measure against.
      stage = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      stage.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`)
      stage.setAttribute('style', 'position:absolute;left:-99999px;width:1300px')
      const nodes = [...src.querySelectorAll('path')]
      const clones = nodes.map(n => {
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        p.setAttribute('d', n.getAttribute('d') ?? '')
        stage!.appendChild(p)
        return { node: n, el: p }
      })
      document.body.appendChild(stage)

      const all: Part[] = clones.map(({ node, el }) => {
        const b = el.getBBox()
        // The class-based styles live in the file's <defs>, which the detached
        // clone does not carry, so the fill is read off the original node.
        const cls = node.getAttribute('class')
        const fill = node.getAttribute('fill')
          ?? (cls ? (text.match(new RegExp(`\\.${cls}\\s*{[^}]*fill:\\s*([^;}\\s]+)`)) ?? [])[1] : undefined)
          ?? 'currentColor'
        return { d: node.getAttribute('d') ?? '', fill, x: b.x, y: b.y, w: b.width, h: b.height }
      })

      const mark = all.filter(p => p.x + p.w < MARK_EDGE)
      const word = all.filter(p => p.x >= MARK_EDGE)
      if (mark.length + word.length !== all.length) {
        throw new Error('a path straddles the mark/wordmark split; MARK_EDGE needs revisiting')
      }
      /* Inside the mark, every ramp colour is used exactly once, one per
         tick, and the needle is drawn in two pieces that share a colour. So
         the repeated fill is the needle. Colour value cannot be used directly:
         the needle is Char on the paper lockup and Paper on the ink one, and
         both of those also appear in the word "Brand". */
      const count = new Map<string, number>()
      for (const p of mark) count.set(p.fill.toLowerCase(), (count.get(p.fill.toLowerCase()) ?? 0) + 1)
      const repeated = [...count].filter(([, n]) => n > 1).map(([f]) => f)
      if (repeated.length !== 1) {
        throw new Error(`expected one repeated fill in the mark (the needle), found ${repeated.length}`)
      }
      const needleFill = repeated[0]
      const needle = mark.filter(p => p.fill.toLowerCase() === needleFill)
      const ticks = mark.filter(p => p.fill.toLowerCase() !== needleFill)
                        .sort((a, b) => a.x - b.x)   // cold tail first
      if (ticks.length !== ARC_TICKS) {
        throw new Error(`expected ${ARC_TICKS} arc ticks in the lockup, measured ${ticks.length}`)
      }

      /* The pivot is the centre of the circle the seven tick centres sit on.
         Fitting it rather than typing a ratio is not pedantry: the fit comes
         back with radius 115.5 and bearings -163.2 to -2.4 on every tick,
         which is GEOM.radius and GEOM.sweep in the engine, to the decimal. The
         artwork and the engine agree, and this reads it out of the artwork. */
      const centres = ticks.map(t => ({ x: t.x + t.w / 2, y: t.y + t.h / 2 }))
      const pivot = fitCircle(centres)
      const at = (p: { x: number; y: number }) => deg(Math.atan2(p.y - pivot.y, p.x - pivot.x))
      const from = (p: { x: number; y: number }) => Math.hypot(p.x - pivot.x, p.y - pivot.y)

      /* Where the needle points when it is at rest. It is drawn in two pieces:
         a hub sitting on the pivot and a tip out at about 40% of the dial's
         radius, so the tip is simply the piece further from the pivot. */
      const nParts = needle.map(n => ({ x: n.x + n.w / 2, y: n.y + n.h / 2 }))
      const tip = nParts.reduce((a, b) => (from(b) > from(a) ? b : a))
      // Negative: the needle winds back anticlockwise to the cold tail, then
      // sweeps up the dial to the reading it is drawn at.
      const sweep = at(centres[0]) - at(tip)

      const wordBox = {
        x: Math.min(...word.map(p => p.x)),
        y: Math.min(...word.map(p => p.y)),
        w: Math.max(...word.map(p => p.x + p.w)) - Math.min(...word.map(p => p.x)),
        h: Math.max(...word.map(p => p.y + p.h)) - Math.min(...word.map(p => p.y)),
      }

      setParts({ vb: { x: vx, y: vy, w: vw, h: vh }, ticks, needle, word, wordBox, pivot, sweep })
      continueRender(handle)
    })().catch(err => {
      // Failing loudly beats rendering a logo that is quietly wrong.
      console.error('[LogoUnveil] could not read the lockup:', err)
      continueRender(handle)
    }).finally(() => { stage?.remove() })
  }, [handle, ground])

  return parts
}

/** The wordmark's apertures: the crescendo unrolled, wide enough at the cold
 *  end that a fully lit run covers the word with no seams. ATOM is 0.767 wide
 *  for its nominal size, so full coverage wants fill * growth[0] * 0.767 >= 1. */
const WORD_GROWTH = [0.6, 1] as const
const WORD_FILL = 2.25

export function LogoUnveil({
  ground = 'paper', width = '72%',
}: {
  ground?: Ground
  /** How wide the lockup sits in the frame. The film opens smaller than the
   *  standalone cut, which is the whole picture and can afford the size. */
  width?: string
}) {
  const frame = useCurrentFrame()
  const maskId = `lu-word-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const parts = useLogoParts(ground)
  if (!parts) return <AbsoluteFill style={{ background: GROUND[ground] }} />

  const { vb, ticks, needle, word, wordBox, pivot, sweep } = parts

  // The needle sweeps up the dial and settles. No overshoot: the needle
  // settles and nothing bounces.
  const needleP = interpolate(frame, [NEEDLE_IN, NEEDLE_IN + NEEDLE_DUR], [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: SETTLE })

  const run = rowTicks(WORD_TICKS, wordBox.w, wordBox.h, WORD_FILL, WORD_GROWTH)
  const box = tickBounds(run)
  const wordLit = Math.floor((frame - WORD_IN) / D_TICK) + 1

  return (
    <AbsoluteFill style={{ background: GROUND[ground], display: 'grid', placeItems: 'center' }}>
      <svg
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        style={{ width, overflow: 'visible' }}
      >
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse"
            x={wordBox.x + box.x0} y={wordBox.y + box.y0} width={box.w} height={box.h}>
            <g transform={`translate(${wordBox.x},${wordBox.y})`}>
              {run.map((tk, i) => (
                <path key={i} d={ATOM} transform={tk.transform} fill="#fff"
                  fillOpacity={i < wordLit ? 1 : 0} />
              ))}
            </g>
          </mask>
        </defs>

        {/* 1. the crescendo. Each tick lights on its own centre over 90ms,
              three frames after the one below it, coldest first. */}
        {ticks.map((t, i) => {
          const p = interpolate(frame, [ARC_START + i * D_TICK, ARC_START + i * D_TICK + D_TICK],
            [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: SETTLE })
          const cx = t.x + t.w / 2, cy = t.y + t.h / 2
          return (
            <path key={`t${i}`} d={t.d} fill={t.fill} fillOpacity={p}
              transform={`translate(${cx},${cy}) scale(${0.88 + p * 0.12}) translate(${-cx},${-cy})`} />
          )
        })}

        {/* 2. the needle, swept from the cold tail to where it is drawn. */}
        <g transform={`rotate(${(1 - needleP) * sweep} ${pivot.x} ${pivot.y})`}
          opacity={needleP > 0 ? 1 : 0}>
          {needle.map((n, i) => <path key={`n${i}`} d={n.d} fill={n.fill} />)}
        </g>

        {/* 3. the wordmark, read through the apertures. */}
        <g mask={`url(#${maskId})`}>
          {word.map((w, i) => <path key={`w${i}`} d={w.d} fill={w.fill} />)}
        </g>
      </svg>
    </AbsoluteFill>
  )
}
