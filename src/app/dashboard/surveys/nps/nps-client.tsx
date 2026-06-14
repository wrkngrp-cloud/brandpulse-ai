'use client'

import { useState, useTransition } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { Sparkles, Loader2, Users, TrendingUp, TrendingDown, Minus } from 'lucide-react'
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
}

interface DiagnosisResult {
  detractorDiagnosis: string
  promoterArchetype:  string
  recommendations:    string[]
  npsContext:         string
}

const CUSTOM_TOOLTIP = ({ active, payload, label }: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) => {
  if (!active || !payload?.length) return null
  const val = payload[0].value
  return (
    <div className="bg-card border rounded-lg shadow-md px-3 py-2 text-sm">
      <p className="font-medium">{label}</p>
      <p className={cn('font-bold', val >= 0 ? 'text-green-600' : 'text-red-500')}>
        NPS {val >= 0 ? '+' : ''}{val}
      </p>
    </div>
  )
}

export function NpsClient({
  weeklyData, currentNps, totalPromoters, totalPassives, totalDetractors,
  totalResponses, trendDirection, brandName, industry, detractorTexts, promoterTexts,
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
    trendDirection === 'rising'  ? 'text-green-600'  :
    trendDirection === 'falling' ? 'text-red-500'     :
    'text-muted-foreground'

  const npsColor =
    currentNps == null ? 'text-muted-foreground'  :
    currentNps >= 50   ? 'text-green-600'          :
    currentNps >= 30   ? 'text-foreground'         :
    currentNps >= 0    ? 'text-amber-500'          :
    'text-red-500'

  const chartData = weeklyData.filter(w => w.nps != null)

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* NPS score */}
        <div className="border rounded-xl p-4 bg-card col-span-2 sm:col-span-1">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">NPS Score</p>
          {currentNps != null ? (
            <div className="flex items-end gap-2 mt-1">
              <p className={cn('text-4xl font-bold tabular-nums', npsColor)}>
                {currentNps >= 0 ? '+' : ''}{currentNps}
              </p>
              <div className={cn('flex items-center gap-0.5 mb-1', trendColor)}>
                <TrendIcon className="h-4 w-4" />
              </div>
            </div>
          ) : (
            <p className="text-2xl font-bold text-muted-foreground/50 mt-1">—</p>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">{totalResponses} total responses</p>
        </div>

        {/* Promoters */}
        <div className="border rounded-xl p-4 bg-card">
          <p className="text-xs text-muted-foreground font-medium">Promoters</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {totalResponses > 0 ? Math.round(totalPromoters / totalResponses * 100) : 0}%
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{totalPromoters} people · score 9–10</p>
        </div>

        {/* Passives */}
        <div className="border rounded-xl p-4 bg-card">
          <p className="text-xs text-muted-foreground font-medium">Passives</p>
          <p className="text-2xl font-bold text-muted-foreground mt-1">
            {totalResponses > 0 ? Math.round(totalPassives / totalResponses * 100) : 0}%
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{totalPassives} people · score 7–8</p>
        </div>

        {/* Detractors */}
        <div className="border rounded-xl p-4 bg-card">
          <p className="text-xs text-muted-foreground font-medium">Detractors</p>
          <p className="text-2xl font-bold text-red-500 mt-1">
            {totalResponses > 0 ? Math.round(totalDetractors / totalResponses * 100) : 0}%
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{totalDetractors} people · score 0–6</p>
        </div>
      </div>

      {/* 12-week trend chart */}
      <div className="border rounded-xl bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold">12-week NPS trend</p>
          {hasEnoughData && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleDiagnose}
              disabled={isPending || currentNps == null}
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
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="weekLabel"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                className="fill-muted-foreground"
              />
              <YAxis
                domain={[-100, 100]}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                className="fill-muted-foreground"
              />
              <Tooltip content={<CUSTOM_TOOLTIP />} />
              <ReferenceLine y={0} stroke="currentColor" className="stroke-border" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="nps"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                className="stroke-foreground"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center">
            <div className="text-center space-y-1">
              <Users className="h-6 w-6 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">
                {totalResponses === 0
                  ? 'No responses yet — publish a survey with an NPS question to start tracking.'
                  : `${totalResponses} response${totalResponses !== 1 ? 's' : ''} collected — trend appears once data spans 2+ weeks.`}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Score guide */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-600 inline-block" />50+ Excellent</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-foreground inline-block" />30–49 Good</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />0–29 Needs work</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500 inline-block" />Below 0 Critical</span>
        <span className="ml-auto">NPS = % Promoters − % Detractors</span>
      </div>

      {/* AI Diagnosis */}
      {diagnosis && (
        <div className="border rounded-xl p-5 bg-card space-y-5">
          <div className="flex items-start gap-3">
            <div className="h-7 w-7 rounded-full bg-foreground flex items-center justify-center shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-background" />
            </div>
            <div>
              <p className="text-sm font-semibold">NPS diagnosis</p>
              <p className="text-xs text-muted-foreground">{diagnosis.npsContext}</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Why people are detracting
              </p>
              <p className="text-sm leading-relaxed">{diagnosis.detractorDiagnosis}</p>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Your promoter archetype
              </p>
              <p className="text-sm leading-relaxed">{diagnosis.promoterArchetype}</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              90-day recommendations
            </p>
            <ul className="space-y-2">
              {diagnosis.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm">
                  <span className="shrink-0 h-5 w-5 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center font-semibold">
                    {i + 1}
                  </span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
