'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'

interface TrendPoint {
  day: string
  score: number
  positive: number
  negative: number
}

interface Props {
  data: TrendPoint[]
}

function shortDate(d: string) {
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { value: number; name: string; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-background border rounded-xl shadow-lg px-3 py-2 text-xs space-y-1 min-w-[140px]">
      <p className="font-medium text-muted-foreground">{shortDate(label ?? '')}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="capitalize" style={{ color: p.color }}>{p.name}</span>
          <span className="font-semibold tabular-nums">{Math.round(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function SentimentTrendChart({ data }: Props) {
  if (data.length < 2) return null

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="day"
          tickFormatter={shortDate}
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={50} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.4} />
        <Line
          type="monotone"
          dataKey="score"
          name="sentiment"
          stroke="hsl(var(--foreground))"
          strokeWidth={2}
          dot={{ r: 3, fill: 'hsl(var(--foreground))', strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="positive"
          name="positive %"
          stroke="#22c55e"
          strokeWidth={1.5}
          dot={false}
          strokeDasharray="4 2"
        />
        <Line
          type="monotone"
          dataKey="negative"
          name="negative %"
          stroke="#f87171"
          strokeWidth={1.5}
          dot={false}
          strokeDasharray="4 2"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
