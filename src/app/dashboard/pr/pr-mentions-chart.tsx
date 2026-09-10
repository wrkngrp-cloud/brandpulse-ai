'use client'
import { ChartState } from '@/components/brand/chart-states'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const FALLBACK_DATA = [
  { month: 'Jan', mentions: 0 },
  { month: 'Feb', mentions: 0 },
  { month: 'Mar', mentions: 0 },
  { month: 'Apr', mentions: 0 },
  { month: 'May', mentions: 0 },
  { month: 'Jun', mentions: 0 },
]

interface MentionDataPoint {
  month:    string
  mentions: number
}

interface Props {
  data?: MentionDataPoint[]
}

export function PrMentionsChart({ data }: Props) {
  const chartData = data && data.length > 0 ? data : FALLBACK_DATA

  return (
    <ChartState rows={chartData} height={200} empty="Add a publication to start tracking press mentions.">
          <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="month" tick={{ fontFamily: 'var(--font-num)',  fontSize: 11 }} className="text-muted-foreground" />
          <YAxis tick={{ fontFamily: 'var(--font-num)',  fontSize: 11 }} className="text-muted-foreground" allowDecimals={false} />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              border: '1px solid hsl(var(--border))',
              borderRadius: 'var(--r-card)',
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
    </ChartState>
  )
}
