// Server component — no interactivity needed.
import type { BHIResult } from '@/lib/bhi'
import { ZONE_META } from '@/lib/bhi'

interface Props {
  bhi: BHIResult
  sparkline?: { date: string; score: number }[]
}

function scorePath(score: number, r: number, cx: number, cy: number): string {
  if (score <= 0) return `M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx - r + 0.01} ${cy}`
  const clamped = Math.min(score, 100)
  const θ = (clamped / 100) * Math.PI
  const endX = (cx - r * Math.cos(θ)).toFixed(3)
  const endY = (cy - r * Math.sin(θ)).toFixed(3)
  // large-arc=0: always ≤180°, sweep=0: goes counterclockwise (upward from left)
  return `M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${endX} ${endY}`
}

export function BHIGauge({ bhi, sparkline = [] }: Props) {
  const r = 72
  const cx = 100
  const cy = 100
  const sw = 13

  const zone  = bhi.zone ? ZONE_META[bhi.zone] : null
  const color = zone?.color ?? '#94a3b8'
  const label = zone?.label ?? 'No data'

  const trackPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy}`
  const fillPath  = bhi.score !== null ? scorePath(bhi.score, r, cx, cy) : null

  // Zone boundary tick positions on the arc
  const ticks = [40, 65, 80].map(pct => {
    const θ = (pct / 100) * Math.PI
    return {
      x: (cx - r * Math.cos(θ)).toFixed(2),
      y: (cy - r * Math.sin(θ)).toFixed(2),
      color: ZONE_META[pct < 40 ? 'at_risk' : pct < 65 ? 'building' : pct < 80 ? 'healthy' : 'leading'].color,
    }
  })

  // Sparkline
  const hasSpark = sparkline.length > 1
  const sparkW   = 200
  const sparkH   = 28
  const scores   = sparkline.map(s => s.score)
  const minS     = Math.max(0,   Math.min(...scores) - 5)
  const maxS     = Math.min(100, Math.max(...scores) + 5)
  const range    = Math.max(maxS - minS, 5)
  const sparkPts = sparkline
    .map((s, i) => {
      const x = (i / (sparkline.length - 1)) * sparkW
      const y = sparkH - ((s.score - minS) / range) * sparkH
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <div className="space-y-3">
      {/* Gauge SVG */}
      <div className="flex justify-center">
        <svg
          width="200"
          height="110"
          viewBox="0 0 200 110"
          aria-label={`Brand Health Index: ${bhi.score !== null ? Math.round(bhi.score) : 'no data'} — ${label}`}
        >
          {/* Background track */}
          <path
            d={trackPath}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={sw}
            strokeLinecap="round"
          />

          {/* Filled score arc */}
          {fillPath && (
            <path
              d={fillPath}
              fill="none"
              stroke={color}
              strokeWidth={sw}
              strokeLinecap="round"
            />
          )}

          {/* Zone boundary ticks */}
          {ticks.map((t, i) => (
            <circle
              key={i}
              cx={t.x}
              cy={t.y}
              r="2.5"
              fill="hsl(var(--background))"
              stroke={t.color}
              strokeWidth="1.5"
            />
          ))}

          {/* Score number */}
          <text
            x={cx}
            y={cy - 14}
            textAnchor="middle"
            fill="currentColor"
            fontSize="32"
            fontWeight="700"
            fontFamily="inherit"
          >
            {bhi.score !== null ? Math.round(bhi.score) : '—'}
          </text>

          {/* Zone label */}
          <text
            x={cx}
            y={cx + 6}
            textAnchor="middle"
            fill={color}
            fontSize="11"
            fontWeight="600"
            fontFamily="inherit"
          >
            {label.toUpperCase()}
          </text>

          {/* Scale labels */}
          <text x="16" y={cy + 16} fill="hsl(var(--muted-foreground))" fontSize="9" textAnchor="middle">0</text>
          <text x="184" y={cy + 16} fill="hsl(var(--muted-foreground))" fontSize="9" textAnchor="middle">100</text>
        </svg>
      </div>

      {/* Zone legend */}
      <div className="grid grid-cols-4 gap-1 text-center">
        {(['at_risk', 'building', 'healthy', 'leading'] as const).map(z => (
          <div key={z} className="space-y-0.5">
            <div className="h-1 rounded-full mx-1" style={{ backgroundColor: ZONE_META[z].color }} />
            <p className="text-[9px] text-muted-foreground">{ZONE_META[z].label}</p>
          </div>
        ))}
      </div>

      {/* Data coverage */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Data coverage</span>
          <span>{bhi.coverage}%</span>
        </div>
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${bhi.coverage}%`, backgroundColor: color }}
          />
        </div>
        <div className="flex justify-between text-[9px] text-muted-foreground">
          <span>Sentiment&nbsp;{bhi.components.sentiment !== null ? Math.round(bhi.components.sentiment) : '–'}</span>
          <span>SOV&nbsp;{bhi.components.sov !== null ? Math.round(bhi.components.sov) : '–'}</span>
          <span>Survey&nbsp;{bhi.components.survey !== null ? Math.round(bhi.components.survey) : '–'}</span>
        </div>
      </div>

      {/* Sparkline */}
      {hasSpark && (
        <div className="space-y-0.5">
          <p className="text-[9px] text-muted-foreground">Trend</p>
          <svg
            width="100%"
            height={sparkH}
            viewBox={`0 0 ${sparkW} ${sparkH}`}
            preserveAspectRatio="none"
            className="opacity-80"
          >
            <polyline
              points={sparkPts}
              fill="none"
              stroke={color}
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}
    </div>
  )
}
