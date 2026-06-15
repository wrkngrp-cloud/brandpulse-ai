'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

const weeklyData = [
  { week: 'Wk 1', spend: 280000, impressions: 480000 },
  { week: 'Wk 2', spend: 320000, impressions: 560000 },
  { week: 'Wk 3', spend: 295000, impressions: 510000 },
  { week: 'Wk 4', spend: 410000, impressions: 720000 },
  { week: 'Wk 5', spend: 380000, impressions: 650000 },
  { week: 'Wk 6', spend: 450000, impressions: 810000 },
  { week: 'Wk 7', spend: 390000, impressions: 680000 },
  { week: 'Wk 8', spend: 425000, impressions: 745000 },
]

function formatNGN(val: number) {
  if (val >= 1_000_000) return `₦${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `₦${(val / 1_000).toFixed(0)}K`
  return `₦${val}`
}

function formatImpr(val: number) {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`
  return `${val}`
}

export function DigitalSpendChart() {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={weeklyData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="imprGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
        <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="spend" tickFormatter={formatNGN} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={56} />
        <YAxis yAxisId="impr" orientation="right" tickFormatter={formatImpr} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={52} />
        <Tooltip
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
          formatter={(val, name) => name === 'spend' ? [typeof val === 'number' ? formatNGN(val) : val, 'Spend'] : [typeof val === 'number' ? formatImpr(val) : val, 'Impressions']}
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Area yAxisId="spend" type="monotone" dataKey="spend" stroke="#6366f1" strokeWidth={2} fill="url(#spendGrad)" name="spend" dot={false} />
        <Area yAxisId="impr" type="monotone" dataKey="impressions" stroke="#10b981" strokeWidth={2} fill="url(#imprGrad)" name="impressions" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
