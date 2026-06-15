'use client'

import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fadeUp } from '@/lib/motion'

type Tone = 'blue' | 'green' | 'amber' | 'clay' | 'violet'

interface SparkPoint { date: string; value: number }

interface StatCardProps {
  label:     string
  value:     string | number | null
  suffix?:   string
  delta?:    number | null        // percentage change e.g. +4.2 or -1.8
  deltaLabel?: string             // e.g. "vs last week"
  tone?:     Tone
  icon:      React.ElementType
  spark?:    SparkPoint[]
  href?:     string
  loading?:  boolean
}

const TONE_BOX: Record<Tone, string> = {
  blue:   'icon-box-blue',
  green:  'icon-box-green',
  amber:  'icon-box-amber',
  clay:   'icon-box-clay',
  violet: 'icon-box-violet',
}

function MiniSparkline({ points, tone }: { points: SparkPoint[]; tone: Tone }) {
  if (points.length < 2) return null

  const W = 120
  const H = 32
  const vals = points.map(p => p.value)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const range = Math.max(max - min, 1)

  const pts = points.map((p, i) => {
    const x = (i / (points.length - 1)) * W
    const y = H - ((p.value - min) / range) * (H - 4)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  const STROKE: Record<Tone, string> = {
    blue:   '#4F79FF',
    green:  '#22c55e',
    amber:  '#f59e0b',
    clay:   '#D4602A',
    violet: '#7C3AED',
  }

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={`spark-${tone}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={STROKE[tone]} stopOpacity="0.20" />
          <stop offset="100%" stopColor={STROKE[tone]} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${H} ${pts} ${W},${H}`}
        fill={`url(#spark-${tone})`}
      />
      <polyline
        points={pts}
        fill="none"
        stroke={STROKE[tone]}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  )
}

export function StatCard({
  label,
  value,
  suffix,
  delta,
  deltaLabel = 'vs last period',
  tone = 'blue',
  icon: Icon,
  spark,
  loading,
}: StatCardProps) {
  const isUp   = delta != null && delta >= 0
  const isDown = delta != null && delta < 0

  return (
    <motion.div
      variants={fadeUp}
      className={cn(
        'relative rounded-2xl overflow-hidden card-e2 card-hover p-5',
        'flex flex-col gap-0',
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-4">
        {/* Gradient icon box */}
        <div className={cn('h-11 w-11 rounded-xl grid place-items-center shrink-0 text-white', TONE_BOX[tone])}>
          <Icon className="h-5 w-5" />
        </div>

        {/* Trend badge */}
        {delta != null && !loading && (
          <span className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5',
            'text-[11px] font-semibold leading-none',
            isUp ? 'trend-up' : 'trend-down',
          )}>
            {isUp
              ? <TrendingUp className="h-2.5 w-2.5" />
              : <TrendingDown className="h-2.5 w-2.5" />
            }
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>

      {/* Value */}
      {loading ? (
        <div className="h-10 w-24 rounded-lg bg-muted/50 animate-pulse mb-1" />
      ) : (
        <div className="flex items-baseline gap-1 leading-none">
          <span className="metric text-[38px]">
            {value !== null && value !== undefined ? value : '—'}
          </span>
          {suffix && value !== null && (
            <span className="metric text-[22px] text-muted-foreground/45 ml-0.5">{suffix}</span>
          )}
        </div>
      )}

      {/* Label */}
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.10em] text-muted-foreground/55 select-none">
        {label}
      </p>

      {/* Delta sub-label */}
      {delta != null && deltaLabel && !loading && (
        <p className="mt-1 text-[11px] text-muted-foreground/45">{deltaLabel}</p>
      )}

      {/* Sparkline — bleeds to bottom with fade mask */}
      {spark && spark.length > 1 && !loading && (
        <div
          className="absolute bottom-0 right-0 pointer-events-none"
          style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 60%)' }}
        >
          <MiniSparkline points={spark} tone={tone} />
        </div>
      )}
    </motion.div>
  )
}
