'use client'

import { useEffect, useRef } from 'react'
import { Gauge as KitGauge } from '@brand/components'

/**
 * The Brand Health Index, drawn by the brand engine.
 *
 * The arc, the ticks and the needle come out of brand/engine.js exactly as
 * supplied — the needle is rotated whole and nothing is rebuilt from ratios.
 * This only tags the drawn parts so motion.css can light the ticks in
 * sequence and let the needle travel and settle when the reading changes.
 *
 * The first-paint sequence runs once per session and never on scroll.
 */
const SEEN = 'bg-gauge-seen'

export function BrandGauge({ value, size = 320, ticks }: { value: number; size?: number; ticks?: number }) {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = host.current
    if (!el) return

    // Tag the drawn parts so motion.css can light them. The paths themselves
    // are untouched: this only adds a class and a stagger index.
    el.querySelectorAll('svg > path, svg > rect').forEach((n, i) => {
      n.classList.add('bg-tick')
      ;(n as SVGElement).style.setProperty('--i', String(i))
    })
    el.querySelector('svg > g:last-of-type')?.classList.add('bg-needle')

    // The first-paint sequence runs once per session, never on scroll.
    try {
      if (!sessionStorage.getItem(SEEN)) {
        sessionStorage.setItem(SEEN, '1')
        el.classList.add('bg-gauge-enter')
      }
    } catch { /* private mode: the final state is already what is drawn */ }
  }, [value, size, ticks])

  return (
    <div ref={host}>
      <KitGauge value={value} size={size} ticks={ticks} />
    </div>
  )
}
