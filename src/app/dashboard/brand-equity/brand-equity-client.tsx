'use client'

import { useState } from 'react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip as RechartTooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine,
} from 'recharts'
import { Info, Link as LinkIcon } from 'lucide-react'
import Link from 'next/link'
import { BHIGauge } from '@/components/dashboard/bhi-gauge'
import { cn } from '@/lib/utils'
import { computeFullBHI, ZONE_META, type FullBHIComponents, type FullBHIResult, type BHIZone } from '@/lib/bhi'
import { rangeLabelShort, rangeLabelLong } from '@/lib/range-label'

interface PerceptionDimension {
  dimension: string
  score:     number | null  // 1-5 raw, or null
}

interface Props {
  bhi:                  FullBHIResult
  sparkline:            { date: string; score: number }[]
  sovPct:               number | null
  currentNps:           number | null
  npsTotal:             number
  emvRaw:               number   // in NGN
  perceptionDimensions: PerceptionDimension[]
  brandName:            string
  industry:             string | null
  days?:                number
}

const COMPONENT_META: {
  key: keyof FullBHIComponents
  label: string
  weight: number
  source: string
  phase?: string
}[] = [
  { key: 'awareness',         label: 'Brand Awareness',     weight: 20, source: 'Share of Voice'          },
  { key: 'salience',          label: 'Brand Salience',      weight: 15, source: 'Awareness surveys'        },
  { key: 'sentiment',         label: 'Brand Sentiment',     weight: 20, source: 'Sentiment score (14d avg)' },
  { key: 'perception',        label: 'Brand Perception',    weight: 15, source: 'Perception Audit surveys'  },
  { key: 'culturalResonance', label: 'Cultural Resonance',  weight: 15, source: 'Cultural survey',  phase: 'Phase 3' },
  { key: 'blendedSov',        label: 'Blended SOV',         weight: 10, source: 'Social SOV'                },
  { key: 'emv',               label: 'EMV Score',           weight:  5, source: 'Social posts (14d)'        },
]

const ZONE_GUIDE: { zone: BHIZone; range: string; description: string }[] = [
  { zone: 'at_risk',  range: '0–39',   description: 'Brand is under pressure. Sentiment is low, visibility is weak, or both. Needs urgent attention.' },
  { zone: 'building', range: '40–64',  description: 'Growing but not yet stable. Positive signals are present — sustain the momentum with consistency.' },
  { zone: 'healthy',  range: '65–79',  description: 'Strong brand position with good sentiment and awareness. Focus on competitive differentiation.' },
  { zone: 'leading',  range: '80–100', description: 'Market-leading brand strength. Defend by innovating and maintaining emotional resonance.' },
]

