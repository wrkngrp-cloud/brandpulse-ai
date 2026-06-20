'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, Target, Plus, Trash2, TrendingUp, ChevronDown } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import {
  getBenchmarks,
  benchCTR, benchCPC, benchCPM, benchROAS, benchFreq, benchCVR, benchCPL, benchCPI,
  OBJECTIVE_METRIC_LABELS, METRIC_FRIENDLY, METRIC_COMPARATOR_DEFAULT,
} from '@/lib/benchmarks/digital'

// ── types ──────────────────────────────────────────────────────────────────────

interface PerfRow {
  date:            string
  spend:           number
  impressions:     number
  reach:           number
  clicks:          number
  ctr:             number | null
  cpm:             number | null
  cpc:             number | null
  cpa:             number | null
  roas:            number | null
  frequency:       number | null
  video_views:     number | null
  video_view_rate: number | null
  conversions:     number
  objective:       string | null
  actions:         Record<string, number> | null
  campaign_name:   string | null
  platform:        string
}

interface CampaignTarget {
  id:                   string
  metric:               string
  comparator:           'lte' | 'gte'
  target_value:         number
  period:               string
  last_status:          string | null
}

interface Props {
  campaignId:      string
  campaignName:    string
  platform:        string
  objective:       string | null
  days:            number
  rows:            PerfRow[]
  initialTargets:  CampaignTarget[]
  industry:        string | null
}

// ── formatters ─────────────────────────────────────────────────────────────────

