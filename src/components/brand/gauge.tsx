'use client'

import { useEffect, useRef, useState } from 'react'
import { Gauge as KitGauge } from '@brand/components'
import { GEOM } from '@brand/engine.js'
import { TOKENS } from '@/lib/brand-tokens'

/**
 * The Brand Health Index, drawn by the brand engine.
 *
 * The arc, the ticks and the needle come out of brand/engine.js exactly as
 * supplied: the needle is one rigid object, rotated whole about the pivot,
 * and nothing here decomposes it or rebuilds it from ratios.
 *
 * What this adds is the motion the system asks for, and only that:
 *
 *   - the ticks light left to right on first paint, once per session,
 *   - the needle travels and settles when the reading actually changes,
 *
 * both by wrapping the drawn parts rather than redrawing them. The rotation
 * runs on a wrapper group so the engine's own transform on the needle stays
 * untouched, and the angles come from the engine's own sweep constants.
 */
const SEEN = 'bg-gauge-seen'

/**
 * The engine draws into a string of SVG, so it needs resolved colours rather
 * than a var(). On Ink the needle flips to Paper, which is what keeps it the
 * extreme-contrast element and the thing the eye lands on.
 */
function useGround() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const root = document.documentElement
    const read = () => setDark(root.dataset.mode === 'dark' || root.classList.contains('dark'))
    read()
    const mo = new MutationObserver(read)
    mo.observe(root, { attributes: true, attributeFilter: ['data-mode', 'class'] })
    return () => mo.disconnect()
  }, [])
  return dark
    ? { ink: TOKENS.paper, needleColour: TOKENS.paper }
    : { ink: TOKENS.ink, needleColour: TOKENS.char }
}

/** The bearing the needle points at for a reading, in the engine's own sweep. */
function bearing(value: number): number {
  const [a0, a1] = GEOM.sweep as [number, number]
  const t = Math.max(0, Math.min(1, value / 100))
  return a0 + (a1 - a0) * t
}

export function BrandGauge({ value, size = 320, ticks }: { value: number; size?: number; ticks?: number }) {
  const host = useRef<HTMLDivElement>(null)
  const previous = useRef<number | null>(null)
  const ground = useGround()

  useEffect(() => {
    const el = host.current
    const svg = el?.querySelector('svg')
    if (!el || !svg) return

    const groups = Array.from(svg.querySelectorAll(':scope > g'))
    const needle = groups.pop()

    // Tag the ticks so they can light in sequence. The paths are untouched.
    groups.forEach((g, i) => {
      g.classList.add('bg-tick')
      ;(g as SVGElement).style.setProperty('--i', String(i))
    })

    if (needle) {
      // The needle turns inside a wrapper, about the sweep's own pivot, so the
      // engine's transform on the needle itself is never overwritten.
      const wrap = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      wrap.setAttribute('class', 'bg-needle')
      const box = svg.viewBox.baseVal
      // view-box, so the pivot is read in the drawing's own coordinates
      wrap.style.transformBox = 'view-box'
      wrap.style.transformOrigin = `${box.width / 2}px ${box.height * 0.78}px`
      needle.parentNode?.insertBefore(wrap, needle)
      wrap.appendChild(needle)

      // A reading that moved: start the needle where it was and let it settle.
      const from = previous.current
      if (from !== null && from !== value) {
        const delta = bearing(from) - bearing(value)
        wrap.style.transition = 'none'
        wrap.style.transform = `rotate(${-delta}deg)`
        requestAnimationFrame(() => {
          wrap.style.transition = ''
          wrap.style.transform = 'rotate(0deg)'
        })
      }
    }
    previous.current = value

    // The first-paint sequence runs once per session, and never on scroll.
    try {
      if (!sessionStorage.getItem(SEEN)) {
        sessionStorage.setItem(SEEN, '1')
        el.classList.add('bg-gauge-enter')
      }
    } catch { /* private mode: the final state is what is drawn */ }
  }, [value, size, ticks, ground.ink, ground.needleColour])

  return (
    <div ref={host}>
      <KitGauge value={value} size={size} ticks={ticks} ink={ground.ink} needleColour={ground.needleColour} />
    </div>
  )
}
