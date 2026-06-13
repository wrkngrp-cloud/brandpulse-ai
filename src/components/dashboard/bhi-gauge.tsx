import type { BHIResult } from '@/lib/bhi'
import { ZONE_META } from '@/lib/bhi'

interface Props {
  bhi: BHIResult
  sparkline?: { date: string; score: number }[]
}

function arc(score: number, r: number, cx: number, cy: number): string {
  if (score <= 0) return `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx - r + 0.01} ${cy}`
  const clamped = Math.min(score, 100)
  const θ = Math.PI - (clamped / 100) * Math.PI
  const x = (cx + r * Math.cos(θ)).toFixed(3)
  const y = (cy - r * Math.sin(θ)).toFixed(3)
  const large = clamped > 50 ? 1 : 0
  return `M ${cx - r} ${cy} A ${r} ${r} 0 ${large} 1 ${x} ${y}`
}

export function BHIGauge({ bhi, sparkline = [] }: Props) {
  const r  = 80
  const cx = 110
  const cy = 100
  const sw = 16

  const zone  = bhi.zone ? ZONE_META[bhi.zone] : null
  const color = zone?.color ?? '#94a3b8'
  const label = zone?.label ?? 'No data'

  const trackPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`
  const fillPath  = bhi.score !== null ? arc(bhi.score, r, cx, cy) : null

  // Zone ticks at 40, 65, 80
  const zoneTicks = [40, 65, 80].map(pct => {
    const θ = Math.PI - (pct / 100) * Math.PI
    return {
      x: (cx + r * Math.cos(θ)).toFixed(2),
      y: (cy - r * Math.sin(θ)).toFixed(2),
    }
  })

  // Sparkline
  const hasSpark = sparkline.length > 1
  const sparkW = 220
  const sparkH = 24
  const scores = sparkline.map(s => s.score)
  const minS   = Math.max(0,   Math.min(...scores) - 5)
  const maxS   = Math.min(100, Math.max(...scores) + 5)
  const range  = Math.max(maxS - minS, 5)
  const sparkPts = sparkline
    .map((s, i) => {
      const x = (i / (sparkline.length - 1)) * sparkW
      const y = sparkH - ((s.score - minS) / range) * sparkH
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <div className="space-y-4">
      {/* Gauge */}
      <div className="flex flex-col items-center gap-1">
        <svg
          width="220"
          height="118"
          viewBox="0 0 220 118"
          aria-label={`Brand Health Index: ${bhi.score !== null ? Math.round(bhi.score) : 'no data'} — ${label}`}
        >
          {/* Track */}
          <path d={trackPath} fill="none" stroke="hsl(var(--muted))" strokeWidth={sw} strokeLinecap="round" />

          {/* Fill */}
          {fillPath && (
            <path d={fillPath} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          )}

          {/* Zone ticks */}
          {zoneTicks.map((t, i) => (
            <circle key={i} cx={t.x} cy={t.y} r="3" fill="hsl(var(--background))" strokeWidth="0" />
          ))}

          {/* Score */}
          <text x={cx} y={cy - 10} textAnchor="middle" fill="currentColor" fontSize="40" fontWeight="700" fontFamily="inherit">
            {bhi.score !== null ? Math.round(bhi.score) : '—'}
          </text>

          {/* /100 */}
          <text x={cx} y={cy + 12} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="12" fontFamily="inherit">
            out of 100
          </text>

          {/* Scale */}
          <text x={cx - r - 4} y={cy + 20} fill="hsl(var(--muted-foreground))" fontSize="9" textAnchor="middle">0</text>
          <text x={cx + r + 4} y={cy + 20} fill="hsl(var(--muted-foreground))" fontSize="9" textAnchor="middle">100</text>
        </svg>

        {/* Zone badge */}
        <span
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
          style={{ backgroundColor: `${color}18`, color }}
        >
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          {label}
        </span>
      </div>

      {/* Component scores */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'Sentiment', value: bhi.components.sentiment },
          { label: 'SOV',       value: bhi.components.sov },
          { label: 'Survey',    value: bhi.components.survey },
        ].map(c => (
          <div key={c.label} className="border rounded-lg py-2 space-y-0.5">
            <p className="text-base font-semibold tabular-nums">
              {c.value !== null ? Math.round(c.value) : <span className="text-muted-foreground/40">—</span>}
            </p>
            <p className="text-[10px] text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Trend sparkline */}
      {hasSpark && (
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground">30-day trend</p>
          <svg
            width="100%"
            height={sparkH}
            viewBox={`0 0 ${sparkW} ${sparkH}`}
            preserveAspectRatio="none"
          >
            <polyline
              points={sparkPts}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity="0.8"
            />
          </svg>
        </div>
      )}
    </div>
  )
}
