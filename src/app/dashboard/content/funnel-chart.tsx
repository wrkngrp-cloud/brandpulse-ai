'use client'
import { ChartState } from '@/components/brand/chart-states'
import { heat } from '@/lib/brand-tokens'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'

interface FunnelData {
  stage: string
  posts: number
  avg_engagement: number
  avg_reach: number
}

interface Props {
  data: FunnelData[]
}

/**
 * The ramp grades, it never mixes.
 *
 * These stages used to be Flare, ash, ink, Ember, Flare — five colours in no
 * order, Flare twice, so the heat said "which stage" instead of "how much".
 * They grade along the ramp in stage order now, the same way brand/engine.js
 * grades its funnel: hottest on the widest stage at the top, coldest at the
 * bottom, so heat still means value here as it does on the gauge.
 */
function stageHeat(index: number, count: number): string {
  return heat(1 - index / Math.max(count - 1, 1))
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { value: number; name: string; color?: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[var(--bg-ink)] border border-line-inv rounded-xl px-3.5 py-2.5 min-w-[148px]">
      <p className="text-[10.5px] font-semibold text-tx-inv-2 mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center justify-between gap-4 mb-1 last:mb-0">
          <div className="flex items-center gap-1.5">
            <span className="h-[3px] w-3 rounded-sm shrink-0" style={{ background: p.color ?? 'var(--flare)' }} />
            <span className="text-[11.5px] text-tx-inv-2 capitalize">{p.name.replace(/_/g, ' ')}</span>
          </div>
          <span className="text-[13px] font-semibold bg-num text-tx-inv">
            {typeof p.value === 'number' ? (p.name === 'avg_engagement' ? `${p.value.toFixed(2)}%` : p.value.toLocaleString()) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

export function FunnelChart({ data }: Props) {
  if (!data.length) return null
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Posts per stage */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Posts per funnel stage</p>
          <ChartState rows={data} height={140} empty="Connect a channel to see where people drop out of the funnel.">
                      <ResponsiveContainer width="100%" height={140}>
              <BarChart data={data} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
                <CartesianGrid strokeDasharray="0" horizontal vertical={false} stroke="currentColor" className="text-border opacity-35" />
                <XAxis dataKey="stage" tick={{ fontFamily: 'var(--font-num)',  fontSize: 9, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontFamily: 'var(--font-num)',  fontSize: 9, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="posts" radius={[4, 4, 0, 0]}>
                  {data.map((entry, i) => (
                    <Cell key={entry.stage} fill={stageHeat(i, data.length)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartState>
        </div>

        {/* Avg engagement per stage */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Avg engagement rate %</p>
          <ChartState rows={data} height={140} empty="Connect a channel to see where people drop out of the funnel.">
                      <ResponsiveContainer width="100%" height={140}>
              <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="0" horizontal vertical={false} stroke="currentColor" className="text-border opacity-35" />
                <XAxis dataKey="stage" tick={{ fontFamily: 'var(--font-num)',  fontSize: 9, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontFamily: 'var(--font-num)',  fontSize: 9, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="avg_engagement" radius={[4, 4, 0, 0]}>
                  {data.map((entry, i) => (
                    <Cell key={entry.stage} fill={stageHeat(i, data.length)} opacity={0.7} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartState>
        </div>
      </div>

      {/* Stage legend */}
      <div className="flex flex-wrap gap-3">
        {data.map((d, i) => (
          <div key={d.stage} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-[var(--r-tick)] shrink-0" style={{ background: stageHeat(i, data.length) }} />
            {d.stage}
          </div>
        ))}
      </div>
    </div>
  )
}
