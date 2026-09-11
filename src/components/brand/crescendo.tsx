'use client'

import { useEffect, useState } from 'react'
import { Crescendo as KitCrescendo, Label } from '@brand/components'
import { TOKENS } from '@/lib/brand-tokens'

/**
 * The arc unrolled: the workhorse bar, ticks growing in size and heat toward
 * the head. The engine draws into a string of SVG and cannot read a var(),
 * so the unlit end takes the ground's own ink — Paper on Ink, Ink on Paper —
 * which is what keeps the unlit ticks visible in either mode.
 */
export function Crescendo(props: { value: number; segments?: number; height?: number }) {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const root = document.documentElement
    const read = () => setDark(root.dataset.mode === 'dark' || root.classList.contains('dark'))
    read()
    const mo = new MutationObserver(read)
    mo.observe(root, { attributes: true, attributeFilter: ['data-mode', 'class'] })
    return () => mo.disconnect()
  }, [])
  return <KitCrescendo {...props} ink={dark ? TOKENS.paper : TOKENS.ink} />
}

/**
 * The Meter, with the ground-aware crescendo in it. Layout and sizes are the
 * kit's own; only the unlit ink changes with the mode.
 */
export function Meter({ label, value }: { label: React.ReactNode; value: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '112px 1fr 40px', gap: 'var(--s-3)', alignItems: 'center' }}>
      <Label>{label}</Label>
      <Crescendo value={value} />
      <span className="bg-num" style={{ fontSize: 'var(--t-small)', textAlign: 'right' }}>{value}</span>
    </div>
  )
}
