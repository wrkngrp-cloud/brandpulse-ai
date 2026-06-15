'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

const weeklyReach = [
  { week: 'Wk 1', coolFm: 320000, beatFm: 210000, wazobia: 280000 },
  { week: 'Wk 2', coolFm: 350000, beatFm: 230000, wazobia: 310000 },
  { week: 'Wk 3', coolFm: 290000, beatFm: 195000, wazobia: 260000 },
  { week: 'Wk 4', coolFm: 410000, beatFm: 260000, wazobia: 340000 },
  { week: 'Wk 5', coolFm: 380000, beatFm: 240000, wazobia: 320000 },
  { week: 'Wk 6', coolFm: 430000, beatFm: 275000, wazobia: 360000 },
  { week: 'Wk 7', coolFm: 395000, beatFm: 250000, wazobia: 330000 },
  { week: 'Wk 8', coolFm: 420000, beatFm: 265000, wazobia: 350000 },
]

function formatNum(val: number) {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`
  return `${val}`
}

export function RadioReachChart() {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={weeklyReach} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
        <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={formatNum} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={48} />
        <Tooltip
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
          formatter={(val) => [typeof val === 'number' ? formatNum(val) : val, '']}
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Bar dataKey="coolFm"  name="Cool FM"   fill="#6366f1" radius={[3, 3, 0, 0]} />
        <Bar dataKey="beatFm"  name="Beat FM"   fill="#10b981" radius={[3, 3, 0, 0]} />
        <Bar dataKey="wazobia" name="Wazobia FM" fill="#f59e0b" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
