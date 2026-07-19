'use client'

import { useState, useTransition } from 'react'
import {
  Globe, Eye, Heart, Zap, Shield, Share2,
  ChevronDown, Sparkles, Loader2, AlertCircle, ChevronRight, Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import Link from 'next/link'

type StageKey = 'awareness' | 'consideration' | 'preference' | 'action' | 'loyalty' | 'advocacy'

interface BreakdownItem {
  label:      string
  rawDisplay: string | null
  weight:     number
  score:      number | null
}

interface StageScore {
  score:      number | null
  source:     string
  dataPoints: number
  breakdown:  BreakdownItem[]
}

interface Props {
  scores:    Record<StageKey, StageScore>
  brandName: string
  industry:  string | null
}

interface DiagnosisResult {
  biggestGap:      string
  diagnosis:       string
  recommendations: string[]
}

interface StageAnalysis {
  channels:    string[]
  initiatives: string[]
  explanation: string
  topActions:  string[]
}

const STAGES: {
  key:         StageKey
  label:       string
  description: string
  icon:        React.ComponentType<{ className?: string }>
}[] = [
  { key: 'awareness',     label: 'Awareness',     description: 'Share of Voice · OOH · Events · Digital · Influencer (Ehrenberg-Bass)',  icon: Globe  },
  { key: 'consideration', label: 'Consideration', description: 'Engagement rate → Brand Salience signal',                                 icon: Eye    },
  { key: 'preference',    label: 'Preference',    description: 'Sentiment score → Brand Association quality (Aaker)',                      icon: Heart  },
  { key: 'action',        label: 'Action',        description: 'Lead capture + OOH visit-throughs → 7Ps: Place, Promotion',               icon: Zap    },
  { key: 'loyalty',       label: 'Loyalty',       description: 'NPS → People, Process, Physical Evidence (7Ps)',                          icon: Shield },
  { key: 'advocacy',      label: 'Advocacy',      description: 'Share rate → Word-of-mouth / Distinctive Assets (Ehrenberg-Bass)',        icon: Share2 },
]

const STAGE_EMPTY: Record<StageKey, { text: string; linkLabel?: string; linkHref?: string }> = {
  awareness:     { text: '' },
  consideration: {
    text: 'Consideration tracks brand awareness in conversation. Run a sentiment crawl in Settings to start collecting social mentions.',
    linkLabel: 'Go to Connectors',
    linkHref: '/dashboard/connectors',
  },
  preference:    { text: '' },
  action:        {
    text: 'Action measures how many people convert — via campaign links, event leads, or sales. Connect vanity URLs in OOH tracking, log event leads via the Events module, or import sales data to see this stage.',
    linkLabel: 'OOH tracking',
    linkHref: '/dashboard/ooh',
  },
  loyalty:       {
    text: 'Loyalty measures how many customers would buy again. Run an NPS survey — go to Surveys to send your first pulse.',
    linkLabel: 'Go to Surveys',
    linkHref: '/dashboard/surveys/nps',
  },
  advocacy:      {
    text: 'Advocacy measures organic brand championing. It needs at least 50 social engagements tracked and NPS data with 10+ responses.',
    linkLabel: 'Track social posts',
    linkHref: '/dashboard/sentiment',
  },
}

function scoreColor(score: number) {
  if (score >= 65) return 'text-foreground'
  if (score >= 40) return 'text-amber-500'
  return 'text-red-500'
}

function dropOffMeta(from: number | null, to: number | null) {
  if (from == null || to == null || from === 0)
    return { pct: null, isLift: false, colorClass: 'text-muted-foreground/40', urgent: false }
  const pct = Math.round(((from - to) / from) * 100)
  const isLift = pct < 0
  const urgent = pct > 30
  const colorClass = isLift ? 'text-green-600' : pct <= 15 ? 'text-green-600' : pct <= 30 ? 'text-amber-500' : 'text-red-500'
  return { pct: Math.abs(pct), isLift, colorClass, urgent }
}

function scoreBarColor(score: number | null) {
  if (score == null) return '#94a3b8'
  if (score >= 65)   return '#22c55e'
  if (score >= 40)   return '#f59e0b'
  return '#ef4444'
}

export function FunnelClient({ scores, brandName, industry }: Props) {
  const [diagnosis, setDiagnosis]       = useState<DiagnosisResult | null>(null)
  const [isPending, startTransition]    = useTransition()
  const [analyses, setAnalyses]         = useState<Partial<Record<StageKey, StageAnalysis>>>({})
  const [loadingStage, setLoadingStage] = useState<StageKey | null>(null)
  const [openAI, setOpenAI]             = useState<StageKey | null>(null)
  const [openData, setOpenData]         = useState<StageKey | null>(null)

  const stageScores = STAGES.map(s => scores[s.key].score)

  function handleDiagnose() {
    const nullStages = STAGES.filter(s => scores[s.key].score == null).map(s => s.label)
    const hasEnoughData = nullStages.length < STAGES.length - 1

    if (!hasEnoughData) {
      toast.error(
        `Not enough data yet for a full diagnosis. The funnel needs scores on at least 2 stages. Still empty: ${nullStages.join(', ')}. Connect the data sources that feed these stages and the diagnosis unlocks.`,
        {
          duration: 8000,
          action: {
            label:   'Open Connectors',
            onClick: () => { window.location.href = '/dashboard/connectors' },
          },
        },
      )
      return
    }

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

  async function handleStageAI(stage: StageKey, score: number | null) {
    if (loadingStage) return

    if (openAI === stage && analyses[stage]) {
      setOpenAI(null)
      return
    }

    setOpenAI(stage)
    setOpenData(null)

    if (analyses[stage]) return

    setLoadingStage(stage)
    try {
      const res = await fetch('/api/funnel/stage-analysis', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ stage, score, brandName, industry }),
      })
      const data = await res.json() as StageAnalysis | { error: string }
      if ('error' in data) {
        toast.error(data.error)
        setOpenAI(null)
        return
      }
      setAnalyses(prev => ({ ...prev, [stage]: data }))
    } catch {
      toast.error('Analysis failed — please try again.')
      setOpenAI(null)
    } finally {
      setLoadingStage(null)
    }
  }

  function toggleData(stage: StageKey) {
    setOpenData(prev => prev === stage ? null : stage)
    setOpenAI(null)
  }

  return (
    <div className="space-y-6" data-tour="funnel-main">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
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
          const { score, source, dataPoints, breakdown } = scores[stage.key]
          const Icon        = stage.icon
          const drop        = dropOffMeta(stageScores[idx], stageScores[idx + 1])
          const isLast      = idx === STAGES.length - 1
          const isDataOpen  = openData === stage.key
          const isAIOpen    = openAI  === stage.key
          const isLoading   = loadingStage === stage.key
          const analysis    = analyses[stage.key]

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

                    <div className="flex flex-wrap items-center justify-between gap-1.5 mt-1.5">
                      {/* Data points toggle */}
                      <button
                        type="button"
                        onClick={() => toggleData(stage.key)}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <span>{source}</span>
                        <span className="opacity-60">
                          · {breakdown.filter(b => b.score !== null).length}/{breakdown.length} signals active
                        </span>
                        <ChevronDown className={cn('h-3 w-3 ml-0.5 transition-transform', isDataOpen && 'rotate-180')} />
                      </button>

                      {/* AI analysis button */}
                      <button
                        type="button"
                        onClick={() => handleStageAI(stage.key, score)}
                        disabled={isLoading && loadingStage !== stage.key}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {isLoading ? (
                          <><Loader2 className="h-3 w-3 animate-spin" />Analysing…</>
                        ) : (
                          <>
                            <Sparkles className="h-3 w-3" />
                            Why this score?
                            <ChevronRight className={cn('h-3 w-3 transition-transform', isAIOpen && 'rotate-90')} />
                          </>
                        )}
                      </button>
                    </div>

                    {/* Empty state callout when score is null */}
                    {score == null && STAGE_EMPTY[stage.key].text && (
                      <div className="mt-3 flex items-start gap-2 border rounded-lg bg-muted/30 px-3 py-2">
                        <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {STAGE_EMPTY[stage.key].text}
                          </p>
                          {STAGE_EMPTY[stage.key].linkLabel && STAGE_EMPTY[stage.key].linkHref && (
                            <Link
                              href={STAGE_EMPTY[stage.key].linkHref!}
                              className="text-xs text-primary hover:underline"
                            >
                              {STAGE_EMPTY[stage.key].linkLabel} →
                            </Link>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Data points breakdown panel */}
              {isDataOpen && (
                <div className="border-t border-border bg-muted px-5 py-4 space-y-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Data points &amp; weightings
                  </p>
                  {breakdown.length > 0 ? (
                    <div className="space-y-3">
                      {breakdown.map(item => (
                        <div key={item.label} className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-medium text-foreground/80 truncate">{item.label}</span>
                              {item.rawDisplay && (
                                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{item.rawDisplay}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-[10px] text-muted-foreground">
                                {item.weight > 0 ? `${item.weight}% weight` : 'no data'}
                              </span>
                              <span
                                className="text-xs font-bold tabular-nums w-12 text-right"
                                style={{ color: scoreBarColor(item.score) }}
                              >
                                {item.score !== null ? `${item.score}/100` : '—'}
                              </span>
                            </div>
                          </div>
                          {/* Two-layer bar: weight track + score fill */}
                          <div className="relative h-1.5 bg-muted-foreground/10 rounded-full overflow-hidden">
                            <div
                              className="absolute inset-y-0 left-0 rounded-full bg-muted-foreground/20"
                              style={{ width: `${item.weight}%` }}
                            />
                            {item.score !== null && item.weight > 0 && (
                              <div
                                className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                                style={{
                                  width: `${(item.weight / 100) * item.score}%`,
                                  backgroundColor: scoreBarColor(item.score),
                                  opacity: 0.85,
                                }}
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No source data yet for this stage.</p>
                  )}
                </div>
              )}

              {/* AI analysis panel */}
              {isAIOpen && analysis && (
                <div className="border-t border-dashed border-border bg-muted/20 px-5 py-4 space-y-4">
                  {/* Channels */}
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Channels informing this stage
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.channels.map(ch => (
                        <span
                          key={ch}
                          className="text-xs px-2 py-0.5 rounded-full bg-foreground/8 border border-border font-medium"
                        >
                          {ch}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Initiatives */}
                  {analysis.initiatives.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Initiatives powering it
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.initiatives.map(init => (
                          <span
                            key={init}
                            className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40"
                          >
                            {init}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI explanation */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <div className="h-4 w-4 rounded-full bg-foreground flex items-center justify-center shrink-0">
                        <Sparkles className="h-2.5 w-2.5 text-background" />
                      </div>
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Why this score
                      </p>
                    </div>
                    <p className="text-sm leading-relaxed">{analysis.explanation}</p>
                  </div>

                  {/* Top actions */}
                  {analysis.topActions.length > 0 && (
                    <div className="space-y-2 pt-1 border-t border-border/50">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Top actions to improve this stage
                      </p>
                      <ol className="space-y-2">
                        {analysis.topActions.map((action, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-sm">
                            <span className="shrink-0 h-5 w-5 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center font-semibold">
                              {i + 1}
                            </span>
                            <span>{action}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              )}

              {/* Loading state for AI analysis */}
              {isAIOpen && isLoading && (
                <div className="border-t border-dashed border-border bg-muted/20 px-5 py-6 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  Fetching signals and generating analysis…
                </div>
              )}

              {/* Drop-off connector */}
              {!isLast && (
                <div className="px-5 py-2 bg-muted/25 border-t border-dashed border-border flex items-center gap-2">
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                  {drop.pct != null ? (
                    <>
                      <span className={cn('text-xs font-semibold tabular-nums', drop.colorClass)}>
                        {drop.pct}% {drop.isLift ? 'lift' : 'drop-off'}
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

      {/* Overall AI Diagnosis result */}
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
