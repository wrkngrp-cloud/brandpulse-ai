'use client'

import { useState, useTransition } from 'react'
import {
  Globe, Eye, Heart, Zap, Shield, Share2,
  ChevronDown, Sparkles, Loader2, AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type StageKey = 'awareness' | 'consideration' | 'preference' | 'action' | 'loyalty' | 'advocacy'

interface StageScore {
  score: number | null
  source: string
  dataPoints: number
}

interface Props {
  scores: Record<StageKey, StageScore>
  brandName: string
  industry: string | null
}

interface DiagnosisResult {
  biggestGap: string
  diagnosis: string
  recommendations: string[]
}

const STAGES: {
  key: StageKey
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { key: 'awareness',     label: 'Awareness',     description: 'People who know your brand exists',          icon: Globe  },
  { key: 'consideration', label: 'Consideration', description: 'Actively engaging with your content',         icon: Eye    },
  { key: 'preference',    label: 'Preference',    description: 'Positive sentiment toward your brand',        icon: Heart  },
  { key: 'action',        label: 'Action',        description: 'Visiting, attending, or converting',          icon: Zap    },
  { key: 'loyalty',       label: 'Loyalty',       description: 'Satisfied customers who would recommend you', icon: Shield },
  { key: 'advocacy',      label: 'Advocacy',      description: 'Actively sharing and promoting your brand',   icon: Share2 },
]

function scoreColor(score: number) {
  if (score >= 65) return 'text-foreground'
  if (score >= 40) return 'text-amber-500'
  return 'text-red-500'
}

function dropOffMeta(from: number | null, to: number | null) {
  if (from == null || to == null || from === 0)
    return { pct: null, colorClass: 'text-muted-foreground/40', urgent: false }
  const pct = Math.round(((from - to) / from) * 100)
  const urgent = pct > 30
  const colorClass = pct <= 15 ? 'text-green-600' : pct <= 30 ? 'text-amber-500' : 'text-red-500'
  return { pct, colorClass, urgent }
}

export function FunnelClient({ scores, brandName, industry }: Props) {
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null)
  const [isPending, startTransition] = useTransition()

  const stageScores = STAGES.map(s => scores[s.key].score)

  function handleDiagnose() {
    startTransition(async () => {
      const res = await fetch('/api/funnel/diagnose', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ scores, brandName, industry }),
      })
      const data = await res.json() as DiagnosisResult | { error: string }
      if ('error' in data) { toast.error(data.error); return }
      setDiagnosis(data)
    })
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Scores refresh as sentiment, survey, and campaign data arrives.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={handleDiagnose}
          disabled={isPending}
        >
          {isPending ? (
            <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Analysing…</>
          ) : (
            <><Sparkles className="h-3.5 w-3.5 mr-1.5" />Diagnose with AI</>
          )}
        </Button>
      </div>

      {/* Funnel */}
      <div className="border rounded-xl overflow-hidden bg-card">
        {STAGES.map((stage, idx) => {
          const { score, source, dataPoints } = scores[stage.key]
          const Icon = stage.icon
          const drop = dropOffMeta(stageScores[idx], stageScores[idx + 1])
          const isLast = idx === STAGES.length - 1

          return (
            <div key={stage.key} className={cn(idx > 0 && 'border-t border-border')}>
              {/* Stage row */}
              <div className="px-5 py-4">
                <div className="flex items-start gap-4">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{stage.label}</p>
                        <p className="text-xs text-muted-foreground">{stage.description}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {score != null ? (
                          <span className={cn('text-2xl font-bold tabular-nums', scoreColor(score))}>
                            {score}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">No data</span>
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-foreground transition-all duration-700"
                        style={{ width: score != null ? `${score}%` : '0%' }}
                      />
                    </div>

                    <p className="text-[11px] text-muted-foreground/50 mt-1.5">
                      {source} ·{' '}
                      {dataPoints > 0
                        ? `${dataPoints} data point${dataPoints !== 1 ? 's' : ''}`
                        : 'waiting for data'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Drop-off connector */}
              {!isLast && (
                <div className="px-5 py-2 bg-muted/25 border-t border-dashed border-border flex items-center gap-2">
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                  {drop.pct != null ? (
                    <>
                      <span className={cn('text-xs font-semibold tabular-nums', drop.colorClass)}>
                        {drop.pct}% drop-off
                      </span>
                      {drop.urgent && (
                        <span className="flex items-center gap-0.5 text-[10px] font-medium text-red-500 ml-1">
                          <AlertCircle className="h-3 w-3" />
                          Priority gap
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-[11px] text-muted-foreground/40">
                      Need scores for both stages to compute drop-off
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* AI Diagnosis result */}
      {diagnosis && (
        <div className="border rounded-xl p-5 bg-card space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-7 w-7 rounded-full bg-foreground flex items-center justify-center shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-background" />
            </div>
            <div>
              <p className="text-sm font-semibold">Funnel diagnosis</p>
              <p className="text-xs text-muted-foreground">
                Biggest gap:{' '}
                <span className="font-medium text-foreground capitalize">
                  {diagnosis.biggestGap}
                </span>{' '}
                stage
              </p>
            </div>
          </div>

          <p className="text-sm leading-relaxed">{diagnosis.diagnosis}</p>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Recommended actions
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

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-foreground inline-block" />
          65–100 Healthy
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />
          40–64 Building
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
          0–39 At risk
        </span>
        <span className="ml-auto flex flex-wrap gap-x-2">
          <span className="text-green-600 font-medium">≤15% drop good</span>
          <span className="text-amber-500 font-medium">16–30% watch</span>
          <span className="text-red-500 font-medium">&gt;30% urgent</span>
        </span>
      </div>
    </div>
  )
}
