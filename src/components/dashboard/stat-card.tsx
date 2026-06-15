'use client'

import { useId } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fadeUp } from '@/lib/motion'

type Tone = 'blue' | 'green' | 'amber' | 'clay' | 'violet'

interface SparkPoint { date: string; value: number }

interface StatCardProps {
  label:       string
  value:       string | number | null
  suffix?:     string
  delta?:      number | null
  deltaLabel?: string
  tone?:       Tone
  icon:        React.ElementType
  spark?:      SparkPoint[]
  href?:       string
  loading?:    boolean
}

const TONE_BOX: Record<Tone, string> = {
  blue:   'icon-box-blue',
  green:  'icon-box-green',
  amber:  'icon-box-amber',
  clay:   'icon-box-clay',
  violet: 'icon-box-violet',
}

const TONE_SURFACE: Record<Tone, string> = {
  blue:   'tone-surface-blue',
  green:  'tone-surface-green',
  amber:  'tone-surface-amber',
  clay:   'tone-surface-clay',
  violet: 'tone-surface-violet',
}

const STROKE: Record<Tone, string> = {
  blue:   '#4F79FF',
  green:  '#22c55e',
  amber:  '#f59e0b',
  clay:   '#D4602A',
  violet: '#7C3AED',
}

// ── Smooth bezier sparkline ────────────────────────────────────────────────
// Horizontal cubic bezier: control points are midpoints in X, preserving Y.
// This gives the smooth, slightly tension-less curve that Stripe-like products use.

function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return ''
  const d: string[] = [`M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`]
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]
    const [x1, y1] = pts[i]
    const mx = ((x0 + x1) / 2).toFixed(1)
    d.push(`C ${mx} ${y0.toFixed(1)} ${mx} ${y1.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`)
  }
  return d.join(' ')
}

function MiniSparkline({ points, tone, uid }: { points: SparkPoint[]; tone: Tone; uid: string }) {
  if (points.length < 2) return null

  const W = 128
  const H = 36
  const vals = points.map(p => p.value)
  const min  = Math.min(...vals)
  const max  = Math.max(...vals)
  const range = Math.max(max - min, 1)

  const coords: [number, number][] = points.map((p, i) => [
    (i / (points.length - 1)) * W,
    H - 4 - ((p.value - min) / range) * (H - 8),
  ])

  const linePath = smoothPath(coords)

  // Closed area path: line path + drop down right → close bottom-left
  const first = coords[0]
  const last  = coords[coords.length - 1]
  const areaPath = `${linePath} L ${last[0].toFixed(1)} ${H} L ${first[0].toFixed(1)} ${H} Z`

  const gradId = `spark-${uid}`
  const color  = STROKE[tone]

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="overflow-visible"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0"    />
        </linearGradient>
      </defs>
      {/* Area fill */}
      <path d={areaPath} fill={`url(#${gradId})`} />
      {/* Stroke line */}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.90"
      />
    </svg>
  )
}

// ── Stat card ──────────────────────────────────────────────────────────────

export function StatCard({
  label,
  value,
  suffix,
  delta,
  deltaLabel = 'vs last period',
  tone = 'blue',
  icon: Icon,
  spark,
  href,
  loading,
}: StatCardProps) {
  const uid    = useId()
  const isUp   = delta != null && delta >= 0
  const isDown = delta != null && delta < 0

  const inner = (
    <motion.div
      variants={fadeUp}
      className={cn(
        'relative rounded-2xl overflow-hidden card-e2 p-5',
        'flex flex-col gap-0',
        href ? 'card-hover cursor-pointer' : '',
        TONE_SURFACE[tone],
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-3.5">
        <div className={cn('h-10 w-10 rounded-xl grid place-items-center shrink-0 text-white', TONE_BOX[tone])}>
          <Icon className="h-[17px] w-[17px]" />
        </div>

        {delta != null && !loading && (
          <span className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5',
            'text-[10.5px] font-semibold leading-none',
            isUp ? 'trend-up' : 'trend-down',
          )}>
            {isUp
              ? <TrendingUp  className="h-2.5 w-2.5" />
              : <TrendingDown className="h-2.5 w-2.5" />
            }
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>

      {/* Value */}
      {loading ? (
        <div className="h-10 w-20 rounded-lg bg-muted/50 animate-pulse mb-1" />
      ) : (
        <div className="flex items-baseline gap-1 leading-none">
          <span className="metric text-[36px]">
            {value !== null && value !== undefined ? value : '—'}
          </span>
          {suffix && value !== null && (
            <span className="metric text-[18px] text-muted-foreground/35 ml-0.5">{suffix}</span>
          )}
        </div>
      )}

      {/* Label */}
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.11em] text-muted-foreground/50 select-none leading-none">
        {label}
      </p>

      {/* Delta sub-label */}
      {deltaLabel && !loading && (
        <p className="mt-1.5 text-[11px] text-muted-foreground/38">{deltaLabel}</p>
      )}

      {/* Sparkline — bleeds to bottom edge with vertical fade */}
      {spark && spark.length > 1 && !loading && (
        <div
          className="absolute bottom-0 right-0 pointer-events-none"
          style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 50%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 50%)' }}
        >
          <MiniSparkline points={spark} tone={tone} uid={uid} />
        </div>
      )}
    </motion.div>
  )

  if (href) {
    return <Link href={href} className="block">{inner}</Link>
  }
  return inner
}
