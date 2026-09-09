'use client'

import { useState, useTransition } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { Loader2, Users, TrendingDown, Minus } from 'lucide-react'
import { AskIcon as Sparkles, TrendIcon as TrendingUp } from '@/components/brand/icon'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export interface WeeklyNps {
  weekLabel:   string   // "Jun 1"
  nps:         number | null
  promoters:   number
  passives:    number
  detractors:  number
  total:       number
}

export interface NpsCohort {
  role:       string
  label:      string
  total:      number
  nps:        number | null
  promoters:  number
  detractors: number
}

interface Props {
  weeklyData:       WeeklyNps[]
  currentNps:       number | null
  totalPromoters:   number
  totalPassives:    number
  totalDetractors:  number
  totalResponses:   number
  trendDirection:   'rising' | 'falling' | 'stable' | 'insufficient_data'
  brandName:        string
  industry:         string | null
  detractorTexts:   string[]
  promoterTexts:    string[]
  benchmarkP50?:    number | null
  cohorts?:         NpsCohort[]
}

interface DiagnosisResult {
  detractorDiagnosis: string
  promoterArchetype:  string
  recommendations:    string[]
  npsContext:         string
}

const CUSTOM_TOOLTIP = ({ active, payload, label }: {
  active?: boolean
  payload?: { value: number; name: string; color: string }[]
  label?: string
}) => {
  if (!active || !payload?.length) return null
  const val = payload[0].value
  const isPositive = val >= 0
  return (
    <div className="bg-[var(--bg-ink)] border border-line-inv rounded-xl px-3.5 py-2.5 min-w-[148px]">
      <p className="text-[10.5px] font-semibold text-tx-inv/40 mb-2">{label}</p>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5">
          <span className="h-[3px] w-3 rounded-sm shrink-0" style={{ background: isPositive ? 'var(--pos)' : 'var(--flare)' }} />
          <span className="text-[11.5px] text-tx-inv/55">NPS Score</span>
        </div>
        <span className={cn('text-[13px] font-semibold bg-num', isPositive ? 'text-pos' : 'text-tx-flare')}>
          {isPositive ? '+' : ''}{Math.round(val)}
        </span>
      </div>
    </div>
  )
}

