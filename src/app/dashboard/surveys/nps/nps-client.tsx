'use client'

import { useState, useTransition } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { Sparkles, Loader2, Users, TrendingUp, TrendingDown, Minus, MessageCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
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
  benchmarkP50?:    number | null
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
    <div className="bg-[#14182B] border border-white/10 rounded-xl shadow-2xl px-3.5 py-2.5 min-w-[148px]">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.10em] text-white/40 mb-2">{label}</p>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5">
          <span className="h-[3px] w-3 rounded-full shrink-0" style={{ background: isPositive ? '#22c55e' : '#f87171' }} />
          <span className="text-[11.5px] text-white/55">NPS Score</span>
        </div>
        <span className={cn('text-[13px] font-semibold tabular-nums', isPositive ? 'text-green-400' : 'text-red-400')}>
          {isPositive ? '+' : ''}{Math.round(val)}
        </span>
      </div>
    </div>
  )
}

function NpsWhatsAppSender() {
  const [phones, setPhones] = useState('')
  const [pending, startT]   = useTransition()
  const [sent, setSent]     = useState<{ sent: number; failed: number } | null>(null)

  function send() {
    const list = phones.split(/[\n,;]+/).map(p => p.trim()).filter(Boolean)
    if (!list.length) { toast.error('Enter at least one phone number'); return }
    startT(async () => {
      const res  = await fetch('/api/whatsapp/nps', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phones: list }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return }
      setSent(data)
      setPhones('')
      toast.success(`NPS sent to ${data.sent} contact${data.sent === 1 ? '' : 's'}`)
    })
  }

  return (
    <div className="rounded-2xl border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-green-500" />
        <p className="text-[13px] font-semibold">Send NPS via WhatsApp</p>
      </div>
      <p className="text-[12.5px] text-muted-foreground">
        Sends a 0-10 NPS question via WhatsApp. Replies are captured automatically and appear in your NPS score.
        Requires the Africa's Talking WhatsApp API (set AFRICAS_TALKING_API_KEY in environment variables).
      </p>
      {sent && (
        <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 p-3">
          <p className="text-[12.5px] text-green-700 dark:text-green-400">
            Sent to {sent.sent} · Failed: {sent.failed}
          </p>
        </div>
      )}
      <Textarea
        value={phones}
        onChange={e => setPhones(e.target.value)}
        placeholder={`+2348012345678\n+2348087654321`}
        className="min-h-[80px] text-[13px] font-mono"
      />
      <p className="text-[11.5px] text-muted-foreground">One number per line, with country code. e.g. +234...</p>
      <Button size="sm" onClick={send} disabled={pending || !phones.trim()}>
        {pending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
        Send NPS
      </Button>
    </div>
  )
}

export function NpsClient({
  weeklyData, currentNps, totalPromoters, totalPassives, totalDetractors,
  totalResponses, trendDirection, brandName, industry, detractorTexts, promoterTexts, benchmarkP50,
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
          <p className="text-xs text-muted-foreground mt-1">{totalResponses} total responses</p>
        </div>

        {/* Promoters */}
        <div className="border rounded-2xl p-5 bg-card card-shadow">
          <p className="eyebrow mb-2">Promoters</p>
          <p className="metric text-[28px] text-green-500 mt-1">
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
          <p className="metric text-[28px] text-red-500 mt-1">
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
                  <stop offset="0%"   stopColor="#22c55e" stopOpacity={0.30} />
                  <stop offset="50%"  stopColor="#22c55e" stopOpacity={0.10} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0}    />
                </linearGradient>
                {/* Negative zone — red */}
                <linearGradient id="npsGradNeg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#f87171" stopOpacity={0}    />
                  <stop offset="100%" stopColor="#f87171" stopOpacity={0.22} />
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
                tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.4, fontFamily: 'var(--font-sans)' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[-100, 100]}
                tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.4, fontFamily: 'var(--font-sans)' }}
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
                stroke="#22c55e"
                strokeDasharray="4 4"
                strokeOpacity={0.20}
                label={{ value: 'Excellent', position: 'insideTopRight', fontSize: 9, fill: '#22c55e', opacity: 0.5 }}
              />

              {benchmarkP50 != null && (
                <ReferenceLine
                  y={benchmarkP50}
                  stroke="#f59e0b"
                  strokeDasharray="6 3"
                  strokeWidth={1.5}
                  strokeOpacity={0.7}
                  label={{ value: `Sector P50 (${Math.round(benchmarkP50)})`, position: 'insideTopRight', fontSize: 9, fill: '#f59e0b', opacity: 0.85 }}
                />
              )}

              <Area
                type="monotone"
                dataKey="nps"
                name="NPS"
                stroke="#2B59FF"
                strokeWidth={2.5}
                fill="url(#npsGradPos)"
                dot={false}
                activeDot={{ r: 4.5, fill: '#2B59FF', strokeWidth: 2, stroke: '#fff' }}
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
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-full bg-green-500 inline-block" />50+ Excellent</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-full bg-blue-500 inline-block" />30–49 Good</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-full bg-amber-500 inline-block" />0–29 Needs work</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-full bg-red-500 inline-block" />Below 0 Critical</span>
        <span className="ml-auto opacity-50">NPS = % Promoters − % Detractors</span>
      </div>

      {/* AI Diagnosis */}
      {diagnosis && (
        <div className="border rounded-2xl p-5 bg-card card-shadow space-y-5">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #E8763E 0%, #D4602A 100%)', boxShadow: '0 4px 12px -4px rgba(212,96,42,0.5)' }}>
              <Sparkles className="h-4 w-4 text-white" />
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
                  <span className="shrink-0 h-5 w-5 rounded-full text-[11px] flex items-center justify-center font-semibold text-white mt-0.5"
                    style={{ background: 'linear-gradient(135deg, #E8763E 0%, #D4602A 100%)' }}>
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ── NPS via WhatsApp ──────────────────────────────────────────────── */}
      <NpsWhatsAppSender />
    </div>
  )
}
