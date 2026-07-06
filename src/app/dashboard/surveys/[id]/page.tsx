import { createClient }  from '@/lib/supabase/server'
import { notFound }       from 'next/navigation'
import Link               from 'next/link'
import { ArrowLeft }      from 'lucide-react'
import { StatusToggle }   from './status-toggle'
import { CopyLinkButton } from './copy-link-button'
import { SurveyAiAnalysis } from './ai-analysis'
import { SendSurvey }     from './send-survey'
import { getTemplateLabel } from '@/lib/survey-templates'
import type { SurveyQuestion } from '@/lib/survey-templates'

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'

const STATUS_COLOURS: Record<string, string> = {
  draft:  'bg-muted text-muted-foreground',
  live:   'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
  closed: 'bg-muted text-muted-foreground',
}

// Summarise an answer value for display in the table
function fmtAnswer(val: unknown): string {
  if (val === undefined || val === null) return '—'
  if (typeof val === 'number') return String(val)
  if (typeof val === 'string') return val.slice(0, 80) + (val.length > 80 ? '…' : '')
  return String(val)
}

export default async function SurveyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: survey } = await supabase
    .from('surveys')
    .select('id, name, type, status, questions, created_at, deploy_channels')
    .eq('id', id)
    .single()

  if (!survey) notFound()

  const questions = (survey.questions ?? []) as SurveyQuestion[]

  const { data: responses } = await supabase
    .from('survey_responses')
    .select('id, answers, quality_flag, source, collected_at')
    .eq('survey_id', id)
    .order('collected_at', { ascending: false })

  const allResponses = responses ?? []
  const okResponses  = allResponses.filter(r => r.quality_flag === 'ok')
  const shareUrl     = `${APP_URL}/survey/${survey.id}`
  const templateLabel = getTemplateLabel(survey.type ?? '')

  // NPS question is whichever question has type 'nps'
  const npsQuestion = questions.find(q => q.type === 'nps')
  const npsScores   = okResponses
    .map(r => (r.answers as Record<string, unknown>)?.[npsQuestion?.id ?? ''] as number | undefined)
    .filter((s): s is number => typeof s === 'number')
  const avgNps = npsScores.length
    ? (npsScores.reduce((a, b) => a + b, 0) / npsScores.length).toFixed(1)
    : null

  // Discovery source = the first single_choice question (usually q1 asking how they heard)
  const sourceQuestion = questions.find(q => q.type === 'single_choice')
  const sourceBreakdown: Record<string, number> = {}
  if (sourceQuestion) {
    for (const r of okResponses) {
      const val = (r.answers as Record<string, unknown>)?.[sourceQuestion.id] as string | undefined
      if (val) sourceBreakdown[val] = (sourceBreakdown[val] ?? 0) + 1
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back */}
      <Link
        href="/dashboard/surveys"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Surveys
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">{survey.name}</h1>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLOURS[survey.status] ?? ''}`}>
              {survey.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {templateLabel} · created {new Date(survey.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' })}
          </p>
        </div>
        <StatusToggle surveyId={survey.id} status={survey.status} />
      </div>

      {/* Shareable link */}
      <div className="border rounded-xl p-4 space-y-2">
        <p className="text-sm font-medium">Shareable link</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-md truncate">{shareUrl}</code>
          <CopyLinkButton url={shareUrl} />
        </div>
        <p className="text-xs text-muted-foreground">
          Drop this link into Instagram bio, social posts, or embed anywhere your audience is.
        </p>
      </div>

      {/* Send survey */}
      <SendSurvey surveyId={survey.id} surveyName={survey.name} shareUrl={shareUrl} />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="border rounded-xl p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Total responses</p>
          <p className="text-2xl font-bold">{allResponses.length}</p>
          {allResponses.length !== okResponses.length && (
            <p className="text-xs text-muted-foreground">{okResponses.length} quality</p>
          )}
        </div>
        {npsQuestion && (
          <div className="border rounded-xl p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Avg NPS score</p>
            <p className="text-2xl font-bold">{avgNps ?? '—'}</p>
            <p className="text-xs text-muted-foreground">out of 10</p>
          </div>
        )}
        {sourceQuestion && Object.keys(sourceBreakdown).length > 0 && (
          <div className="border rounded-xl p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Top source</p>
            <p className="text-sm font-semibold line-clamp-2">
              {Object.entries(sourceBreakdown).sort((a, b) => b[1] - a[1])[0][0]}
            </p>
          </div>
        )}
      </div>

      {/* Source breakdown */}
      {sourceQuestion && Object.keys(sourceBreakdown).length > 0 && (
        <div className="border rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium">{sourceQuestion.text.replace('{brand}', 'your brand')}</p>
          <div className="space-y-2">
            {Object.entries(sourceBreakdown)
              .sort((a, b) => b[1] - a[1])
              .map(([label, count]) => {
                const pct = Math.round((count / okResponses.length) * 100)
                return (
                  <div key={label} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground truncate max-w-[70%]">{label}</span>
                      <span className="font-medium shrink-0">{count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-foreground rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Response feed — shows all questions generically */}
      {allResponses.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Responses ({allResponses.length})</p>
          <div className="space-y-3">
            {allResponses.slice(0, 50).map(r => {
              const ans = r.answers as Record<string, unknown>
              return (
                <div key={r.id} className="border rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>{new Date(r.collected_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' })}</span>
                    <div className="flex items-center gap-2">
                      {r.source && <span className="bg-muted px-1.5 py-0.5 rounded">{r.source}</span>}
                      <span className={r.quality_flag === 'ok' ? 'text-green-600' : 'text-amber-500'}>
                        {r.quality_flag}
                      </span>
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    {questions.map(q => {
                      const val = ans[q.id]
                      if (val === undefined) return null
                      return (
                        <div key={q.id} className="flex gap-2 text-xs">
                          <span className="text-muted-foreground shrink-0 w-24 truncate" title={q.text.replace('{brand}', 'brand')}>
                            {q.text.replace('{brand}', 'brand').slice(0, 30)}{q.text.length > 30 ? '…' : ''}
                          </span>
                          <span className="font-medium">{fmtAnswer(val)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            {allResponses.length > 50 && (
              <p className="text-xs text-muted-foreground text-center">Showing 50 of {allResponses.length} responses</p>
            )}
          </div>
        </div>
      )}

      {allResponses.length === 0 && survey.status === 'live' && (
        <div className="border rounded-xl p-8 text-center text-sm text-muted-foreground">
          No responses yet. Share the link above to start collecting feedback.
        </div>
      )}

      <SurveyAiAnalysis surveyId={survey.id} responseCount={okResponses.length} />
    </div>
  )
}