export function NpsClient({
  weeklyData, currentNps, totalPromoters, totalPassives, totalDetractors,
  totalResponses, trendDirection, brandName, industry, detractorTexts, promoterTexts, benchmarkP50,
  cohorts = [],
}: Props) {
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null)
  const [isPending, startTransition] = useTransition()

  const hasEnoughData = totalResponses >= 5

  function handleDiagnose() {
    if (currentNps == null) return
    startTransition(async () => {
      const res = await fetch('/api/surveys/nps-diagnosis', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          npsScore:       currentNps,
          promoterCount:  totalPromoters,
          passiveCount:   totalPassives,
          detractorCount: totalDetractors,
          totalResponses,
          trendDirection,
          brandName,
          industry,
          detractorTexts,
          promoterTexts,
        }),
      })
      const data = await res.json() as DiagnosisResult | { error: string }
      if ('error' in data) { toast.error(data.error); return }
      setDiagnosis(data)
    })
  }

  const TrendIcon =
    trendDirection === 'rising'  ? TrendingUp  :
    trendDirection === 'falling' ? TrendingDown :
    Minus

  const trendColor =
    trendDirection === 'rising'  ? 'text-pos'  :
    trendDirection === 'falling' ? 'text-tx-flare'     :
    'text-muted-foreground'

  const npsColor =
    currentNps == null ? 'text-muted-foreground'  :
    currentNps >= 50   ? 'text-pos'          :
    currentNps >= 30   ? 'text-foreground'         :
    currentNps >= 0    ? 'text-tx-2'          :
    'text-tx-flare'

  const chartData = weeklyData.filter(w => w.nps != null)

  return (
    <div className="space-y-6" data-tour="nps-main">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* NPS score */}
        <div className="border rounded-2xl p-5 bg-card card-shadow col-span-2 sm:col-span-1">
          <p className="eyebrow mb-2">NPS Score</p>
          {currentNps != null ? (
            <div className="flex items-end gap-2 mt-1">
              <p className={cn('metric text-[38px]', npsColor)}>
                {currentNps >= 0 ? '+' : ''}{currentNps}
              </p>
              <div className={cn('flex items-center gap-0.5 mb-1.5', trendColor)}>
                <TrendIcon className="h-4 w-4" />
              </div>
            </div>
          ) : (
            <p className="metric text-[38px] text-muted-foreground/40 mt-1">—</p>
          )}
          <p className="text-xs text-muted-foreground mt-1"><span className="bg-num">{totalResponses}</span> total responses</p>
        </div>

        {/* Promoters */}
        <div className="border rounded-2xl p-5 bg-card card-shadow">
          <p className="eyebrow mb-2">Promoters</p>
          <p className="metric text-[28px] text-pos mt-1">
            {totalResponses > 0 ? Math.round(totalPromoters / totalResponses * 100) : 0}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">{totalPromoters} people · 9–10</p>
        </div>

        {/* Passives */}
        <div className="border rounded-2xl p-5 bg-card card-shadow">
          <p className="eyebrow mb-2">Passives</p>
          <p className="metric text-[28px] text-muted-foreground mt-1">
            {totalResponses > 0 ? Math.round(totalPassives / totalResponses * 100) : 0}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">{totalPassives} people · 7–8</p>
        </div>

        {/* Detractors */}
        <div className="border rounded-2xl p-5 bg-card card-shadow">
          <p className="eyebrow mb-2">Detractors</p>
          <p className="metric text-[28px] text-tx-flare mt-1">
            {totalResponses > 0 ? Math.round(totalDetractors / totalResponses * 100) : 0}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">{totalDetractors} people · 0–6</p>
        </div>
      </div>

      {/* 12-week trend chart */}
      <div className="border rounded-2xl bg-card card-shadow p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="eyebrow mb-1">12-Week Pulse</p>
            <h3 className="text-[15px] font-semibold tracking-tight">NPS Trend</h3>
          </div>
          {hasEnoughData && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleDiagnose}
              disabled={isPending || currentNps == null}
              className="rounded-xl"
            >
              {isPending ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Analysing…</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5 mr-1.5" />Diagnose with AI</>
              )}
            </Button>
          )}
        </div>

        {chartData.length >= 2 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <defs>
                {/* Positive zone — green above 0 */}
                <linearGradient id="npsGradPos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="var(--pos)" stopOpacity={0.30} />
                  <stop offset="50%"  stopColor="var(--pos)" stopOpacity={0.10} />
                  <stop offset="100%" stopColor="var(--pos)" stopOpacity={0}    />
                </linearGradient>
                {/* Negative zone — red */}
                <linearGradient id="npsGradNeg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="var(--flare)" stopOpacity={0}    />
                  <stop offset="100%" stopColor="var(--flare)" stopOpacity={0.22} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="0"
                horizontal
                vertical={false}
                stroke="currentColor"
                className="text-border opacity-35"
              />

              <XAxis
                dataKey="weekLabel"
                tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.4, fontFamily: 'var(--font)' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[-100, 100]}
                tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.4, fontFamily: 'var(--font)' }}
                tickLine={false}
                axisLine={false}
                tickCount={5}
              />

              <Tooltip
                content={<CUSTOM_TOOLTIP />}
                cursor={{ stroke: 'currentColor', strokeOpacity: 0.12, strokeWidth: 1 }}
              />

              <ReferenceLine
                y={0}
                stroke="currentColor"
                strokeDasharray="4 4"
                strokeOpacity={0.25}
              />
              <ReferenceLine
                y={50}
                stroke="var(--pos)"
                strokeDasharray="4 4"
                strokeOpacity={0.20}
                label={{ value: 'Excellent', position: 'insideTopRight', fontSize: 9, fill: 'var(--pos)', opacity: 0.5 }}
              />

              {benchmarkP50 != null && (
                <ReferenceLine
                  y={benchmarkP50}
                  stroke="var(--ember)"
                  strokeDasharray="6 3"
                  strokeWidth={1.5}
                  strokeOpacity={0.7}
                  label={{ value: `Sector P50 (${Math.round(benchmarkP50)})`, position: 'insideTopRight', fontSize: 9, fill: 'var(--ember)', opacity: 0.85 }}
                />
              )}

              <Area
                type="monotone"
                dataKey="nps"
                name="NPS"
                stroke="var(--flare)"
                strokeWidth={2.5}
                fill="url(#npsGradPos)"
                dot={false}
                activeDot={{ r: 4.5, fill: 'var(--flare)', strokeWidth: 2, stroke: 'var(--bg-card)' }}
                connectNulls={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center">
            <div className="text-center space-y-2">
              <Users className="h-7 w-7 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground max-w-[280px]">
                {totalResponses === 0
                  ? 'No responses yet — publish a survey with an NPS question to start tracking.'
                  : `${totalResponses} response${totalResponses !== 1 ? 's' : ''} collected — trend appears once data spans 2+ weeks.`}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Score guide */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-muted-foreground px-1">
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-sm bg-pos inline-block" />50+ Excellent</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-sm bg-flare inline-block" />30–49 Good</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-sm bg-ember inline-block" />0–29 Needs work</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-sm bg-flare inline-block" />Below 0 Critical</span>
        <span className="ml-auto opacity-50">NPS = % Promoters − % Detractors</span>
      </div>

      {/* NPS by cohort (respondent_role) */}
      {cohorts.length >= 2 && (
        <div className="border rounded-2xl bg-card card-shadow p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-[13px] font-semibold tracking-tight">NPS by cohort</p>
              <p className="text-xs text-muted-foreground mt-0.5">Split by who responded</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {cohorts.map(c => {
              const color =
                c.nps == null  ? 'text-muted-foreground/40' :
                c.nps >= 50    ? 'text-pos'  :
                c.nps >= 30    ? 'text-foreground'  :
                c.nps >= 0     ? 'text-tx-2'   :
                'text-tx-flare'
              return (
                <div key={c.role} className="border rounded-xl p-4">
                  <p className="eyebrow mb-1.5">{c.label}</p>
                  <p className={cn('metric text-[26px]', color)}>
                    {c.nps != null ? `${c.nps >= 0 ? '+' : ''}${c.nps}` : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 bg-num">
                    {c.total} response{c.total === 1 ? '' : 's'}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* AI Diagnosis */}
      {diagnosis && (
        <div className="border rounded-2xl p-5 bg-card card-shadow space-y-5">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--char)' }}>
              <Sparkles className="h-4 w-4 text-tx-inv" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">NPS diagnosis</p>
              <p className="text-xs text-muted-foreground mt-0.5">{diagnosis.npsContext}</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2 rounded-xl border bg-muted/30 p-4">
              <p className="eyebrow">Why people are detracting</p>
              <p className="text-sm leading-relaxed">{diagnosis.detractorDiagnosis}</p>
            </div>
            <div className="space-y-2 rounded-xl border bg-muted/30 p-4">
              <p className="eyebrow">Your promoter archetype</p>
              <p className="text-sm leading-relaxed">{diagnosis.promoterArchetype}</p>
            </div>
          </div>

          <div className="space-y-2.5">
            <p className="eyebrow">90-day recommendations</p>
            <ul className="space-y-2">
              {diagnosis.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="shrink-0 h-5 w-5 rounded-full text-[11px] flex items-center justify-center font-semibold text-tx-inv mt-0.5"
                    style={{ background: 'var(--char)' }}>
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

    </div>
  )
}