function fmtNGN(v: number) {
  if (v >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `₦${(v / 1_000).toFixed(0)}K`
  return `₦${Math.round(v)}`
}
function fmtNum(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`
  return `${Math.round(v)}`
}

function platformLabel(p: string) {
  const map: Record<string, string> = {
    meta: 'Meta Ads', google: 'Google Ads', tiktok: 'TikTok Ads',
    linkedin: 'LinkedIn Ads', twitter: 'X (Twitter) Ads',
  }
  return map[p] ?? p
}

// ── compute aggregates ──────────────────────────────────────────────────────────

function computeAggregates(rows: PerfRow[]) {
  const totalSpend       = rows.reduce((s, r) => s + (r.spend       ?? 0), 0)
  const totalImpressions = rows.reduce((s, r) => s + (r.impressions ?? 0), 0)
  const totalReach       = rows.reduce((s, r) => s + (r.reach       ?? 0), 0)
  const totalClicks      = rows.reduce((s, r) => s + (r.clicks      ?? 0), 0)
  const totalConversions = rows.reduce((s, r) => s + (r.conversions ?? 0), 0)
  const totalVideoViews  = rows.reduce((s, r) => s + (r.video_views ?? 0), 0)

  // Action counts from jsonb
  const totalLeads    = rows.reduce((s, r) => s + ((r.actions?.lead ?? 0) as number), 0)
  const totalInstalls = rows.reduce((s, r) => s + ((r.actions?.mobile_app_install ?? 0) as number), 0)

  const ctrRows  = rows.filter(r => r.ctr  && r.ctr  > 0)
  const cpmRows  = rows.filter(r => r.cpm  && r.cpm  > 0)
  const cpcRows  = rows.filter(r => r.cpc  && r.cpc  > 0)
  const cpaRows  = rows.filter(r => r.cpa  && r.cpa  > 0)
  const roasRows = rows.filter(r => r.roas && r.roas > 0)
  const freqRows = rows.filter(r => r.frequency && r.frequency > 0)

  const avg = (arr: PerfRow[], fn: (r: PerfRow) => number | null) => {
    const nonNull = arr.filter(r => fn(r) !== null)
    return nonNull.length > 0 ? nonNull.reduce((s, r) => s + (fn(r) ?? 0), 0) / nonNull.length : 0
  }

  const avgCtr  = avg(ctrRows,  r => r.ctr)
  const avgCpm  = avg(cpmRows,  r => r.cpm)
  const avgCpc  = avg(cpcRows,  r => r.cpc)
  const avgCpa  = avg(cpaRows,  r => r.cpa)
  const avgRoas = avg(roasRows, r => r.roas)
  const avgFreq = avg(freqRows, r => r.frequency)
  const cvr     = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0

  const cpl = totalLeads    > 0 ? totalSpend / totalLeads    : 0
  const cpi = totalInstalls > 0 ? totalSpend / totalInstalls : 0
  const installRate = totalClicks > 0 ? (totalInstalls / totalClicks) * 100 : 0
  const leadRate    = totalClicks > 0 ? (totalLeads    / totalClicks) * 100 : 0

  return {
    totalSpend, totalImpressions, totalReach, totalClicks, totalConversions,
    totalVideoViews, totalLeads, totalInstalls,
    avgCtr, avgCpm, avgCpc, avgCpa, avgRoas, avgFreq, cvr, cpl, cpi,
    installRate, leadRate,
  }
}

// ── metric display resolver ────────────────────────────────────────────────────

function getMetricDisplay(
  metric: string,
  agg: ReturnType<typeof computeAggregates>
): { value: string; raw: number } {
  const map: Record<string, { value: string; raw: number }> = {
    spend:              { value: fmtNGN(agg.totalSpend),       raw: agg.totalSpend },
    impressions:        { value: fmtNum(agg.totalImpressions), raw: agg.totalImpressions },
    reach:              { value: fmtNum(agg.totalReach),       raw: agg.totalReach },
    clicks:             { value: fmtNum(agg.totalClicks),      raw: agg.totalClicks },
    conversions:        { value: fmtNum(agg.totalConversions), raw: agg.totalConversions },
    leads:              { value: fmtNum(agg.totalLeads),       raw: agg.totalLeads },
    installs:           { value: fmtNum(agg.totalInstalls),    raw: agg.totalInstalls },
    ctr:                { value: agg.avgCtr  > 0 ? `${(agg.avgCtr * 100).toFixed(2)}%` : 'N/A', raw: agg.avgCtr },
    cpm:                { value: agg.avgCpm  > 0 ? fmtNGN(agg.avgCpm)  : 'N/A', raw: agg.avgCpm },
    cpc:                { value: agg.avgCpc  > 0 ? fmtNGN(agg.avgCpc)  : 'N/A', raw: agg.avgCpc },
    cpa:                { value: agg.avgCpa  > 0 ? fmtNGN(agg.avgCpa)  : 'N/A', raw: agg.avgCpa },
    roas:               { value: agg.avgRoas > 0 ? `${agg.avgRoas.toFixed(1)}x` : 'N/A', raw: agg.avgRoas },
    frequency:          { value: agg.avgFreq > 0 ? agg.avgFreq.toFixed(1) : 'N/A', raw: agg.avgFreq },
    cvr:                { value: agg.cvr     > 0 ? `${agg.cvr.toFixed(2)}%` : 'N/A', raw: agg.cvr },
    cpl:                { value: agg.cpl     > 0 ? fmtNGN(agg.cpl)     : 'N/A', raw: agg.cpl },
    cpi:                { value: agg.cpi     > 0 ? fmtNGN(agg.cpi)     : 'N/A', raw: agg.cpi },
    install_rate:       { value: agg.installRate > 0 ? `${agg.installRate.toFixed(2)}%` : 'N/A', raw: agg.installRate },
    lead_rate:          { value: agg.leadRate    > 0 ? `${agg.leadRate.toFixed(2)}%`    : 'N/A', raw: agg.leadRate },
    landing_page_views: { value: 'N/A', raw: 0 },
    revenue:            { value: 'N/A', raw: 0 },
  }
  return map[metric] ?? { value: '—', raw: 0 }
}

// ── GoalBar — shows actual vs target ─────────────────────────────────────────

function GoalBar({
  target,
  actual,
}: {
  target: CampaignTarget
  actual: number
}) {
  const isGte = target.comparator === 'gte'
  const pct   = isGte
    ? Math.min(100, (actual / target.target_value) * 100)
    : target.target_value > 0
      ? Math.min(100, ((target.target_value - Math.max(0, actual - target.target_value)) / target.target_value) * 100)
      : 0

  const onTrack = isGte
    ? actual >= target.target_value
    : actual <= target.target_value

  const color = onTrack ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-500' : 'bg-rose-500'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{METRIC_FRIENDLY[target.metric] ?? target.metric}</span>
        <span className={onTrack ? 'text-emerald-600 font-medium' : 'text-rose-500 font-medium'}>
          {onTrack ? 'On track' : 'Off track'}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Target: {isGte ? '≥' : '≤'} {target.target_value.toLocaleString()}</span>
        <span>Actual: {actual > 0 ? actual.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}</span>
      </div>
    </div>
  )
}

// ── AddTargetForm ──────────────────────────────────────────────────────────────

function AddTargetForm({
  campaignId,
  campaignName,
  platform,
  objective,
  onAdded,
}: {
  campaignId:   string
  campaignName: string
  platform:     string
  objective:    string | null
  onAdded:      (t: CampaignTarget) => void
}) {
  const [open, setOpen]   = useState(false)
  const [metric, setMetric]         = useState('cpa')
  const [comparator, setComparator] = useState<'lte' | 'gte'>('lte')
  const [value, setValue]           = useState('')
  const [period, setPeriod]         = useState<'daily' | 'campaign'>('campaign')
  const [pending, startTransition]  = useTransition()

  const objMetrics = objective && OBJECTIVE_METRIC_LABELS[objective]
    ? OBJECTIVE_METRIC_LABELS[objective].metrics
    : Object.keys(METRIC_FRIENDLY)

  function handleMetricChange(m: string) {
    setMetric(m)
    setComparator(METRIC_COMPARATOR_DEFAULT[m] ?? 'lte')
  }

  function handleSubmit() {
    const num = parseFloat(value)
    if (!value || isNaN(num) || num <= 0) {
      toast.error('Enter a valid target value')
      return
    }
    startTransition(async () => {
      const res = await fetch(`/api/digital/campaigns/${campaignId}/targets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metric, comparator, target_value: num, period,
          campaign_name: campaignName, platform,
        }),
      })
      if (!res.ok) {
        toast.error('Failed to save target')
        return
      }
      const data = await res.json() as CampaignTarget
      onAdded(data)
      setValue('')
      setOpen(false)
      toast.success('Target saved')
    })
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setOpen(true)}>
        <Plus className="h-3 w-3" /> Add target
      </Button>
    )
  }

  return (
    <div className="border rounded-xl p-4 space-y-3 bg-muted/30">
      <p className="text-xs font-semibold">New performance target</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-[11px]">Metric</Label>
          <Select value={metric} onValueChange={(v) => v && handleMetricChange(v)}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {objMetrics.map(m => (
                <SelectItem key={m} value={m} className="text-xs">{METRIC_FRIENDLY[m] ?? m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Condition</Label>
          <Select value={comparator} onValueChange={v => setComparator(v as 'lte' | 'gte')}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="lte" className="text-xs">Under (≤)</SelectItem>
              <SelectItem value="gte" className="text-xs">At least (≥)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Target value</Label>
          <Input
            className="h-7 text-xs"
            type="number"
            min="0"
            step="any"
            placeholder="e.g. 500"
            value={value}
            onChange={e => setValue(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Period</Label>
          <Select value={period} onValueChange={v => setPeriod(v as 'daily' | 'campaign')}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="campaign" className="text-xs">Campaign total</SelectItem>
              <SelectItem value="daily"    className="text-xs">Daily average</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" className="h-7 text-xs" onClick={handleSubmit} disabled={pending}>
          {pending ? 'Saving…' : 'Save target'}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

// ── main component ─────────────────────────────────────────────────────────────

export function CampaignDetailClient({
  campaignId,
  campaignName,
  platform,
  objective,
  days,
  rows,
  initialTargets,
  industry,
}: Props) {
  const [targets, setTargets] = useState<CampaignTarget[]>(initialTargets)
  const [, startTransition]   = useTransition()

  const agg   = computeAggregates(rows)
  const bench = getBenchmarks(industry)

  const objectiveConfig = objective ? OBJECTIVE_METRIC_LABELS[objective] : null
  const primaryMetrics  = objectiveConfig?.metrics ?? ['spend', 'impressions', 'clicks', 'conversions']

  function getBench(metric: string, raw: number) {
    if (raw <= 0) return null
    switch (metric) {
      case 'ctr':  return benchCTR(raw, bench)
      case 'cpc':  return benchCPC(raw, bench)
      case 'cpm':  return benchCPM(raw, bench)
      case 'roas': return benchROAS(raw, bench)
      case 'frequency': return benchFreq(raw, bench)
      case 'cvr':  return benchCVR(raw, bench)
      case 'cpl':  return benchCPL(raw, bench)
      case 'cpi':  return benchCPI(raw, bench)
      default:     return null
    }
  }

  function removeTarget(id: string, metric: string) {
    startTransition(async () => {
      await fetch(`/api/digital/campaigns/${campaignId}/targets?metric=${metric}`, { method: 'DELETE' })
      setTargets(prev => prev.filter(t => t.id !== id))
      toast.success('Target removed')
    })
  }

  // Daily spend for mini chart
  const dateSpend = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.date] = (acc[r.date] ?? 0) + r.spend
    return acc
  }, {})
  const sparkDates = Object.keys(dateSpend).sort()
  const maxSpend   = Math.max(...Object.values(dateSpend), 1)

  return (
    <div className="max-w-4xl space-y-6">

      {/* Header */}
      <div className="flex items-start gap-3">
        <Link
          href="/dashboard/digital"
          className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg border text-muted-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold truncate">{campaignName}</h1>
            <Badge variant="secondary" className="text-[10px] shrink-0">{platformLabel(platform)}</Badge>
            {objective && (
              <Badge variant="outline" className="text-[10px] shrink-0 capitalize">
                {objectiveConfig?.label ?? objective}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Last {days} days · {rows.length} data points</p>
        </div>
      </div>

      {/* Primary metric tiles — objective-specific */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {primaryMetrics.map(metric => {
          const { value, raw } = getMetricDisplay(metric, agg)
          const b = getBench(metric, raw)
          return (
            <Card key={metric} className="border rounded-xl p-4 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {METRIC_FRIENDLY[metric] ?? metric}
              </p>
              <p className="text-xl font-bold tabular-nums">{value}</p>
              {b && <p className={`text-[10px] font-medium ${b.cls}`}>{b.label}</p>}
            </Card>
          )
        })}
      </div>

      {/* Benchmark note */}
      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
        <span className="inline-block px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium">Estimated</span>
        Benchmarks are directional West African market estimates, not sourced data. They refine once your account builds 90+ days of history.
      </p>

      {/* Spend sparkline */}
      <Card className="border rounded-xl p-5 space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Daily Spend</h2>
          <p className="text-xs text-muted-foreground">Total: {fmtNGN(agg.totalSpend)}</p>
        </div>
        <div className="flex items-end gap-0.5 h-20">
          {sparkDates.map(d => {
            const h = Math.max(4, Math.round((dateSpend[d] / maxSpend) * 76))
            return (
              <div key={d} className="flex-1 flex items-end" title={`${d}: ${fmtNGN(dateSpend[d])}`}>
                <div className="w-full rounded-sm bg-indigo-500/70 hover:bg-indigo-500 transition-colors" style={{ height: h }} />
              </div>
            )
          })}
        </div>
      </Card>

      {/* All metrics — expandable */}
      <Card className="border rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-indigo-500" />
          All Metrics
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
          {[
            ['Spend',        fmtNGN(agg.totalSpend)],
            ['Impressions',  fmtNum(agg.totalImpressions)],
            ['Reach',        fmtNum(agg.totalReach)],
            ['Clicks',       fmtNum(agg.totalClicks)],
            ['CTR',          agg.avgCtr  > 0 ? `${(agg.avgCtr * 100).toFixed(2)}%` : 'N/A'],
            ['CPM',          agg.avgCpm  > 0 ? fmtNGN(agg.avgCpm)  : 'N/A'],
            ['CPC',          agg.avgCpc  > 0 ? fmtNGN(agg.avgCpc)  : 'N/A'],
            ['CPA',          agg.avgCpa  > 0 ? fmtNGN(agg.avgCpa)  : 'N/A'],
            ['ROAS',         agg.avgRoas > 0 ? `${agg.avgRoas.toFixed(1)}x` : 'N/A'],
            ['Frequency',    agg.avgFreq > 0 ? agg.avgFreq.toFixed(1) : 'N/A'],
            ['CVR',          agg.cvr     > 0 ? `${agg.cvr.toFixed(2)}%` : 'N/A'],
            ['Conversions',  fmtNum(agg.totalConversions)],
            ...(agg.totalLeads    > 0 ? [['Leads',     fmtNum(agg.totalLeads)],    ['CPL', fmtNGN(agg.cpl)]]    : []),
            ...(agg.totalInstalls > 0 ? [['Installs',  fmtNum(agg.totalInstalls)], ['CPI', fmtNGN(agg.cpi)]]    : []),
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{label}</span>
              <span className="text-xs font-semibold tabular-nums">{value}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Performance targets */}
      <Card className="border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold">Performance Targets</h2>
          </div>
          <AddTargetForm
            campaignId={campaignId}
            campaignName={campaignName}
            platform={platform}
            objective={objective}
            onAdded={t => setTargets(prev => [...prev.filter(x => x.id !== t.id), t])}
          />
        </div>

        {targets.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No targets set yet. Add a target to track how this campaign performs against your goals.
          </p>
        ) : (
          <div className="space-y-4">
            {targets.map(t => {
              const { raw } = getMetricDisplay(t.metric, agg)
              return (
                <div key={t.id} className="space-y-2">
                  <GoalBar target={t} actual={raw} />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground capitalize">{t.period} target</span>
                    <button
                      onClick={() => removeTarget(t.id, t.metric)}
                      className="text-[10px] text-muted-foreground hover:text-rose-500 flex items-center gap-1 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" /> Remove
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between text-xs text-muted-foreground pb-8">
        <span>Campaign ID: {campaignId}</span>
        <Link href="/dashboard/digital" className="flex items-center gap-1 hover:text-foreground transition-colors">
          <ChevronDown className="h-3 w-3 rotate-90" /> Back to all campaigns
        </Link>
      </div>
    </div>
  )
}
