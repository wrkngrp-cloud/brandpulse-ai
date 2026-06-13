'use client'

import { useMemo } from 'react'
import { Calculator } from 'lucide-react'

interface ImpressionCalculatorProps {
  dailyTraffic:  number | null
  monthlyCost:   number | null
  currency:      string
  campaignStart: string | null
  campaignEnd:   string | null
  illuminated:   boolean
  poleCount?:    number
}

export function ImpressionCalculator({
  dailyTraffic,
  monthlyCost,
  currency,
  campaignStart,
  campaignEnd,
  illuminated,
  poleCount = 1,
}: ImpressionCalculatorProps) {
  const metrics = useMemo(() => {
    if (!dailyTraffic) return null

    let campaignDays = 30
    if (campaignStart && campaignEnd) {
      const diff = (new Date(campaignEnd).getTime() - new Date(campaignStart).getTime()) / (1000 * 60 * 60 * 24)
      campaignDays = Math.max(1, Math.round(diff))
    }

    // For lamppole corridors, daily_traffic is per-pole; multiply across all poles
    const effectiveDailyTraffic = dailyTraffic * Math.max(1, poleCount)
    const grossImpressions = effectiveDailyTraffic * campaignDays
    const noticeRate       = poleCount > 1 ? 0.40 : illuminated ? 0.30 : 0.25
    const effectiveReach   = Math.round(grossImpressions * noticeRate)

    // Total cost = monthly_cost × campaign months
    const campaignMonths = campaignDays / 30
    const totalCost      = monthlyCost ? monthlyCost * campaignMonths : null
    const grossCpm       = totalCost && grossImpressions > 0
      ? (totalCost / grossImpressions) * 1000 : null
    const effectiveCpm   = totalCost && effectiveReach > 0
      ? (totalCost / effectiveReach) * 1000 : null

    return { campaignDays, grossImpressions, effectiveReach, totalCost, grossCpm, effectiveCpm }
  }, [dailyTraffic, monthlyCost, campaignStart, campaignEnd, illuminated])

  if (!metrics) {
    return (
      <div className="border rounded-xl p-5 bg-card">
        <div className="flex items-center gap-2 mb-3">
          <Calculator className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Impression Calculator</h3>
        </div>
        <p className="text-sm text-muted-foreground">Add estimated daily traffic to calculate impressions and CPM.</p>
      </div>
    )
  }

  return (
    <div className="border rounded-xl p-5 bg-card space-y-4">
      <div className="flex items-center gap-2">
        <Calculator className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Impression Calculator</h3>
        <span className="text-xs text-muted-foreground ml-auto">{metrics.campaignDays}-day campaign</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricTile label="Gross impressions" value={formatLargeNumber(metrics.grossImpressions)} note="All passers-by" />
        <MetricTile label="Effective reach" value={formatLargeNumber(metrics.effectiveReach)} note={`${poleCount > 1 ? '40%' : illuminated ? '30%' : '25%'} notice rate`} />
        <MetricTile
          label="Gross CPM"
          value={metrics.grossCpm != null ? `${currency} ${metrics.grossCpm.toFixed(2)}` : '—'}
          note="Per 1,000 impressions"
        />
        <MetricTile
          label="Effective CPM"
          value={metrics.effectiveCpm != null ? `${currency} ${metrics.effectiveCpm.toFixed(2)}` : '—'}
          note="Per 1,000 engaged"
        />
      </div>

      <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2.5">
        {poleCount > 1
          ? `Corridor of ${poleCount} poles. Notice rate 40% — lamppole audiences are slower-moving and eye-level. Effective CPM is the more conservative and honest metric for planning.`
          : 'Notice rate benchmarks: 25% standard OOH, 30% illuminated. Effective CPM is the more conservative and honest metric for planning.'}
      </p>
    </div>
  )
}

function MetricTile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="bg-muted/40 rounded-lg p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-base font-semibold mt-0.5 tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{note}</p>
    </div>
  )
}

function formatLargeNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`
  return n.toLocaleString()
}
