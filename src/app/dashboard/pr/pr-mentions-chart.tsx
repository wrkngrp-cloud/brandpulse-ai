'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const MONTHLY_DATA = [
  { month: 'Jan', mentions: 4 },
  { month: 'Feb', mentions: 7 },
  { month: 'Mar', mentions: 5 },
  { month: 'Apr', mentions: 9 },
  { month: 'May', mentions: 12 },
  { month: 'Jun', mentions: 8 },
]

export function PrMentionsChart() {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={MONTHLY_DATA} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} className="text-muted-foreground" />
        <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" allowDecimals={false} />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            border: '1px solid hsl(var(--border))',
            borderRadius: 8,
            background: 'hsl(var(--card))',
          }}
          labelStyle={{ fontWeight: 600 }}
          formatter={(value) => [value, 'Press mentions']}
        />
        <Bar
          dataKey="mentions"
          fill="hsl(var(--primary))"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
