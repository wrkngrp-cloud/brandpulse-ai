import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { StatusToggle }   from './status-toggle'
import { CopyLinkButton } from './copy-link-button'
import { SurveyAiAnalysis } from './ai-analysis'
import { SendSurvey }     from './send-survey'
import { Badge } from '@/components/ui/badge'

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'

const STATUS_COLOURS: Record<string, string> = {
  draft:  'bg-muted text-muted-foreground',
  live:   'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
  closed: 'bg-muted text-muted-foreground',
}

async function getAwarenessBreakdown(answers: Record<string, unknown>[]) {
  const counts: Record<string, number> = {}
  for (const a of answers) {
    const val = (a as Record<string, Record<string, unknown>>).answers?.q1 as string | undefined
    if (val) counts[val] = (counts[val] ?? 0) + 1
  }
  return counts
}

function npsAverage(responses: { answers: Record<string, unknown> }[]) {
  const scores = responses
    .map(r => r.answers?.q2 as number | undefined)
    .filter((s): s is number => typeof s === 'number')
  if (!scores.length) return null
  return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
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
    .select('id, name, status, questions, created_at, deploy_channels')
    .eq('id', id)
    .single()

  if (!survey) notFound()

  const { data: responses } = await supabase
    .from('survey_responses')
    .select('id, answers, quality_flag, source, collected_at')
    .eq('survey_id', id)
    .order('collected_at', { ascending: false })

  const allResponses = responses ?? []
  const okResponses = allResponses.filter(r => r.quality_flag === 'ok')
  const avgNps = npsAverage(okResponses as { answers: Record<string, unknown> }[])
  const awarenessBreakdown = await getAwarenessBreakdown(
    okResponses.map(r => ({ answers: r.answers as Record<string, unknown> }))
  )
  const shareUrl = `${APP_URL}/survey/${survey.id}`

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{survey.name}</h1>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOURS[survey.status] ?? ''}`}>
              {survey.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            B2 intercept · created {new Date(survey.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
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
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-xl p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Total responses</p>
          <p className="text-2xl font-bold">{allResponses.length}</p>
          {allResponses.length !== okResponses.length && (
            <p className="text-xs text-muted-foreground">{okResponses.length} quality</p>
          )}
        </div>
        <div className="border rounded-xl p-4 space-y-1">
          <p className="text-xs text-muted-foreground">NPS average</p>
          <p className="text-2xl font-bold">{avgNps ?? '—'}</p>
          <p className="text-xs text-muted-foreground">out of 10</p>
        </div>
        <div className="border rounded-xl p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Top source</p>
          <p className="text-sm font-semibold truncate">
            {Object.keys(awarenessBreakdown).length
              ? Object.entries(awarenessBreakdown).sort((a, b) => b[1] - a[1])[0][0]
              : '—'}
          </p>
        </div>
      </div>

      {/* Awareness breakdown */}
      {Object.keys(awarenessBreakdown).length > 0 && (
        <div className="border rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium">How people heard about you</p>
          <div className="space-y-2">
            {Object.entries(awarenessBreakdown)
              .sort((a, b) => b[1] - a[1])
              .map(([label, count]) => {
                const pct = Math.round((count / okResponses.length) * 100)
                return (
                  <div key={label} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">{count} ({pct}%)</span>
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

      {/* Responses table */}
      {allResponses.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Responses</p>
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Date</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Heard via</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">NPS</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Quality</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {allResponses.map(r => (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                      {new Date(r.collected_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="px-4 py-2.5 max-w-[180px] truncate">
                      {(r.answers as Record<string, unknown>)?.q1 as string ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 font-medium">
                      {(r.answers as Record<string, unknown>)?.q2 !== undefined
                        ? String((r.answers as Record<string, unknown>).q2)
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.quality_flag === 'ok'
                        ? <span className="text-green-600">ok</span>
                        : <span className="text-amber-500">{r.quality_flag}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
