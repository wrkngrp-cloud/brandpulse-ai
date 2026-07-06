'use client'

import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Loader2, TrendingUp, TrendingDown, Zap, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { TourTrigger } from '@/components/tours/tour-trigger'

interface MmmRun {
  id: string
  window_days: number
  channel_contributions: Record<string, number>
  channel_spend: Record<string, number>
  channel_roi: Record<string, number>
  total_estimated_outcomes: number
  ai_summary: string
  recommendations: { channel: string; action: string; rationale: string }[]
  increase: { channel: string; rationale: string } | null
  reduce: { channel: string; rationale: string } | null
  ran_at: string
}

const CHANNEL_COLORS: Record<string, string> = {
  events:  '#22c55e',
  email:   '#6366f1',
  digital: '#3b82f6',
  social:  '#f59e0b',
  radio:   '#ec4899',
  tv:      '#8b5cf6',
  ooh:     '#14b8a6',
  print:   '#f97316',
}

const CHANNEL_LABELS: Record<string, string> = {
  events:  'Events',
  email:   'Email',
  digital: 'Digital',
  social:  'Social',
  radio:   'Radio',
  tv:      'TV',
  ooh:     'OOH',
  print:   'Print',
}

const DAYS_OPTIONS = [
  { value: 30,  label: '30 days'  },
  { value: 60,  label: '60 days'  },
  { value: 90,  label: '90 days'  },
  { value: 180, label: '6 months' },
]

function fmtNGN(n: number) {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `₦${(n / 1_000).toFixed(0)}K`
  return `₦${n}`
}

interface Props {
  brandName: string
  lastRun:   MmmRun | null
}

export function MmmClient({ brandName, lastRun }: Props) {
  const [days, setDays]       = useState(90)
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<MmmRun | null>(lastRun)

  async function runAnalysis() {
    setLoading(true)
    try {
      const res = await fetch('/api/mmm/run', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ days, brandName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Analysis failed')
      setResult({ ...data, window_days: days, ran_at: new Date().toISOString() })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  const contributions = result?.channel_contributions ?? {}
  const spend         = result?.channel_spend ?? {}
  const roi           = result?.channel_roi ?? {}

  const chartData = Object.entries(contributions)
    .filter(([, pct]) => pct > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([ch, pct]) => ({
      name:  CHANNEL_LABELS[ch] ?? ch,
      value: pct,
      color: CHANNEL_COLORS[ch] ?? '#94a3b8',
      ch,
    }))

  const totalSpend = Object.values(spend).reduce((s, v) => s + v, 0)

  return (
    <div className="space-y-6 max-w-[1200px]">

      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-1.5">Attribution</p>
          <h1 className="h-display text-[28px] sm:text-[32px] leading-none">Media Mix</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground/60">
            Activity-weighted channel attribution — estimated contribution based on media activity levels
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <TourTrigger module="mmm" autoStart />
          <div className="flex rounded-xl border border-border overflow-hidden">
            {DAYS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={cn(
                  'px-3 py-1.5 text-[12px] font-medium transition-colors',
                  days === opt.value
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <Button onClick={runAnalysis} disabled={loading} size="sm">
            {loading
              ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Analysing...</>
              : <><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Run analysis</>}
          </Button>
        </div>
      </div>

      <div data-tour="mmm-main">
      {result === null ? (
        <div className="rounded-2xl border bg-card p-12 flex flex-col items-center gap-4 text-center">
          <div className="h-14 w-14 rounded-full bg-muted/40 flex items-center justify-center">
            <Zap className="h-6 w-6 text-muted-foreground/25" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">No analysis yet</p>
            <p className="text-[13px] text-muted-foreground max-w-sm">
              Select a window and run the analysis to see how each channel contributes to your brand outcomes.
            </p>
          </div>
          <Button onClick={runAnalysis} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Run media mix analysis
          </Button>
        </div>
      ) : (
        <div className="space-y-4">

          {/* Summary bar */}
          <div className="rounded-2xl border bg-card p-5">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                <Zap className="h-4 w-4 text-blue-500" />
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-medium mb-1">AI Summary</p>
                <p className="text-[13px] text-muted-foreground leading-relaxed">{result.ai_summary}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[11px] text-muted-foreground">{result.window_days}d window</p>
                <p className="text-[11px] text-muted-foreground">{new Date(result.ran_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' })}</p>
              </div>
            </div>
          </div>

          {/* Chart + table */}
          {chartData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Pie chart */}
              <div className="rounded-2xl border bg-card p-5">
                <p className="text-[13px] font-medium mb-4 eyebrow">Channel contribution</p>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={110}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => [`${v}%`, 'Contribution']}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Legend
                      formatter={(value) => <span style={{ fontSize: 12, color: '#888' }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Channel table */}
              <div className="rounded-2xl border bg-card p-5">
                <p className="text-[13px] font-medium mb-4 eyebrow">By channel</p>
                <div className="space-y-2">
                  {chartData.map(ch => (
                    <div key={ch.ch} className="flex items-center gap-3">
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: ch.color }} />
                      <span className="text-[13px] flex-1">{ch.name}</span>
                      <span className="text-[13px] font-semibold tabular-nums w-12 text-right">{ch.value}%</span>
                      {spend[ch.ch] > 0 && (
                        <span className="text-[11px] text-muted-foreground w-16 text-right">{fmtNGN(spend[ch.ch])}</span>
                      )}
                      {roi[ch.ch] !== undefined && (
                        <span className={cn(
                          'text-[11px] font-medium w-14 text-right',
                          roi[ch.ch] > 0 ? 'text-green-500' : 'text-red-500'
                        )}>
                          {roi[ch.ch] > 0 ? '+' : ''}{roi[ch.ch]}x
                        </span>
                      )}
                    </div>
                  ))}
                  {totalSpend > 0 && (
                    <div className="pt-2 border-t border-border/40 flex justify-between">
                      <span className="text-[12px] text-muted-foreground">Total tracked spend</span>
                      <span className="text-[12px] font-semibold">{fmtNGN(totalSpend)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Increase / Reduce */}
          {(result.increase || result.reduce) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {result.increase && (
                <div className="rounded-2xl border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-900 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <p className="text-[13px] font-semibold text-green-700 dark:text-green-400">Increase investment</p>
                  </div>
                  <p className="text-[13px] font-medium capitalize mb-1">{result.increase.channel}</p>
                  <p className="text-[12.5px] text-muted-foreground leading-relaxed">{result.increase.rationale}</p>
                </div>
              )}
              {result.reduce && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="h-4 w-4 text-amber-600" />
                    <p className="text-[13px] font-semibold text-amber-700 dark:text-amber-400">Optimise or reduce</p>
                  </div>
                  <p className="text-[13px] font-medium capitalize mb-1">{result.reduce.channel}</p>
                  <p className="text-[12.5px] text-muted-foreground leading-relaxed">{result.reduce.rationale}</p>
                </div>
              )}
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations?.length > 0 && (
            <div className="rounded-2xl border bg-card p-5 space-y-3">
              <p className="text-[13px] font-medium eyebrow">Recommendations</p>
              {result.recommendations.map((r, i) => (
                <div key={i} className="flex gap-3 py-3 border-b border-border/40 last:border-0">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground/60 w-14 shrink-0 pt-0.5 capitalize">{r.channel}</span>
                  <div>
                    <p className="text-[13px] font-medium">{r.action}</p>
                    <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{r.rationale}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}
      </div>
    </div>
  )
}
