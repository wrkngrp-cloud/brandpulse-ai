'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const WEEKLY_DATA = [
  { week: 'Wk 1', conversions: 82 },
  { week: 'Wk 2', conversions: 118 },
  { week: 'Wk 3', conversions: 97 },
  { week: 'Wk 4', conversions: 145 },
  { week: 'Wk 5', conversions: 163 },
  { week: 'Wk 6', conversions: 201 },
  { week: 'Wk 7', conversions: 188 },
  { week: 'Wk 8', conversions: 246 },
]

export function CampaignConversionsChart() {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={WEEKLY_DATA} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="week" tick={{ fontSize: 11 }} className="text-muted-foreground" />
        <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            border: '1px solid hsl(var(--border))',
            borderRadius: 8,
            background: 'hsl(var(--card))',
          }}
          labelStyle={{ fontWeight: 600 }}
        />
        <Line
          type="monotone"
          dataKey="conversions"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={{ r: 3, fill: 'hsl(var(--primary))' }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
