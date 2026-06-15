'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────

interface DataPoint {
  date:       string
  bhi?:       number | null
  sentiment?: number | null
}

interface Props {
  data:       DataPoint[]
  className?: string
  height?:    number
}

// ── Custom tooltip ─────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: {
  active?:   boolean
  payload?:  { value: number; name: string; color: string }[]
  label?:    string
}) {
  if (!active || !payload?.length) return null

  const date = label
    ? new Date(label).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: '2-digit' })
    : ''

  return (
    <div className="bg-[#14182B] border border-white/10 rounded-xl shadow-2xl px-3.5 py-2.5 min-w-[150px]">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.10em] text-white/40 mb-2">{date}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center justify-between gap-4 mb-1 last:mb-0">
          <div className="flex items-center gap-1.5">
            <span
              className="h-1.5 w-3 rounded-full shrink-0"
              style={{ background: p.color }}
            />
            <span className="text-[11.5px] text-white/60 capitalize">{p.name}</span>
          </div>
          <span
            className="text-[13px] font-semibold tabular-nums"
            style={{ color: p.color }}
          >
            {Math.round(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Custom x-axis tick ─────────────────────────────────────────────────────

function DateTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  if (!payload?.value) return null
  const label = new Date(payload.value).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
  return (
    <text x={x} y={(y ?? 0) + 12} textAnchor="middle" fontSize={10} fill="currentColor" className="text-muted-foreground opacity-40" fontFamily="var(--font-sans)">
      {label}
    </text>
  )
}

// ── Legend ─────────────────────────────────────────────────────────────────

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex items-center gap-5">
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span className="h-[3px] w-4 rounded-full" style={{ background: item.color }} />
          <span className="text-[11px] text-muted-foreground/60 font-medium">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function TrendChart({ data, className, height = 200 }: Props) {
  const hasBHI       = data.some(d => d.bhi != null)
  const hasSentiment = data.some(d => d.sentiment != null)

  if (!data.length || (!hasBHI && !hasSentiment)) return null

  const legendItems = [
    hasBHI       && { label: 'Brand Health',    color: '#2B59FF' },
    hasSentiment && { label: 'Sentiment Score', color: '#22c55e'  },
  ].filter(Boolean) as { label: string; color: string }[]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={cn('w-full', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="eyebrow mb-1">30-Day Pulse</p>
          <h3 className="text-[15px] font-semibold tracking-tight">Brand Signal Trend</h3>
        </div>
        <Legend items={legendItems} />
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
          <defs>
            {/* Blue gradient — BHI */}
            <linearGradient id="gradBHI" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#2B59FF" stopOpacity={0.30} />
              <stop offset="40%"  stopColor="#2B59FF" stopOpacity={0.12} />
              <stop offset="100%" stopColor="#2B59FF" stopOpacity={0}    />
            </linearGradient>
            {/* Green gradient — Sentiment */}
            <linearGradient id="gradSentiment" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#22c55e" stopOpacity={0.28} />
              <stop offset="40%"  stopColor="#22c55e" stopOpacity={0.10} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0}    />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="0"
            horizontal={true}
            vertical={false}
            stroke="currentColor"
            className="text-border opacity-40"
          />

          <XAxis
            dataKey="date"
            tick={<DateTick />}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />

          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: 'currentColor', className: 'opacity-35' }}
            tickLine={false}
            axisLine={false}
            tickCount={5}
            fontFamily="var(--font-sans)"
          />

          {/* 50% reference line — neutral threshold */}
          <ReferenceLine
            y={50}
            stroke="currentColor"
            strokeDasharray="4 4"
            strokeOpacity={0.20}
          />

          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: 'currentColor', strokeOpacity: 0.12, strokeWidth: 1 }}
          />

          {hasSentiment && (
            <Area
              type="monotone"
              dataKey="sentiment"
              name="Sentiment"
              stroke="#22c55e"
              strokeWidth={2}
              fill="url(#gradSentiment)"
              dot={false}
              activeDot={{ r: 4, fill: '#22c55e', strokeWidth: 2, stroke: '#fff' }}
              connectNulls={false}
            />
          )}

          {hasBHI && (
            <Area
              type="monotone"
              dataKey="bhi"
              name="Brand Health"
              stroke="#2B59FF"
              strokeWidth={2.5}
              fill="url(#gradBHI)"
              dot={false}
              activeDot={{ r: 4.5, fill: '#2B59FF', strokeWidth: 2, stroke: '#fff' }}
              connectNulls={false}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  )
}
