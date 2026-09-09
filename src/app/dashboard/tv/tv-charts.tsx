'use client'
import { ChartState } from '@/components/brand/chart-states'

import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

const weeklyGRP = [
  { week: 'Wk 1', nta: 18, channels: 22, tvc: 14 },
  { week: 'Wk 2', nta: 21, channels: 25, tvc: 17 },
  { week: 'Wk 3', nta: 16, channels: 20, tvc: 12 },
  { week: 'Wk 4', nta: 24, channels: 28, tvc: 19 },
  { week: 'Wk 5', nta: 22, channels: 26, tvc: 16 },
  { week: 'Wk 6', nta: 26, channels: 30, tvc: 20 },
  { week: 'Wk 7', nta: 23, channels: 27, tvc: 18 },
  { week: 'Wk 8', nta: 25, channels: 29, tvc: 19 },
]

const daypartData = [
  { part: 'Morning',    grp: 34, audience: 620000 },
  { part: 'Afternoon',  grp: 28, audience: 510000 },
  { part: 'Prime Time', grp: 72, audience: 1320000 },
  { part: 'Late Night', grp: 34, audience: 620000 },
]

export function TVGRPChart() {
  return (
    <ChartState rows={weeklyGRP} height={260} empty="Add a TV buy to see weekly GRP.">
          <ResponsiveContainer width="100%" height={260}>
        <LineChart data={weeklyGRP} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
          <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={36} />
          <Tooltip
            contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--r-card)', fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Line type="monotone" dataKey="nta"      name="NTA"          stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="channels" name="Channels TV"  stroke="var(--chart-2)" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} />
          <Line type="monotone" dataKey="tvc"      name="TVC News"     stroke="var(--chart-3)" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartState>
  )
}

export function TVDaypartChart() {
  return (
    <ChartState rows={daypartData} height={220} empty="Add a TV buy to see weekly GRP.">
          <ResponsiveContainer width="100%" height={220}>
        <BarChart data={daypartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
          <XAxis dataKey="part" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={36} />
          <Tooltip
            contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--r-card)', fontSize: 12 }}
          />
          <Bar dataKey="grp" name="GRP" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartState>
  )
}
