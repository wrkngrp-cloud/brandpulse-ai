'use client'

import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { TrendingUp } from 'lucide-react'

interface SpendJustificationProps {
  monthlyCost:    number
  currency:      string
  dailyTraffic:  number | null
  campaignStart: string | null
  campaignEnd:   string | null
  trackedVisits: number
}

// Industry-average digital CPM benchmarks (in NGN)
const DIGITAL_BENCHMARKS = [
  { channel: 'Instagram Feed', cpm: 1200 },
  { channel: 'Facebook Feed',  cpm: 800  },
  { channel: 'YouTube Pre-roll', cpm: 600 },
  { channel: 'Twitter/X',     cpm: 900  },
]

export function SpendJustification({
  monthlyCost,
  currency,
  dailyTraffic,
  campaignStart,
  campaignEnd,
  trackedVisits,
}: SpendJustificationProps) {
  const metrics = useMemo(() => {
    let campaignDays = 30
    if (campaignStart && campaignEnd) {
      const diff = (new Date(campaignEnd).getTime() - new Date(campaignStart).getTime()) / (1000 * 60 * 60 * 24)
      campaignDays = Math.max(1, Math.round(diff))
    }
    const totalCost  = monthlyCost * (campaignDays / 30)
    const grossImpr  = dailyTraffic ? dailyTraffic * campaignDays : null
    const effectiveR = grossImpr ? Math.round(grossImpr * 0.25) : null

    const oohCpm = effectiveR && effectiveR > 0
      ? (totalCost / effectiveR) * 1000
      : null

    // Cost per tracked (attributed) visit
    const costPerVisit = trackedVisits > 0 ? totalCost / trackedVisits : null

    return { totalCost, grossImpr, effectiveR, oohCpm, costPerVisit, campaignDays }
  }, [monthlyCost, campaignStart, campaignEnd, dailyTraffic, trackedVisits])

  const chartData = DIGITAL_BENCHMARKS.map(b => ({
    ...b,
    ooh: metrics.oohCpm ?? 0,
  }))

  const oohIsChapest = metrics.oohCpm !== null
    && DIGITAL_BENCHMARKS.every(b => metrics.oohCpm! <= b.cpm)

  return (
    <div className="border rounded-xl p-5 bg-card space-y-5">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Spend Justification</h3>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-muted/40 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Total campaign spend</p>
          <p className="text-base font-semibold mt-0.5 tabular-nums">
            {currency} {metrics.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-muted-foreground">{metrics.campaignDays} days</p>
        </div>
        <div className="bg-muted/40 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">OOH effective CPM</p>
          <p className="text-base font-semibold mt-0.5 tabular-nums">
            {metrics.oohCpm != null
              ? `${currency} ${metrics.oohCpm.toFixed(2)}`
              : '—'}
          </p>
          <p className="text-xs text-muted-foreground">per 1K engaged</p>
        </div>
        <div className="bg-muted/40 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Cost per tracked visit</p>
          <p className="text-base font-semibold mt-0.5 tabular-nums">
            {metrics.costPerVisit != null
              ? `${currency} ${metrics.costPerVisit.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : '—'}
          </p>
          <p className="text-xs text-muted-foreground">{trackedVisits} attributed</p>
        </div>
      </div>

      {/* CPM comparison chart */}
      {metrics.oohCpm != null && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-3">
            OOH CPM vs digital channels (NGN benchmarks)
          </p>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { channel: 'This OOH', cpm: metrics.oohCpm },
                  ...DIGITAL_BENCHMARKS,
                ]}
                margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
                layout="vertical"
              >
                <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis
                  dataKey="channel" type="category"
                  tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                  width={80}
                />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any) => [`${currency} ${Number(v).toFixed(2)}`, 'CPM']}
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                />
                <Bar dataKey="cpm" radius={3}>
                  {[{ channel: 'This OOH' }, ...DIGITAL_BENCHMARKS].map((entry, i) => (
                    <Cell
                      key={entry.channel}
                      fill={i === 0 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.3)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {oohIsChapest && (
            <p className="text-xs text-green-700 dark:text-green-400 mt-2 bg-green-50 dark:bg-green-950/30 rounded-md px-3 py-2">
              This OOH site is delivering a lower CPM than all tracked digital channels.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
