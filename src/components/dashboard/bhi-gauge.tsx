'use client'

import { useEffect, useId } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import type { BHIResult } from '@/lib/bhi'
import { ZONE_META } from '@/lib/bhi'
import { cn } from '@/lib/utils'

interface Props {
  bhi: BHIResult
  sparkline?: { date: string; score: number }[]
}

// ── Gauge geometry ────────────────────────────────────────────────────────────
// 270° arc, centre (100, 108), radius 82
// Start (7:30 / bottom-left): angle 225° → (42, 166)
// End   (4:30 / bottom-right): angle 315° → (158, 166)
// SVG arc: M 42 166 A 82 82 0 1 1 158 166
//   large-arc-flag = 1 (270° > 180°)
//   sweep-flag     = 1 (clockwise)

const CX = 100
const CY = 108
const R  = 82

function ptOnArc(angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  return {
    x: +(CX + R * Math.cos(rad)).toFixed(3),
    y: +(CY - R * Math.sin(rad)).toFixed(3),
  }
}

const START = ptOnArc(225) // {x:42.0, y:166.0}
const END   = ptOnArc(315) // {x:158.0, y:166.0}

const TRACK_D = `M ${START.x} ${START.y} A ${R} ${R} 0 1 1 ${END.x} ${END.y}`

// Zone colour + gradient stops for the arc
// Elite uses brand true blue #2B59FF; never blend clay with blue
const ZONE_STOPS: Record<string, { from: string; to: string; glow: string }> = {
  critical: { from: '#ef4444', to: '#f87171', glow: 'rgba(239,68,68,0.4)'  },
  building: { from: '#f59e0b', to: '#fbbf24', glow: 'rgba(245,158,11,0.4)' },
  strong:   { from: '#22c55e', to: '#4ade80', glow: 'rgba(34,197,94,0.35)' },
  elite:    { from: '#2B59FF', to: '#4F79FF', glow: 'rgba(43,89,255,0.4)'  },
}

// Indicator dot position for a given score (0-100)
function indicatorPt(score: number) {
  // Map score 0-100 to arc from 225° down to 315° (going clockwise = decreasing in standard math)
  // At score=0  → angle 225° (start)
  // At score=100→ angle -45° = 315° (end)
  const angle = 225 - (score / 100) * 270
  return ptOnArc(angle)
}

// Count-up hook
function useCountUp(target: number, duration = 1.4) {
  const mv = useMotionValue(0)
  const display = useTransform(mv, (v) => String(Math.round(v)))
  useEffect(() => {
    const ctrl = animate(mv, target, { duration, ease: [0.25, 0.46, 0.45, 0.94] })
    return ctrl.stop
  }, [target]) // eslint-disable-line react-hooks/exhaustive-deps
  return display
}

