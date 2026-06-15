'use client'

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

const STAGE_COLOURS: Record<string, string> = {
  Awareness:     '#3b82f6',
  Consideration: '#8b5cf6',
  Conversion:    '#22c55e',
  Loyalty:       '#f59e0b',
  'Re-engagement': '#f87171',
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { value: number; name: string; color?: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#14182B] border border-white/10 rounded-xl shadow-2xl px-3.5 py-2.5 min-w-[148px]">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.10em] text-white/40 mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center justify-between gap-4 mb-1 last:mb-0">
          <div className="flex items-center gap-1.5">
            <span className="h-[3px] w-3 rounded-full shrink-0" style={{ background: p.color ?? '#2B59FF' }} />
            <span className="text-[11.5px] text-white/55 capitalize">{p.name.replace(/_/g, ' ')}</span>
          </div>
          <span className="text-[13px] font-semibold tabular-nums text-white">
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
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={data} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
              <CartesianGrid strokeDasharray="0" horizontal vertical={false} stroke="currentColor" className="text-border opacity-35" />
              <XAxis dataKey="stage" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="posts" radius={[4, 4, 0, 0]}>
                {data.map(entry => (
                  <Cell key={entry.stage} fill={STAGE_COLOURS[entry.stage] ?? '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Avg engagement per stage */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Avg engagement rate %</p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="0" horizontal vertical={false} stroke="currentColor" className="text-border opacity-35" />
              <XAxis dataKey="stage" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="avg_engagement" radius={[4, 4, 0, 0]}>
                {data.map(entry => (
                  <Cell key={entry.stage} fill={STAGE_COLOURS[entry.stage] ?? '#94a3b8'} opacity={0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stage legend */}
      <div className="flex flex-wrap gap-3">
        {data.map(d => (
          <div key={d.stage} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: STAGE_COLOURS[d.stage] ?? '#94a3b8' }} />
            {d.stage}
          </div>
        ))}
      </div>
    </div>
  )
}
