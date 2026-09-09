'use client'

import type { BHIResult } from '@/lib/bhi'
import { ZONE_META } from '@/lib/bhi'
import { BrandGauge } from '@/components/brand/gauge'
import { Meter, Readout } from '@brand/components'
import { Sparkline } from '@brand/charts'

interface Props {
  bhi:          BHIResult
  sparkline?:   { date: string; score: number }[]
  trendLabel?:  string
}

/**
 * The Brand Health Index.
 *
 * The arc is the mark's own geometry, drawn by the engine: ticks growing in
 * size and heat toward the head, and the needle kept whole. The reading is
 * Disket, tabular. The three signals underneath are Meters, which is the
 * same crescendo unrolled into a line.
 *
 * The zone is a filled tick plus the word rather than a hue, because there
 * is no green in this system and ink-versus-flare survives colour blindness.
 */
export function BHIGauge({ bhi, sparkline = [], trendLabel = '30-day' }: Props) {
  const score = bhi.score !== null ? Math.round(Math.min(100, Math.max(0, bhi.score))) : null
  const zone  = bhi.zone ? ZONE_META[bhi.zone] : null

  const signals: { label: string; value: number | null }[] = [
    { label: 'Sentiment', value: bhi.components.sentiment },
    { label: 'Share of voice', value: bhi.components.sov },
    { label: 'Survey', value: bhi.components.survey },
  ]

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div
        role="img"
        aria-label={`Brand health index: ${score ?? 'no reading yet'}, ${zone?.label ?? 'no data'}`}
      >
        <BrandGauge value={score ?? 0} size={280} />
      </div>

      <div className="flex flex-col items-center gap-2">
        <Readout value={score !== null ? String(score) : '—'} unit="/100" size="md" />
        <span className="bg-label flex items-center gap-2">
          <i
            aria-hidden="true"
            style={{
              width: 6, height: 12, borderRadius: 'var(--r-tick)',
              background: bhi.zone === 'at_risk' ? 'var(--neg)' : bhi.zone ? 'var(--pos)' : 'var(--neu)',
            }}
          />
          {zone?.label ?? 'No reading yet'}
        </span>
      </div>

      <div className="grid w-full gap-2">
        {signals.map(s => (
          <Meter key={s.label} label={s.label} value={s.value !== null ? Math.round(s.value) : 0} />
        ))}
      </div>

      {sparkline.length > 1 && score !== null && (
        <div className="flex w-full items-center justify-between gap-3">
          <span className="bg-label">{trendLabel} trend</span>
          <Sparkline value={score} width={140} height={18} />
        </div>
      )}
    </div>
  )
}
