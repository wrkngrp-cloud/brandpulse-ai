'use client'

import { useMemo } from 'react'
import { Calculator } from 'lucide-react'

interface ImpressionCalculatorProps {
  dailyTraffic:    number | null
  monthlyCost:     number | null
  currency:        string
  campaignStart:   string | null
  campaignEnd:     string | null
  illuminated:     boolean
  poleCount?:      number
  formatType?:     string | null
  fleetSize?:      number | null
  surfaceWidthM?:  number | null
  surfaceHeightM?: number | null
}

export function ImpressionCalculator({
  dailyTraffic,
  monthlyCost,
  currency,
  campaignStart,
  campaignEnd,
  illuminated,
  poleCount = 1,
  formatType,
  fleetSize,
  surfaceWidthM,
  surfaceHeightM,
}: ImpressionCalculatorProps) {
  const isKeke    = formatType === 'Keke Fleet'
  const isMural   = formatType === 'Wall Painting'
  const isVehicle = formatType === 'Branded Vehicle'

  const metrics = useMemo(() => {
    let campaignDays = 30
    if (campaignStart && campaignEnd) {
      const diff = (new Date(campaignEnd).getTime() - new Date(campaignStart).getTime()) / (1000 * 60 * 60 * 24)
      campaignDays = Math.max(1, Math.round(diff))
    }
    const campaignMonths = campaignDays / 30

    // Keke fleet: fleet_size * 120 trips/day * 7 avg passengers / 10 deflation
    if (isKeke && fleetSize) {
      const hoursActive     = dailyTraffic ?? 10 // daily_traffic repurposed as hours_active for keke
      const grossImpressions = fleetSize * 120 * 7 * hoursActive / 10 * campaignDays
      const effectiveReach   = Math.round(grossImpressions * 0.35)
      const totalCost        = monthlyCost ? monthlyCost * campaignMonths : null
      const grossCpm         = totalCost && grossImpressions > 0 ? (totalCost / grossImpressions) * 1000 : null
      const effectiveCpm     = totalCost && effectiveReach > 0 ? (totalCost / effectiveReach) * 1000 : null
      return { campaignDays, grossImpressions: Math.round(grossImpressions), effectiveReach, totalCost, grossCpm, effectiveCpm, noteText: `${fleetSize} keke units × 120 trips/day × 7 avg passengers ÷ 10 impression deflation` }
    }

    // Wall painting: surface_width_m * surface_height_m * 150 per day
    if (isMural && surfaceWidthM && surfaceHeightM) {
      const grossImpressions = surfaceWidthM * surfaceHeightM * 150 * campaignDays
      const effectiveReach   = Math.round(grossImpressions * 0.25)
      const totalCost        = monthlyCost ? monthlyCost * campaignMonths : null
      const grossCpm         = totalCost && grossImpressions > 0 ? (totalCost / grossImpressions) * 1000 : null
      const effectiveCpm     = totalCost && effectiveReach > 0 ? (totalCost / effectiveReach) * 1000 : null
      return { campaignDays, grossImpressions: Math.round(grossImpressions), effectiveReach, totalCost, grossCpm, effectiveCpm, noteText: `${surfaceWidthM}m × ${surfaceHeightM}m = ${(surfaceWidthM * surfaceHeightM).toFixed(1)} m² × 150 visibility multiplier per day` }
    }

    // Branded vehicle: fleet_size * 2,000 per day
    if (isVehicle && fleetSize) {
      const grossImpressions = fleetSize * 2000 * campaignDays
      const effectiveReach   = Math.round(grossImpressions * 0.30)
      const totalCost        = monthlyCost ? monthlyCost * campaignMonths : null
      const grossCpm         = totalCost && grossImpressions > 0 ? (totalCost / grossImpressions) * 1000 : null
      const effectiveCpm     = totalCost && effectiveReach > 0 ? (totalCost / effectiveReach) * 1000 : null
      return { campaignDays, grossImpressions, effectiveReach, totalCost, grossCpm, effectiveCpm, noteText: `${fleetSize} vehicles × 2,000 estimated impressions/vehicle/day on urban routes` }
    }

    // Standard OOH / lamppole
    if (!dailyTraffic) return null

    const effectiveDailyTraffic = dailyTraffic * Math.max(1, poleCount)
    const grossImpressions = effectiveDailyTraffic * campaignDays
    const noticeRate       = poleCount > 1 ? 0.40 : illuminated ? 0.30 : 0.25
    const effectiveReach   = Math.round(grossImpressions * noticeRate)

    const totalCost    = monthlyCost ? monthlyCost * campaignMonths : null
    const grossCpm     = totalCost && grossImpressions > 0 ? (totalCost / grossImpressions) * 1000 : null
    const effectiveCpm = totalCost && effectiveReach > 0 ? (totalCost / effectiveReach) * 1000 : null

    const noteText = poleCount > 1
      ? `Corridor of ${poleCount} poles. Notice rate 40% — lamppole audiences are slower-moving and eye-level.`
      : `Notice rate benchmarks: 25% standard OOH, 30% illuminated. Effective CPM is the more conservative and honest metric.`

    return { campaignDays, grossImpressions, effectiveReach, totalCost, grossCpm, effectiveCpm, noteText }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyTraffic, monthlyCost, campaignStart, campaignEnd, illuminated, fleetSize, surfaceWidthM, surfaceHeightM, formatType])

  if (!metrics) {
    const noDataMsg = isKeke
      ? 'Add fleet size to calculate impressions for this keke fleet.'
      : isMural
        ? 'Add surface dimensions (width and height) to calculate impressions for this wall painting.'
        : isVehicle
          ? 'Add fleet size to calculate impressions for this branded vehicle fleet.'
          : 'Add estimated daily traffic to calculate impressions and CPM.'

    return (
      <div className="border rounded-xl p-5 bg-card">
        <div className="flex items-center gap-2 mb-3">
          <Calculator className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Impression Calculator</h3>
        </div>
        <p className="text-sm text-muted-foreground">{noDataMsg}</p>
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
        <MetricTile
          label="Effective reach"
          value={formatLargeNumber(metrics.effectiveReach)}
          note={isKeke ? '35% engagement rate' : isMural ? '25% notice rate' : isVehicle ? '30% notice rate' : `${poleCount > 1 ? '40%' : illuminated ? '30%' : '25%'} notice rate`}
        />
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

      <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2.5">{metrics.noteText}</p>
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
