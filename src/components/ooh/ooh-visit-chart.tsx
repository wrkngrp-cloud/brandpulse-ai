'use client'

import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Activity } from 'lucide-react'

interface Visit {
  visited_at: string
  device_type: string | null
  ip_region:   string | null
}

interface OohVisitChartProps {
  visits: Visit[]
  siteId: string
}

function aggregateByDay(visits: Visit[]): { date: string; visits: number }[] {
  const counts: Record<string, number> = {}

  // Fill last 30 days with 0
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    counts[key] = 0
  }

  visits.forEach(v => {
    const key = v.visited_at.slice(0, 10)
    if (key in counts) counts[key] = (counts[key] ?? 0) + 1
  })

  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, visits]) => ({
      date: new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' }),
      visits,
    }))
}

function deviceBreakdown(visits: Visit[]) {
  const counts = { mobile: 0, desktop: 0, tablet: 0 }
  visits.forEach(v => {
    const dt = v.device_type ?? 'desktop'
    if (dt in counts) counts[dt as keyof typeof counts]++
  })
  return counts
}

export function OohVisitChart({ visits }: OohVisitChartProps) {
  const chartData = aggregateByDay(visits)
  const devices   = deviceBreakdown(visits)
  const total     = visits.length

  return (
    <div className="border rounded-xl p-5 bg-card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Tracked visits</h3>
        </div>
        <span className="text-xs text-muted-foreground">Last 30 days</span>
      </div>

      {total === 0 ? (
        <div className="h-40 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">
            No tracked visits yet. Share the vanity link to start attribution.
          </p>
        </div>
      ) : (
        <>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="visitGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"   stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                    <stop offset="95%"  stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false} axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false} axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--card))',
                    borderRadius: '8px',
                  }}
                />
                <Area
                  type="monotone" dataKey="visits"
                  stroke="hsl(var(--primary))" strokeWidth={2}
                  fill="url(#visitGradient)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Device breakdown */}
          <div className="flex items-center gap-5 text-xs text-muted-foreground pt-1 border-t">
            <span>Device mix: </span>
            {devices.mobile  > 0 && <span><strong className="text-foreground">{Math.round(devices.mobile  / total * 100)}%</strong> mobile</span>}
            {devices.desktop > 0 && <span><strong className="text-foreground">{Math.round(devices.desktop / total * 100)}%</strong> desktop</span>}
            {devices.tablet  > 0 && <span><strong className="text-foreground">{Math.round(devices.tablet  / total * 100)}%</strong> tablet</span>}
          </div>
        </>
      )}
    </div>
  )
}
