'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'

interface TrendPoint {
  day?:       string
  weekLabel?: string
  score:    number
  positive: number
  negative: number
}

interface Props {
  data:          TrendPoint[]
  weekly?:       boolean
  benchmarkP50?: number | null
}

function shortDate(d: string) {
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

function CustomTooltip({ active, payload, label }: {
  active?:  boolean
  payload?: { value: number; name: string; color: string }[]
  label?:   string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#14182B] border border-white/10 rounded-xl shadow-2xl px-3.5 py-2.5 min-w-[155px]">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.10em] text-white/40 mb-2">
        {shortDate(label ?? '')}
      </p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center justify-between gap-4 mb-1 last:mb-0">
          <div className="flex items-center gap-1.5">
            <span className="h-[3px] w-3 rounded-full shrink-0" style={{ background: p.color }} />
            <span className="text-[11.5px] text-white/55 capitalize">{p.name}</span>
          </div>
          <span className="text-[13px] font-semibold tabular-nums" style={{ color: p.color }}>
            {Math.round(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

export function SentimentTrendChart({ data, weekly = false, benchmarkP50 }: Props) {
  if (data.length < 2) return null

  const dateKey = weekly ? 'weekLabel' : 'day'

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
        <defs>
          {/* Sentiment score — blue */}
          <linearGradient id="sgScore" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#2B59FF" stopOpacity={0.28} />
            <stop offset="40%"  stopColor="#2B59FF" stopOpacity={0.10} />
            <stop offset="100%" stopColor="#2B59FF" stopOpacity={0}    />
          </linearGradient>
          {/* Positive — green */}
          <linearGradient id="sgPositive" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#22c55e" stopOpacity={0.22} />
            <stop offset="100%" stopColor="#22c55e" stopOpacity={0}    />
          </linearGradient>
          {/* Negative — red */}
          <linearGradient id="sgNegative" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#f87171" stopOpacity={0.22} />
            <stop offset="100%" stopColor="#f87171" stopOpacity={0}    />
          </linearGradient>
        </defs>

        <CartesianGrid
          strokeDasharray="0"
          horizontal
          vertical={false}
          stroke="currentColor"
          className="text-border opacity-35"
        />

        <XAxis
          dataKey={dateKey}
          tickFormatter={shortDate}
          interval={weekly ? 1 : Math.floor(data.length / 6)}
          tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.4, fontFamily: 'var(--font-sans)' }}
          axisLine={false}
          tickLine={false}
        />

        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.4, fontFamily: 'var(--font-sans)' }}
          tickLine={false}
          axisLine={false}
          tickCount={5}
        />

        <Tooltip
          content={<CustomTooltip />}
          cursor={{ stroke: 'currentColor', strokeOpacity: 0.12, strokeWidth: 1 }}
        />

        <ReferenceLine
          y={50}
          stroke="currentColor"
          strokeDasharray="4 4"
          strokeOpacity={0.20}
        />

        {benchmarkP50 != null && (
          <ReferenceLine
            y={benchmarkP50}
            stroke="#f59e0b"
            strokeDasharray="6 3"
            strokeWidth={1.5}
            strokeOpacity={0.7}
            label={{ value: `Sector P50 (${Math.round(benchmarkP50)})`, position: 'insideTopRight', fontSize: 9, fill: '#f59e0b', opacity: 0.85 }}
          />
        )}

        {/* Negative % — dashed bottom layer */}
        <Area
          type="monotone"
          dataKey="negative"
          name="negative %"
          stroke="#f87171"
          strokeWidth={1.5}
          strokeDasharray="5 3"
          fill="url(#sgNegative)"
          dot={false}
          activeDot={{ r: 3.5, fill: '#f87171', strokeWidth: 2, stroke: '#fff' }}
        />

        {/* Positive % */}
        <Area
          type="monotone"
          dataKey="positive"
          name="positive %"
          stroke="#22c55e"
          strokeWidth={1.5}
          strokeDasharray="5 3"
          fill="url(#sgPositive)"
          dot={false}
          activeDot={{ r: 3.5, fill: '#22c55e', strokeWidth: 2, stroke: '#fff' }}
        />

        {/* Sentiment score — primary, on top */}
        <Area
          type="monotone"
          dataKey="score"
          name="sentiment"
          stroke="#2B59FF"
          strokeWidth={2.5}
          fill="url(#sgScore)"
          dot={false}
          activeDot={{ r: 4.5, fill: '#2B59FF', strokeWidth: 2, stroke: '#fff' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
