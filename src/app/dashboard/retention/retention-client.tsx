'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  AlertTriangle, TrendingDown, MessageSquare,
  RefreshCw, CheckCircle, XCircle, AlertCircle, Info,
  Users, ThumbsDown, Activity,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { RetentionRiskData, RetentionSignal } from '@/app/api/retention/risk/route'
import { TourTrigger } from '@/components/tours/tour-trigger'

const RISK_COLOR = {
  low:      'text-green-600  bg-green-50  border-green-200',
  medium:   'text-yellow-700 bg-yellow-50 border-yellow-200',
  high:     'text-orange-700 bg-orange-50 border-orange-200',
  critical: 'text-red-700   bg-red-50    border-red-200',
} as const

const RISK_LABEL = {
  low:      'Low Risk',
  medium:   'Medium Risk',
  high:     'High Risk',
  critical: 'Critical',
} as const

const SEVERITY_ICON = {
  low:      <Info className="h-4 w-4 text-blue-500" />,
  medium:   <AlertCircle className="h-4 w-4 text-yellow-500" />,
  high:     <AlertTriangle className="h-4 w-4 text-orange-500" />,
  critical: <XCircle className="h-4 w-4 text-red-500" />,
}

export function RetentionClient() {
  const [data, setData]       = useState<RetentionRiskData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/retention/risk')
      if (!res.ok) throw new Error('Failed to load retention data')
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const riskRing = data
    ? Math.round((data.risk_score / 100) * 2 * Math.PI * 36)
    : 0
  const circumference = 2 * Math.PI * 36

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Retention Risk</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Early warning signals based on sentiment, NPS, and brand health trends
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <TourTrigger module="retention" autoStart />
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      <div data-tour="retention-main">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Risk score gauge */}
            <div className={cn('rounded-xl border p-5 flex flex-col items-center justify-center gap-3', RISK_COLOR[data.overall_risk])}>
              <p className="text-[11px] font-semibold uppercase tracking-widest opacity-60">Risk Score</p>
              <div className="relative w-[88px] h-[88px]">
                <svg width="88" height="88" viewBox="0 0 88 88" className="absolute inset-0">
                  <circle cx="44" cy="44" r="36" fill="none" strokeWidth="8" className="stroke-current opacity-20" />
                  <circle
                    cx="44" cy="44" r="36" fill="none" strokeWidth="8"
                    className="stroke-current"
                    strokeDasharray={`${riskRing} ${circumference}`}
                    strokeLinecap="round"
                    transform="rotate(-90 44 44)"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[28px] font-bold leading-none">{data.risk_score}</span>
                  <span className="text-[10px] opacity-50 mt-0.5">out of 100</span>
                </div>
              </div>
              <Badge variant="outline" className={cn('text-xs font-semibold', RISK_COLOR[data.overall_risk])}>
                {RISK_LABEL[data.overall_risk]}
              </Badge>
            </div>

            {/* NPS breakdown */}
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
                <Users className="h-4 w-4" />
                NPS (last 30 days)
              </div>
              {data.nps_breakdown.total === 0 ? (
                <p className="text-sm text-muted-foreground">No NPS data yet</p>
              ) : (
                <div className="space-y-2">
                  <NpsBar label="Promoters" count={data.nps_breakdown.promoters} total={data.nps_breakdown.total} color="bg-green-500" />
                  <NpsBar label="Passives"  count={data.nps_breakdown.passives}  total={data.nps_breakdown.total} color="bg-yellow-400" />
                  <NpsBar label="Detractors" count={data.nps_breakdown.detractors} total={data.nps_breakdown.total} color="bg-red-500" />
                </div>
              )}
            </div>

            {/* Sentiment */}
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
                <Activity className="h-4 w-4" />
                Sentiment trend
              </div>
              {data.sentiment_7d_avg === null ? (
                <p className="text-sm text-muted-foreground">No sentiment data</p>
              ) : (
                <div className="space-y-3">
                  <SentimentStat label="Last 7 days" value={data.sentiment_7d_avg} />
                  <SentimentStat label="Prior period" value={data.sentiment_30d_avg} />
                  {data.sentiment_30d_avg !== null && data.sentiment_7d_avg !== null && (
                    <div className={cn(
                      'text-xs font-medium flex items-center gap-1',
                      data.sentiment_7d_avg < data.sentiment_30d_avg ? 'text-red-600' : 'text-green-600'
                    )}>
                      <TrendingDown className="h-3 w-3" />
                      {data.sentiment_7d_avg < data.sentiment_30d_avg
                        ? `−${(data.sentiment_30d_avg - data.sentiment_7d_avg).toFixed(1)} pts vs. prior`
                        : `+${(data.sentiment_7d_avg - data.sentiment_30d_avg).toFixed(1)} pts vs. prior`}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* BHI delta */}
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
                <Activity className="h-4 w-4" />
                Brand Health Index
              </div>
              {data.bhi_latest === null ? (
                <p className="text-sm text-muted-foreground">No BHI data</p>
              ) : (
                <div className="space-y-3">
                  <SentimentStat label="Current BHI" value={data.bhi_latest} />
                  <SentimentStat label="30 days ago" value={data.bhi_30d_ago} />
                  {data.bhi_30d_ago !== null && (
                    <div className={cn(
                      'text-xs font-medium flex items-center gap-1',
                      data.bhi_latest < data.bhi_30d_ago ? 'text-red-600' : 'text-green-600'
                    )}>
                      <TrendingDown className="h-3 w-3" />
                      {data.bhi_latest < data.bhi_30d_ago
                        ? `−${(data.bhi_30d_ago - data.bhi_latest).toFixed(1)} pts in 30 days`
                        : `+${(data.bhi_latest - data.bhi_30d_ago).toFixed(1)} pts in 30 days`}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Signals */}
          {data.signals.length > 0 && (
            <div className="rounded-xl border bg-card">
              <div className="px-5 py-4 border-b">
                <h2 className="font-semibold text-sm">Risk signals detected</h2>
              </div>
              <div className="divide-y">
                {data.signals.map((sig, i) => (
                  <SignalRow key={i} signal={sig} />
                ))}
              </div>
            </div>
          )}

          {data.signals.length === 0 && (
            <div className="rounded-xl border bg-green-50 border-green-200 p-6 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
              <div>
                <p className="font-medium text-green-800">No significant risk signals detected</p>
                <p className="text-sm text-green-700 mt-0.5">Sentiment, NPS, and brand health are within healthy ranges over the last 30 days.</p>
              </div>
            </div>
          )}

          {/* Detractor voices */}
          {data.detractors.length > 0 && (
            <div className="rounded-xl border bg-card">
              <div className="px-5 py-4 border-b flex items-center gap-2">
                <ThumbsDown className="h-4 w-4 text-red-500" />
                <h2 className="font-semibold text-sm">Recent detractor voices</h2>
                <Badge variant="secondary" className="ml-auto text-xs">{data.detractors.length}</Badge>
              </div>
              <div className="divide-y">
                {data.detractors.map((d) => (
                  <div key={d.id} className="px-5 py-3 flex items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">
                      {d.score}
                    </span>
                    <div className="min-w-0">
                      {d.verbatim ? (
                        <p className="text-sm text-foreground line-clamp-2">"{d.verbatim}"</p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No verbatim provided</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(d.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer note */}
          <p className="text-xs text-muted-foreground">
            Computed at {new Date(data.computed_at).toLocaleString('en-GB')} from last 30 days of sentiment, NPS, and brand health data.
            Go to <a href="/dashboard/advocacy" className="underline text-foreground">Advocacy</a> to activate promoters as a counter-measure.
          </p>
        </>
      )}
      </div>
    </div>
  )
}

function NpsBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-20 text-muted-foreground text-xs">{label}</span>
      <div className="flex-1 bg-muted rounded-full h-2">
        <div className={cn('h-2 rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium w-8 text-right">{pct}%</span>
    </div>
  )
}

function SentimentStat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value !== null ? value.toFixed(1) : '—'}</span>
    </div>
  )
}

function SignalRow({ signal }: { signal: RetentionSignal }) {
  const severityBg = {
    low:      'bg-blue-50',
    medium:   'bg-yellow-50',
    high:     'bg-orange-50',
    critical: 'bg-red-50',
  }[signal.severity]

  return (
    <div className={cn('px-5 py-3 flex items-start gap-3', severityBg)}>
      <span className="mt-0.5 shrink-0">{SEVERITY_ICON[signal.severity]}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{signal.label}</p>
          <Badge variant="outline" className="text-xs capitalize">
            {signal.severity}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{signal.detail}</p>
      </div>
      {signal.value !== undefined && (
        <div className="text-right shrink-0">
          <p className="text-sm font-bold">{signal.value.toFixed(1)}</p>
          {signal.benchmark !== undefined && (
            <p className="text-xs text-muted-foreground">vs {signal.benchmark.toFixed(1)}</p>
          )}
        </div>
      )}
    </div>
  )
}