const ESOV_POSTURE = (esov: number) =>
  esov > 5    ? { label: 'Growth Mode',      color: 'text-green-600',  bg: 'bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-900'  } :
  esov > 0    ? { label: 'Mild Growth',      color: 'text-green-600',  bg: 'bg-green-50 border-green-100 dark:bg-green-950/30 dark:border-green-900'  } :
  esov === 0  ? { label: 'Parity',           color: 'text-muted-foreground', bg: 'bg-muted border-border' } :
  esov > -5   ? { label: 'Decline Risk',     color: 'text-amber-500',  bg: 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900' } :
                { label: 'Critical Decline', color: 'text-red-500',    bg: 'bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-900'         }

function formatNGN(n: number): string {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `₦${(n / 1_000).toFixed(0)}K`
  return `₦${n}`
}

export function BrandEquityClient({
  bhi, sparkline, sovPct, currentNps, npsTotal, emvRaw, perceptionDimensions, brandName, days = 30,
}: Props) {
  const [marketShare, setMarketShare] = useState<number>(5)
  const [targetEsov,  setTargetEsov]  = useState<number>(10)
  const rlShort = rangeLabelShort(days)
  const rlLong  = rangeLabelLong(days)

  const esov = sovPct != null ? Number((sovPct - marketShare).toFixed(1)) : null
  const posture = esov != null ? ESOV_POSTURE(esov) : null

  // Budget-to-ESOV simulator
  // To gain X% more SOV, approximately need to proportionally increase your share of category spend
  // Simplified: additional_spend ≈ current_impressions_cost × (targetSov / currentSov - 1)
  // We proxy from EMV as a rough spend baseline
  const currentSov = sovPct ?? 0
  const targetSov  = marketShare + targetEsov  // SOV needed to hit target ESOV
  const spendMultiple = currentSov > 0 ? Math.max(0, (targetSov / currentSov) - 1) : null
  const estimatedAdditionalSpend = spendMultiple != null && emvRaw > 0
    ? Math.round(emvRaw * spendMultiple)
    : null

  const radarData = perceptionDimensions.map(d => ({
    dimension: d.dimension.length > 12 ? d.dimension.slice(0, 10) + '…' : d.dimension,
    fullLabel: d.dimension,
    score:     d.score != null ? Number((d.score * 20).toFixed(1)) : 0,  // 1-5 → 0-100
    rawScore:  d.score,
  }))

  const hasPerceptionData = perceptionDimensions.some(d => d.score != null)

  // Convert full BHI gauge to use existing BHIGauge via 3-component fallback shape
  const gaugeProps = {
    score:    bhi.score,
    coverage: bhi.coverage,
    zone:     bhi.zone,
    components: {
      sentiment: bhi.components.sentiment,
      sov:       bhi.components.blendedSov,
      survey:    bhi.components.salience,
    },
  }

  return (
    <div className="space-y-6">
      {/* BHI + Components */}
      <div className="border rounded-xl p-5 bg-card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-semibold">Brand Health Index</p>
            <p className="text-xs text-muted-foreground">7 components · {bhi.coverage}% data coverage</p>
          </div>
          {bhi.coverage < 70 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-500">
              <Info className="h-3.5 w-3.5 shrink-0" />
              <span>Low coverage — run more surveys to improve accuracy</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Gauge */}
          <div className="sm:col-span-1">
            <BHIGauge bhi={gaugeProps} sparkline={sparkline} trendLabel={rlLong} />
          </div>

          {/* Component breakdown */}
          <div className="sm:col-span-2 space-y-2">
            {COMPONENT_META.map(meta => {
              const score = bhi.components[meta.key]
              const available = score != null
              const zone = bhi.zone ? ZONE_META[bhi.zone] : null

              return (
                <div key={meta.key} className="flex items-center gap-3">
                  <div className="w-24 shrink-0">
                    <p className="text-xs font-medium truncate">{meta.label}</p>
                    <p className="text-[10px] text-muted-foreground/60">{meta.weight}% weight</p>
                  </div>
                  <div className="flex-1">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: available ? `${score}%` : '0%',
                          backgroundColor: available ? (zone?.color ?? '#94a3b8') : undefined,
                          opacity: available ? 1 : 0,
                        }}
                      />
                    </div>
                  </div>
                  <div className="w-12 text-right shrink-0">
                    {available ? (
                      <span className="text-sm font-semibold tabular-nums">{Math.round(score as number)}</span>
                    ) : meta.phase ? (
                      <span className="text-[10px] text-muted-foreground/40 bg-muted rounded px-1">{meta.phase}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </div>
                  <div className="w-24 shrink-0 hidden sm:block">
                    <p className="text-[10px] text-muted-foreground/60 truncate">{meta.source}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Zone Guide */}
      <div className="border rounded-xl p-5 bg-card space-y-3">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold">Brand Health Zones</p>
          <Info className="h-3.5 w-3.5 text-muted-foreground/40" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ZONE_GUIDE.map(({ zone, range, description }) => {
            const meta = ZONE_META[zone]
            return (
              <div
                key={zone}
                className={cn(
                  'rounded-lg border p-3 space-y-1',
                  bhi.zone === zone ? 'ring-1' : 'opacity-75',
                )}
                style={{
                  borderColor: `${meta.color}30`,
                  backgroundColor: `${meta.color}08`,
                  ...(bhi.zone === zone ? { ringColor: meta.color } : {}),
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
                    <span className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground/50 tabular-nums">{range}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{description}</p>
                {bhi.zone === zone && (
                  <p className="text-[10px] font-semibold" style={{ color: meta.color }}>← You are here</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* BHI trend chart with tooltips */}
      {sparkline.length > 1 && (
        <div className="border rounded-xl p-5 bg-card space-y-3">
          <div>
            <p className="text-sm font-semibold">Brand Health Trend</p>
            <p className="text-xs text-muted-foreground">{rlShort} history — hover data points for details</p>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={sparkline} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
              <CartesianGrid strokeDasharray="0" vertical={false} stroke="currentColor" className="text-border opacity-40" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.4 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                tickFormatter={(v: string) => new Date(v).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                fontFamily="var(--font-sans)"
              />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.35 }} tickLine={false} axisLine={false} tickCount={5} fontFamily="var(--font-sans)" />
              <ReferenceLine y={80} stroke="#14b8a6" strokeDasharray="4 3" strokeOpacity={0.25} label={{ value: 'Leading', fontSize: 9, fill: '#14b8a6', opacity: 0.5 }} />
              <ReferenceLine y={65} stroke="#22c55e" strokeDasharray="4 3" strokeOpacity={0.25} label={{ value: 'Healthy', fontSize: 9, fill: '#22c55e', opacity: 0.5 }} />
              <ReferenceLine y={40} stroke="#f59e0b" strokeDasharray="4 3" strokeOpacity={0.25} label={{ value: 'Building', fontSize: 9, fill: '#f59e0b', opacity: 0.5 }} />
              <RechartTooltip
                formatter={(v) => [typeof v === 'number' ? Math.round(v) : v, 'BHI Score']}
                labelFormatter={(v) => typeof v === 'string' ? new Date(v).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }) : String(v)}
                contentStyle={{
                  background: '#14182B',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 12,
                  fontSize: 12,
                  color: '#fff',
                }}
                labelStyle={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 4 }}
              />
              <Line
                type="monotone"
                dataKey="score"
                name="BHI"
                stroke="#2B59FF"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: '#2B59FF', strokeWidth: 2, stroke: '#fff' }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 flex-wrap">
            {[
              { label: 'Leading', color: '#14b8a6', range: '80–100' },
              { label: 'Healthy', color: '#22c55e', range: '65–79' },
              { label: 'Building', color: '#f59e0b', range: '40–64' },
              { label: 'At Risk', color: '#ef4444', range: '0–39' },
            ].map(z => (
              <div key={z.label} className="flex items-center gap-1.5">
                <span className="h-[2px] w-4 rounded-full" style={{ background: z.color, opacity: 0.5 }} />
                <span className="text-[10px] text-muted-foreground">{z.label} ({z.range})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ESOV Engine */}
      <div className="border rounded-xl p-5 bg-card space-y-4">
        <div>
          <p className="text-sm font-semibold">ESOV Engine</p>
          <p className="text-xs text-muted-foreground">
            Excess Share of Voice = SOV% − Market Share%. Positive ESOV predicts brand growth.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="border rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Your SOV</p>
            <p className="text-2xl font-bold mt-0.5">
              {sovPct != null ? `${Math.round(sovPct)}%` : '—'}
            </p>
          </div>
          <div className="border rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Market share (est.)</p>
            <div className="flex items-center justify-center gap-1 mt-0.5">
              <input
                type="number"
                min={0}
                max={100}
                value={marketShare}
                onChange={e => setMarketShare(Number(e.target.value))}
                className="w-14 text-center text-xl font-bold bg-transparent border-b border-dashed border-muted-foreground/40 focus:outline-none focus:border-foreground"
              />
              <span className="text-xl font-bold">%</span>
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">click to edit</p>
          </div>
          <div className={cn('border rounded-lg p-3 text-center', posture?.bg ?? 'bg-muted border-border')}>
            <p className="text-xs text-muted-foreground">ESOV</p>
            <p className={cn('text-2xl font-bold mt-0.5', posture?.color ?? 'text-muted-foreground')}>
              {esov != null ? `${esov > 0 ? '+' : ''}${esov}%` : '—'}
            </p>
            {posture && (
              <p className={cn('text-[10px] font-semibold mt-0.5', posture.color)}>{posture.label}</p>
            )}
          </div>
        </div>

        {/* Budget simulator */}
        <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Budget-to-ESOV Simulator</p>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground">Target ESOV:</p>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={-20}
                max={50}
                value={targetEsov}
                onChange={e => setTargetEsov(Number(e.target.value))}
                className="w-14 text-center text-sm font-semibold bg-transparent border-b border-dashed border-muted-foreground/40 focus:outline-none focus:border-foreground"
              />
              <span className="text-sm font-semibold">%</span>
            </div>
          </div>
          {estimatedAdditionalSpend != null && currentSov > 0 ? (
            <div className="space-y-1">
              <p className="text-sm">
                To reach{' '}
                <span className="font-semibold">{marketShare + targetEsov}% SOV</span>
                {' '}(ESOV +{targetEsov}%), estimated additional media investment needed:
              </p>
              <p className="text-2xl font-bold">{formatNGN(estimatedAdditionalSpend)}</p>
              <p className="text-xs text-muted-foreground">
                Estimated time to impact: {targetEsov <= 5 ? '3–6 months' : targetEsov <= 15 ? '6–9 months' : '9–12 months'} at sustained spend.
                Based on current social EMV as spend proxy — accuracy improves when digital ad accounts are connected.
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {sovPct == null
                ? 'Connect social accounts and run a mention crawl to enable the simulator.'
                : 'Enter a target ESOV above to see the estimated spend required.'}
            </p>
          )}
        </div>
      </div>

      {/* Perception Radar */}
      <div className="border rounded-xl p-5 bg-card space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Perception Radar</p>
            <p className="text-xs text-muted-foreground">
              8 brand dimensions from Perception Audit surveys — score 0–100
            </p>
          </div>
          {!hasPerceptionData && (
            <Link
              href="/dashboard/surveys"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <LinkIcon className="h-3.5 w-3.5" />
              Run a Perception Audit
            </Link>
          )}
        </div>

        {hasPerceptionData ? (
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
              <PolarGrid className="stroke-border" />
              <PolarAngleAxis
                dataKey="dimension"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              />
              <Radar
                name={brandName}
                dataKey="score"
                stroke="#2B59FF"
                fill="#2B59FF"
                fillOpacity={0.18}
                strokeWidth={2}
              />
              <RechartTooltip
                formatter={(v, _name, props) => [
                  `${Number(v).toFixed(0)}/100`,
                  (props.payload as { fullLabel?: string })?.fullLabel ?? String(_name),
                ]}
                contentStyle={{
                  background: '#14182B',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 12,
                  fontSize: 12,
                  color: '#fff',
                }}
                labelStyle={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.10em' }}
              />
            </RadarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center border rounded-lg border-dashed">
            <div className="text-center space-y-1.5">
              <p className="text-sm text-muted-foreground">No Perception Audit responses yet</p>
              <p className="text-xs text-muted-foreground/60">
                Create and publish a Perception Audit survey to populate this chart.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* EMV + NPS summary row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* EMV */}
        <div className="border rounded-xl p-5 bg-card space-y-2">
          <p className="text-sm font-semibold">Estimated Media Value</p>
          <p className="text-3xl font-bold">{emvRaw > 0 ? formatNGN(emvRaw) : '—'}</p>
          <p className="text-xs text-muted-foreground">
            {rlShort} · based on organic social impressions, reach, and engagements
            using Nigerian market CPM (₦500/K) and CPE (₦50) benchmarks.
          </p>
          <p className="text-[10px] text-muted-foreground/60">
            Benchmarks are adjustable in Settings → Brand in a future update.
          </p>
        </div>

        {/* NPS summary */}
        <div className="border rounded-xl p-5 bg-card space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Net Promoter Score</p>
            <Link
              href="/dashboard/surveys/nps"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              Full tracker <LinkIcon className="h-3 w-3" />
            </Link>
          </div>
          <p className={cn('text-3xl font-bold', currentNps == null ? 'text-muted-foreground/40' :
            currentNps >= 50 ? 'text-green-600' : currentNps >= 30 ? 'text-foreground' :
            currentNps >= 0 ? 'text-amber-500' : 'text-red-500')}>
            {currentNps != null ? `${currentNps >= 0 ? '+' : ''}${currentNps}` : '—'}
          </p>
          <p className="text-xs text-muted-foreground">
            {npsTotal >= 3 ? `Based on ${npsTotal} survey responses.` : 'Need at least 3 NPS responses to compute.'}
          </p>
        </div>
      </div>
    </div>
  )
}
