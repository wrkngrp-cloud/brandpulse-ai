'use client'

import { useState } from 'react'
import {
  Flame,
  TrendingUp,
  TrendingDown,
  Calendar,
  Sparkles,
  Loader2,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActivationIdea {
  title: string
  description: string
  channel: string
  effort: 'Low' | 'Medium' | 'High'
}

interface CulturalMoment {
  name: string
  date: string // YYYY-MM-DD
  type: 'Religious' | 'National' | 'Cultural' | 'Seasonal'
  brandRelevance: string
}

interface AnalysisRow {
  id: string
  cultural_score: number
  created_at: string
  content_text: string | null
  platform: string | null
  funnel_goal: string | null
  tone_score: number | null
  engagement_score: number | null
  risk_score: number | null
}

interface Props {
  brandName: string
  category: string | null
  crsScore: number | null
  drift: number | null
  emotionResonance: number | null
  today: string // YYYY-MM-DD from server
  analysisCount: number
  brandValues: string[]
  analyses: AnalysisRow[]
}

// ---------------------------------------------------------------------------
// 2026 Nigerian / West African cultural calendar
// ---------------------------------------------------------------------------

// Base calendar as MM-DD patterns — year computed dynamically at runtime
// For floating Islamic holidays, approximate dates are set per year for up to 2027.
type BaseMoment = Omit<CulturalMoment, 'date'> & { mmdd: string; floatingDates?: Record<string, string> }

const BASE_CALENDAR: BaseMoment[] = [
  { name: "Valentine's Day",  mmdd: '02-14', type: 'Cultural',  brandRelevance: 'High gifting and affinity moment across age groups' },
  { name: 'Ramadan Start',    mmdd: '03-18', type: 'Religious', brandRelevance: 'Reach Muslim consumers with values-led and community content',
    floatingDates: { '2026': '2026-03-18', '2027': '2027-03-08' } },
  { name: 'Easter',           mmdd: '04-05', type: 'Religious', brandRelevance: 'Family gatherings and celebration drive spending',
    floatingDates: { '2026': '2026-04-05', '2027': '2027-03-28' } },
  { name: 'Eid al-Fitr',     mmdd: '04-17', type: 'Religious', brandRelevance: 'Celebratory gifting and premium experiences resonate',
    floatingDates: { '2026': '2026-04-17', '2027': '2027-04-06' } },
  { name: "Workers' Day",     mmdd: '05-01', type: 'National',  brandRelevance: 'Opportunity to celebrate your workforce and community' },
  { name: 'Africa Day',       mmdd: '05-25', type: 'Cultural',  brandRelevance: 'Pan-African identity and pride — strong cultural storytelling moment' },
  { name: 'Eid al-Adha',     mmdd: '06-26', type: 'Religious', brandRelevance: 'Sacrifice, generosity, and community themes',
    floatingDates: { '2026': '2026-06-26', '2027': '2027-06-16' } },
  { name: 'Independence Day', mmdd: '10-01', type: 'National',  brandRelevance: 'National pride — connect brand to Nigeria identity' },
  { name: 'Detty December',   mmdd: '12-01', type: 'Seasonal',  brandRelevance: 'Biggest entertainment and spending season in West Africa' },
  { name: 'Christmas',        mmdd: '12-25', type: 'Religious', brandRelevance: 'Peak gifting, family, and celebration campaigns' },
]

function buildCalendar(today: string): CulturalMoment[] {
  const currentYear = new Date(today).getFullYear()
  const moments: CulturalMoment[] = []
  for (const yr of [currentYear, currentYear + 1]) {
    for (const base of BASE_CALENDAR) {
      const date = base.floatingDates?.[String(yr)] ?? `${yr}-${base.mmdd}`
      moments.push({ name: base.name, date, type: base.type, brandRelevance: base.brandRelevance })
    }
  }
  // Dedupe by name+date, remove past moments except keep one full year of upcoming
  return moments
    .filter(m => m.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((m, i, arr) => i === 0 || arr[i - 1].name !== m.name)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_BADGE: Record<CulturalMoment['type'], string> = {
  Religious: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  National:  'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  Cultural:  'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  Seasonal:  'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
}

const EFFORT_BADGE: Record<string, string> = {
  Low:    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  Medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  High:   'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

function daysUntil(dateStr: string, todayStr: string): number {
  const target = new Date(dateStr)
  const now = new Date(todayStr)
  // Compare date-only
  const diffMs = target.getTime() - now.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

function crsColor(score: number): string {
  if (score >= 70) return 'text-green-600'
  if (score >= 50) return 'text-amber-500'
  return 'text-red-500'
}

function crsRingColor(score: number): string {
  if (score >= 70) return 'stroke-green-500'
  if (score >= 50) return 'stroke-amber-400'
  return 'stroke-red-500'
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CRSGauge({
  score,
  drift,
}: {
  score: number | null
  drift: number | null
}) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const pct = score !== null ? Math.min(100, Math.max(0, score)) / 100 : 0
  const dashOffset = circumference * (1 - pct)

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <div className="relative inline-flex items-center justify-center">
        <svg width="136" height="136" className="-rotate-90">
          <circle
            cx="68"
            cy="68"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            className="text-muted/30"
          />
          {score !== null && (
            <circle
              cx="68"
              cy="68"
              r={radius}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className={cn('transition-all duration-700', crsRingColor(score))}
            />
          )}
        </svg>
        <div className="absolute flex flex-col items-center">
          {score !== null ? (
            <>
              <span className={cn('text-4xl font-bold tabular-nums', crsColor(score))}>
                {Math.round(score)}
              </span>
              <span className="text-xs text-muted-foreground mt-0.5">/ 100</span>
            </>
          ) : (
            <span className="text-4xl font-bold text-muted-foreground/30">—</span>
          )}
        </div>
      </div>

      {/* Drift badge */}
      {drift !== null && (
        <div
          className={cn(
            'inline-flex items-center gap-1 text-sm font-medium px-2.5 py-1 rounded-full',
            drift >= 0
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
          )}
        >
          {drift >= 0 ? (
            <TrendingUp className="h-3.5 w-3.5" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5" />
          )}
          {drift >= 0 ? '+' : ''}
          {drift.toFixed(1)} pts vs prior period
        </div>
      )}
    </div>
  )
}

function EmotionBar({ value }: { value: number | null }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">Audience emotional positivity</span>
        <span className="text-sm font-semibold tabular-nums">
          {value !== null ? `${Math.round(value)}%` : '—'}
        </span>
      </div>
      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700',
            value === null
              ? 'w-0'
              : value >= 60
              ? 'bg-green-500'
              : value >= 40
              ? 'bg-amber-400'
              : 'bg-red-400',
          )}
          style={{ width: value !== null ? `${Math.min(100, value)}%` : '0%' }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Based on joy, trust and anticipation signals in recent posts
      </p>
    </div>
  )
}

function CalendarCard({
  moment,
  daysAway,
}: {
  moment: CulturalMoment
  daysAway: number
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-0">
      <div className="shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-muted text-center">
        <span className="text-xs text-muted-foreground leading-tight">
          {new Date(moment.date).toLocaleDateString('en-NG', { month: 'short' })}
        </span>
        <span className="text-base font-bold leading-tight">
          {new Date(moment.date).getDate()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium">{moment.name}</p>
          <span
            className={cn(
              'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
              TYPE_BADGE[moment.type],
            )}
          >
            {moment.type}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
          {moment.brandRelevance}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <span
          className={cn(
            'text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full',
            daysAway <= 14
              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
              : daysAway <= 30
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {daysAway === 0 ? 'Today' : daysAway === 1 ? 'Tomorrow' : `${daysAway}d`}
        </span>
      </div>
    </div>
  )
}

function ActivationCard({
  moment,
  brandName,
  category,
  brandValues,
}: {
  moment: CulturalMoment
  brandName: string
  category: string | null
  brandValues: string[]
}) {
  const [ideas, setIdeas] = useState<ActivationIdea[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/cultural/activation-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          momentName: moment.name,
          brandName,
          category: category ?? undefined,
          brandValues: brandValues.length ? brandValues : undefined,
        }),
      })
      if (!res.ok) throw new Error('Failed to generate ideas')
      const data = (await res.json()) as { ideas: ActivationIdea[] }
      setIdeas(data.ideas)
    } catch {
      setError('Could not generate ideas right now. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border rounded-xl p-4 space-y-3 bg-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium">{moment.name}</p>
            <span
              className={cn(
                'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                TYPE_BADGE[moment.type],
              )}
            >
              {moment.type}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(moment.date).toLocaleDateString('en-NG', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
        {!ideas && (
          <Button
            size="sm"
            variant="outline"
            onClick={generate}
            disabled={loading}
            className="shrink-0"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generating
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Generate ideas
              </>
            )}
          </Button>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      {ideas && (
        <div className="space-y-2 pt-1">
          {ideas.map((idea, i) => (
            <div
              key={i}
              className="rounded-lg border bg-muted/30 px-3 py-2.5 space-y-1"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm font-medium">{idea.title}</p>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] text-muted-foreground border rounded px-1.5 py-0.5">
                    {idea.channel}
                  </span>
                  <span
                    className={cn(
                      'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                      EFFORT_BADGE[idea.effort] ?? 'bg-muted text-muted-foreground',
                    )}
                  >
                    {idea.effort}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-snug">
                {idea.description}
              </p>
            </div>
          ))}
          <button
            onClick={() => setIdeas(null)}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 pt-1"
          >
            Regenerate
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function CulturalClient({
  brandName,
  category,
  crsScore,
  drift,
  emotionResonance,
  today,
  analysisCount,
  brandValues,
  analyses,
}: Props) {
  const [crsOpen, setCrsOpen] = useState(false)

  // Filter to future moments only, sorted by date, max 6
  const upcomingMoments = buildCalendar(today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6)

  // Activation moments: next 2 within 45 days
  const activationMoments = upcomingMoments.filter(
    m => daysUntil(m.date, today) <= 45,
  ).slice(0, 2)

  const showDriftAlert = drift !== null && drift < -5

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4 sm:p-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500" />
          <h1 className="text-2xl font-semibold tracking-tight">Cultural Intelligence</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          How well {brandName} resonates with Nigerian and West African audiences
        </p>
      </div>

      {/* Drift alert banner */}
      {showDriftAlert && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/40 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">
            Cultural drift detected — your content has become less resonant with Nigerian audiences recently.
          </p>
        </div>
      )}

      {/* CRS score card */}
      <div className="border rounded-xl p-5 bg-card space-y-2">
        <button
          className={cn(
            'flex items-center justify-between w-full text-left',
            crsScore !== null && 'cursor-pointer hover:opacity-80 transition-opacity',
          )}
          onClick={() => crsScore !== null && setCrsOpen(o => !o)}
          disabled={crsScore === null}
        >
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Cultural Resonance Score
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {analysisCount > 0
                ? `Averaged from ${analysisCount} content analysis${analysisCount === 1 ? '' : 'es'} in the last 30 days`
                : 'Run Pre-Post analyses to populate this score'}
            </p>
          </div>
          {crsScore !== null && (
            crsOpen
              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        <CRSGauge score={crsScore} drift={drift} />

        {crsScore === null && (
          <p className="text-center text-xs text-muted-foreground pb-2">
            Use the Pre-Post widget to analyse content and build your Cultural Resonance Score.
          </p>
        )}

        {/* Analysis breakdown — shown when expanded */}
        {crsOpen && analyses.length > 0 && (
          <div className="border-t pt-4 mt-2 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Breakdown — last 30 days
            </p>
            {analyses.map(a => {
              const date = new Date(a.created_at).toLocaleDateString('en-NG', {
                day: 'numeric', month: 'short',
              })
              const preview = a.content_text
                ? a.content_text.slice(0, 80) + (a.content_text.length > 80 ? '…' : '')
                : null
              return (
                <div key={a.id} className="rounded-lg border bg-muted/30 px-3 py-2.5 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {a.platform && (
                        <span className="text-[10px] font-medium bg-background border rounded px-1.5 py-0.5">
                          {a.platform}
                        </span>
                      )}
                      {a.funnel_goal && (
                        <span className="text-[10px] text-muted-foreground">
                          {a.funnel_goal}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{date}</span>
                  </div>
                  {preview && (
                    <p className="text-xs text-muted-foreground leading-snug">{preview}</p>
                  )}
                  <div className="flex items-center gap-3 pt-0.5">
                    <span className={cn('text-xs font-semibold tabular-nums', crsColor(a.cultural_score))}>
                      Cultural {Math.round(a.cultural_score)}
                    </span>
                    {a.engagement_score != null && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        Eng {Math.round(a.engagement_score)}
                      </span>
                    )}
                    {a.tone_score != null && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        Tone {Math.round(a.tone_score)}
                      </span>
                    )}
                    {a.risk_score != null && (
                      <span className={cn(
                        'text-xs tabular-nums',
                        a.risk_score > 50 ? 'text-red-500' : a.risk_score > 20 ? 'text-amber-500' : 'text-muted-foreground',
                      )}>
                        Risk {Math.round(a.risk_score)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Emotion resonance bar */}
      <div className="border rounded-xl p-5 bg-card">
        <EmotionBar value={emotionResonance} />
      </div>

      {/* Cultural calendar */}
      <div className="border rounded-xl p-5 bg-card space-y-1">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">2026 Cultural Calendar</p>
        </div>

        {upcomingMoments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No upcoming moments — check back next year.
          </p>
        ) : (
          <div>
            {upcomingMoments.map(moment => (
              <CalendarCard
                key={moment.name}
                moment={moment}
                daysAway={daysUntil(moment.date, today)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Activation suggestions */}
      {activationMoments.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Activation Suggestions</p>
            <span className="text-xs text-muted-foreground">— moments coming up within 45 days</span>
          </div>

          {activationMoments.map(moment => (
            <ActivationCard
              key={moment.name}
              moment={moment}
              brandName={brandName}
              category={category}
              brandValues={brandValues}
            />
          ))}
        </div>
      )}
    </div>
  )
}
