import { Suspense }     from 'react'
import { createClient } from '@/lib/supabase/server'
import { Skeleton }     from '@/components/ui/skeleton'
import { NewSurveyDialog } from './new-survey-dialog'
import { SurveysList }  from '@/components/surveys/surveys-list'
import { MessageSquare, TrendingUp, BarChart2, Users, CheckCircle2, Clock } from 'lucide-react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { LaunchPerceptionAuditButton } from './launch-perception-audit-button'

const APP_URL = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// ── Perception dimensions (q2–q9) ───────────────────────────────────────────
const PERCEPTION_DIMENSIONS = [
  { key: 'q2', label: 'Quality' },
  { key: 'q3', label: 'Trust' },
  { key: 'q4', label: 'Innovation' },
  { key: 'q5', label: 'Value' },
  { key: 'q6', label: 'Cultural Relevance' },
  { key: 'q7', label: 'Accessibility' },
  { key: 'q8', label: 'Reliability' },
  { key: 'q9', label: 'Emotional Connection' },
]

function dimScoreColor(score: number) {
  if (score >= 4)   return 'text-green-600'
  if (score >= 3)   return 'text-amber-600'
  return 'text-red-500'
}

function dimBarWidth(score: number) {
  return `${((score - 1) / 4) * 100}%`  // 1-5 → 0-100%
}

function dimBarColor(score: number) {
  if (score >= 4)   return 'bg-green-500'
  if (score >= 3)   return 'bg-amber-400'
  return 'bg-red-400'
}