export function BHIGauge({ bhi, sparkline = [] }: Props) {
  const gradId  = useId()
  const glowId  = useId()
  const maskId  = useId()
  const score   = bhi.score !== null ? Math.round(Math.min(100, Math.max(0, bhi.score))) : null
  const zone    = bhi.zone ? ZONE_META[bhi.zone] : null
  const stops   = bhi.zone ? (ZONE_STOPS[bhi.zone] ?? ZONE_STOPS.building) : ZONE_STOPS.building
  const display = useCountUp(score ?? 0)
  const dot     = score !== null ? indicatorPt(score) : null

  // Sparkline
  const hasSpark  = sparkline.length > 1
  const SW        = 220
  const SH        = 28
  const scores    = sparkline.map((s) => s.score)
  const minS      = Math.max(0, Math.min(...scores) - 4)
  const maxS      = Math.min(100, Math.max(...scores) + 4)
  const range     = Math.max(maxS - minS, 1)
  const sparkPts  = sparkline
    .map((s, i) => {
      const x = (i / (sparkline.length - 1)) * SW
      const y = SH - ((s.score - minS) / range) * (SH - 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const areaPath  = hasSpark
    ? `M 0,${SH} L ${sparkPts.replace(/(\d+\.?\d*),(\d+\.?\d*)/g, '$1,$2')} L ${SW},${SH} Z`
    : ''
  // Simpler area: polygon + a top line
  const linePoints = hasSpark ? sparkPts : ''

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {/* ── Arc gauge ─────────────────────────────────────────────────── */}
      <div className="relative">
        <svg
          width="220"
          height="138"
          viewBox="0 0 200 138"
          aria-label={`Brand Health Index: ${score ?? 'no data'} — ${zone?.label ?? 'No data'}`}
          className="overflow-visible"
        >
          <defs>
            {/* Gradient for the fill arc */}
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor={stops.from} />
              <stop offset="100%" stopColor={stops.to}   />
            </linearGradient>

            {/* Glow filter for the fill arc */}
            <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Clip for the sparkline area */}
            <clipPath id={maskId}>
              <rect x="0" y="0" width={SW} height={SH} />
            </clipPath>
          </defs>

          {/* Track (full 270° arc, very subtle) */}
          <path
            d={TRACK_D}
            fill="none"
            stroke="currentColor"
            strokeWidth={14}
            strokeLinecap="round"
            className="text-border opacity-40"
          />

          {/* Zone tick marks at 40, 65, 80 */}
          {[40, 65, 80].map((pct) => {
            const p = ptOnArc(225 - (pct / 100) * 270)
            return (
              <circle
                key={pct}
                cx={p.x}
                cy={p.y}
                r={2.5}
                fill="currentColor"
                className="text-background opacity-60"
              />
            )
          })}

          {/* Animated fill arc */}
          {score !== null && (
            <motion.path
              d={TRACK_D}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth={14}
              strokeLinecap="round"
              filter={`url(#${glowId})`}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: score / 100, opacity: 1 }}
              transition={{ pathLength: { duration: 1.4, ease: [0.25, 0.46, 0.45, 0.94] }, opacity: { duration: 0.3 } }}
            />
          )}

          {/* Indicator dot */}
          {score !== null && dot && (
            <motion.circle
              cx={dot.x}
              cy={dot.y}
              r={7}
              fill={stops.to}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.3, type: 'spring', stiffness: 300 }}
              style={{ filter: `drop-shadow(0 0 6px ${stops.glow})` }}
            />
          )}
          {score !== null && dot && (
            <motion.circle
              cx={dot.x}
              cy={dot.y}
              r={3.5}
              fill="white"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 1.25, duration: 0.25 }}
            />
          )}

          {/* Score number (count-up) — DM Serif Display */}
          <text
            x={CX}
            y={CY - 14}
            textAnchor="middle"
            dominantBaseline="auto"
            fontSize="46"
            fontWeight="400"
            fontFamily="var(--font-serif), Georgia, serif"
            letterSpacing="-1"
            fill="currentColor"
          >
            {score !== null ? <motion.tspan>{display}</motion.tspan> : '—'}
          </text>

          {/* /100 label */}
          <text
            x={CX}
            y={CY + 10}
            textAnchor="middle"
            fontSize="11"
            fill="currentColor"
            className="text-muted-foreground opacity-60"
            fontFamily="inherit"
          >
            out of 100
          </text>

          {/* Scale labels */}
          <text x={START.x - 2} y={START.y + 18} textAnchor="middle" fontSize="9" fill="currentColor" className="opacity-40" fontFamily="inherit">0</text>
          <text x={END.x   + 2} y={END.y   + 18} textAnchor="middle" fontSize="9" fill="currentColor" className="opacity-40" fontFamily="inherit">100</text>
        </svg>
      </div>

      {/* ── Zone badge ────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4 }}
      >
        <span
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border"
          style={{
            color:            zone?.color ?? '#94a3b8',
            backgroundColor:  zone ? `${zone.color}15` : 'transparent',
            borderColor:      zone ? `${zone.color}30` : 'transparent',
          }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: zone?.color ?? '#94a3b8' }} />
          {zone?.label ?? 'No data yet'}
        </span>
      </motion.div>

      {/* ── Component score pills ─────────────────────────────────────── */}
      <motion.div
        className="grid grid-cols-3 gap-2 w-full text-center"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.08, delayChildren: 0.5 } } }}
      >
        {[
          { label: 'Sentiment', value: bhi.components.sentiment },
          { label: 'SOV',       value: bhi.components.sov       },
          { label: 'Survey',    value: bhi.components.survey    },
        ].map((c) => (
          <motion.div
            key={c.label}
            variants={{ hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0 } }}
            className="rounded-lg border bg-muted/40 py-2.5 space-y-0.5 card-hover cursor-default"
          >
            <p className="text-sm font-semibold tabular-nums">
              {c.value !== null
                ? Math.round(c.value)
                : <span className="text-muted-foreground/30">—</span>}
            </p>
            <p className="text-[10px] text-muted-foreground">{c.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Sparkline ─────────────────────────────────────────────────── */}
      {hasSpark && (
        <motion.div
          className="w-full space-y-1.5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.5 }}
        >
          <p className="text-[10px] text-muted-foreground">30-day trend</p>
          <svg
            width="100%"
            height={SH}
            viewBox={`0 0 ${SW} ${SH}`}
            preserveAspectRatio="none"
            className="overflow-visible"
          >
            <defs>
              <linearGradient id={`${gradId}-area`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={stops.from} stopOpacity="0.25" />
                <stop offset="100%" stopColor={stops.from} stopOpacity="0"    />
              </linearGradient>
            </defs>
            {/* Area fill */}
            <polygon
              points={`0,${SH} ${linePoints} ${SW},${SH}`}
              fill={`url(#${gradId}-area)`}
            />
            {/* Line */}
            <polyline
              points={linePoints}
              fill="none"
              stroke={stops.from}
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        </motion.div>
      )}
    </div>
  )
}
