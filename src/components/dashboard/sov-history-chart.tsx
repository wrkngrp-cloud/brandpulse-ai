'use client'
import { ChartState } from '@/components/brand/chart-states'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'

interface SovPoint {
  date:    string
  sov_pct: number
}

function CustomTooltip({ active, payload, label }: {
  active?:  boolean
  payload?: { value: number }[]
  label?:   string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[var(--bg-ink)] border border-line-inv rounded-xl px-3.5 py-2.5">
      <p className="text-[10.5px] font-semibold text-tx-inv/40 mb-1.5">
        {label ? new Date(label).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Africa/Lagos' }) : ''}
      </p>
      <p className="text-[15px] font-bold bg-num" style={{ color: 'var(--tx-inv)' }}>
        {payload[0].value.toFixed(1)}%
      </p>
      <p className="text-[10px] text-tx-inv/40 mt-0.5">Share of Voice</p>
    </div>
  )
}

export function SovHistoryChart({ data, days }: { data: SovPoint[]; days?: number }) {
  if (data.length < 2) return null

  const min = Math.max(0, Math.min(...data.map(d => d.sov_pct)) - 5)
  const max = Math.min(100, Math.max(...data.map(d => d.sov_pct)) + 5)

  const rangeLabel = days === 7 ? 'Last 7 days' : days === 84 ? 'Last 12 weeks' : days === 180 ? 'Last 6 months' : 'Last 30 days'

  return (
    <div className="border rounded-xl p-5 bg-card space-y-3">
      <div>
        <p className="text-sm font-semibold">SOV Over Time</p>
        <p className="text-xs text-muted-foreground">
          {rangeLabel}, <span className="bg-num">{data.length}</span> snapshots
        </p>
      </div>
      <ChartState rows={data} height={180} empty="Add a competitor to see share of voice over time.">
              <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id="sovGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="var(--flare)" stopOpacity={0.28} />
                <stop offset="60%"  stopColor="var(--flare)" stopOpacity={0.06} />
                <stop offset="100%" stopColor="var(--flare)" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="0" vertical={false} stroke="currentColor" className="text-border opacity-40" />
            <XAxis
              dataKey="date"
              tick={{ fontFamily: 'var(--font-num)',  fontSize: 10, fill: 'currentColor', opacity: 0.4 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              tickFormatter={(v: string) => new Date(v).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' })}
              fontFamily="var(--font-num)"
            />
            <YAxis
              domain={[min, max]}
              tick={{ fontFamily: 'var(--font-num)',  fontSize: 10, fill: 'currentColor', opacity: 0.35 }}
              tickLine={false}
              axisLine={false}
              tickCount={4}
              tickFormatter={(v: number) => `${v.toFixed(0)}%`}
              fontFamily="var(--font-num)"
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'currentColor', strokeOpacity: 0.12, strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="sov_pct"
              stroke="var(--flare)"
              strokeWidth={2}
              fill="url(#sovGrad)"
              dot={false}
              activeDot={{ r: 4.5, fill: 'var(--flare)', strokeWidth: 2, stroke: 'var(--bg-card)' }}
              connectNulls={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartState>
    </div>
  )
}
