'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'

const readership = [
  { pub: 'The Punch',  readers: 380000 },
  { pub: 'Vanguard',   readers: 290000 },
  { pub: 'BusinessDay', readers: 220000 },
]

function formatNum(val: number) {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`
  return `${val}`
}

export function PrintReadershipChart() {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={readership} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} horizontal={false} />
        <XAxis type="number" tickFormatter={formatNum} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="pub" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={88} />
        <Tooltip
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
          formatter={(val) => [typeof val === 'number' ? formatNum(val) : val, 'Readership']}
        />
        <Bar dataKey="readers" name="Readership" fill="#6366f1" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