// ── Perception Audit Section ─────────────────────────────────────────────────
async function PerceptionAuditSection() {
  const supabase = await createClient()

  // Fetch all perception audit surveys
  const { data: surveys } = await supabase
    .from('surveys')
    .select('id, name, status, created_at')
    .eq('type', 'perception_audit')
    .order('created_at', { ascending: false })

  // Count responses per survey
  const surveyIds = (surveys ?? []).map(s => s.id)
  const { data: responseRows } = surveyIds.length > 0
    ? await supabase
        .from('survey_responses')
        .select('survey_id, answers')
        .in('survey_id', surveyIds)
        .eq('quality_flag', 'ok')
    : { data: null }

  const countMap: Record<string, number> = {}
  const answersMap: Record<string, Record<string, number[]>> = {}

  for (const r of responseRows ?? []) {
    const sid = r.survey_id
    countMap[sid] = (countMap[sid] ?? 0) + 1

    const answers = r.answers as Record<string, unknown>
    if (!answersMap[sid]) answersMap[sid] = {}
    for (const dim of PERCEPTION_DIMENSIONS) {
      const val = answers[dim.key]
      if (typeof val === 'number' && val >= 1 && val <= 5) {
        if (!answersMap[sid][dim.key]) answersMap[sid][dim.key] = []
        answersMap[sid][dim.key].push(val)
      }
    }
  }

  // Aggregate scores across all perception_audit surveys
  const globalAnswers: Record<string, number[]> = {}
  for (const dimAnswers of Object.values(answersMap)) {
    for (const [key, vals] of Object.entries(dimAnswers)) {
      if (!globalAnswers[key]) globalAnswers[key] = []
      globalAnswers[key].push(...vals)
    }
  }

  const totalResponses = (responseRows ?? []).length
  const hasDimensionData = totalResponses >= 2

  const dimensionScores = PERCEPTION_DIMENSIONS.map(dim => {
    const vals = globalAnswers[dim.key] ?? []
    const avg  = vals.length > 0
      ? vals.reduce((s, v) => s + v, 0) / vals.length
      : null
    return { ...dim, avg, count: vals.length }
  })

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Perception Audit</h2>
          {totalResponses > 0 && (
            <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
              {totalResponses} {totalResponses === 1 ? 'response' : 'responses'}
            </span>
          )}
        </div>
        <LaunchPerceptionAuditButton />
      </div>

      {/* Dimension scores panel */}
      <div className="border rounded-xl bg-card overflow-hidden">
        {hasDimensionData ? (
          <>
            <div className="px-5 py-3 border-b">
              <p className="text-xs text-muted-foreground">
                Average scores across {totalResponses} responses · Scale 1–5
              </p>
            </div>
            <div className="divide-y">
              {dimensionScores.map(dim => (
                <div key={dim.key} className="flex items-center gap-4 px-5 py-3">
                  <p className="text-sm w-36 shrink-0">{dim.label}</p>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    {dim.avg != null && (
                      <div
                        className={`h-full rounded-full ${dimBarColor(dim.avg)}`}
                        style={{ width: dimBarWidth(dim.avg) }}
                      />
                    )}
                  </div>
                  <span className={`text-sm font-semibold tabular-nums w-8 text-right shrink-0 ${dim.avg != null ? dimScoreColor(dim.avg) : 'text-muted-foreground/40'}`}>
                    {dim.avg != null ? dim.avg.toFixed(1) : '—'}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="p-8 text-center space-y-2">
            <BarChart2 className="h-8 w-8 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">No perception audit responses yet</p>
            <p className="text-xs text-muted-foreground/60">
              Launch a Perception Audit survey to start measuring your brand across 8 dimensions.
            </p>
          </div>
        )}
      </div>

      {/* Survey list */}
      {(surveys ?? []).length > 0 && (
        <div className="border rounded-xl divide-y overflow-hidden">
          {(surveys ?? []).map(s => {
            const count = countMap[s.id] ?? 0
            const isLive = s.status === 'live' || s.status === 'active'
            return (
              <Link
                key={s.id}
                href={`/dashboard/surveys/${s.id}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/50 transition-colors group"
              >
                <div className="space-y-0.5 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:underline">{s.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3 shrink-0" />
                    {new Date(s.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4 shrink-0">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {count} {count === 1 ? 'response' : 'responses'}
                  </div>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    isLive
                      ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
                      : s.status === 'draft'
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-muted text-muted-foreground'
                  }`}>
                    {isLive && <CheckCircle2 className="h-3 w-3" />}
                    {s.status}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── All Surveys List ─────────────────────────────────────────────────────────
async function SurveyListServer() {
  const supabase = await createClient()

  const { data: surveys } = await supabase
    .from('surveys')
    .select('id, name, type, status, created_at')
    .neq('type', 'perception_audit')  // exclude perception audits — shown in their own section
    .order('created_at', { ascending: false })

  if (!surveys?.length) {
    return (
      <div className="border rounded-xl p-12 text-center space-y-2">
        <MessageSquare className="h-8 w-8 text-muted-foreground/40 mx-auto" />
        <p className="text-sm font-medium">No surveys yet</p>
        <p className="text-xs text-muted-foreground">
          Create a B2 intercept survey and share the link with your audience.
        </p>
      </div>
    )
  }

  const { data: allResponses } = await supabase
    .from('survey_responses')
    .select('survey_id')
    .in('survey_id', surveys.map(s => s.id))

  const countMap = (allResponses ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.survey_id] = (acc[r.survey_id] ?? 0) + 1
    return acc
  }, {})

  const surveysWithCounts = surveys.map(s => ({
    ...s,
    responseCount: countMap[s.id] ?? 0,
  }))

  return <SurveysList surveys={surveysWithCounts} appUrl={APP_URL} />
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function SurveysPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Surveys</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Collect direct feedback from your audience
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/surveys/nps"
            className={buttonVariants({ size: 'sm', variant: 'outline' })}
          >
            <TrendingUp className="h-4 w-4 mr-1.5" />
            NPS Tracker
          </Link>
          <NewSurveyDialog />
        </div>
      </div>

      {/* Perception Audit section */}
      <Suspense fallback={<Skeleton className="h-72 rounded-xl" />}>
        <PerceptionAuditSection />
      </Suspense>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <p className="text-xs text-muted-foreground shrink-0">All other surveys</p>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* General surveys list */}
      <Suspense fallback={<Skeleton className="h-48 rounded-xl" />}>
        <SurveyListServer />
      </Suspense>
    </div>
  )
}
