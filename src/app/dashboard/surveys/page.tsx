import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { NewSurveyDialog } from './new-survey-dialog'
import Link from 'next/link'
import { MessageSquare } from 'lucide-react'

const STATUS_BADGE: Record<string, string> = {
  draft:  'bg-muted text-muted-foreground',
  live:   'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
  closed: 'bg-muted text-muted-foreground',
}

async function SurveyList() {
  const supabase = await createClient()

  const { data: surveys } = await supabase
    .from('surveys')
    .select('id, name, type, status, created_at')
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

  const surveyIds = surveys.map(s => s.id)
  const { data: allResponses } = await supabase
    .from('survey_responses')
    .select('survey_id')
    .in('survey_id', surveyIds)

  const countMap = (allResponses ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.survey_id] = (acc[r.survey_id] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="border rounded-xl divide-y overflow-hidden">
      {surveys.map(survey => (
        <Link
          key={survey.id}
          href={`/dashboard/surveys/${survey.id}`}
          className="flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors"
        >
          <div className="space-y-0.5 min-w-0">
            <p className="text-sm font-medium truncate">{survey.name}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(survey.created_at).toLocaleDateString('en-NG', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </p>
          </div>
          <div className="flex items-center gap-3 ml-4 shrink-0">
            <span className="text-xs text-muted-foreground">
              {countMap[survey.id] ?? 0} {(countMap[survey.id] ?? 0) === 1 ? 'response' : 'responses'}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[survey.status] ?? ''}`}>
              {survey.status}
            </span>
          </div>
        </Link>
      ))}
    </div>
  )
}

export default function SurveysPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Surveys</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Collect direct feedback from your audience
          </p>
        </div>
        <NewSurveyDialog />
      </div>
      <Suspense fallback={<Skeleton className="h-48 rounded-xl" />}>
        <SurveyList />
      </Suspense>
    </div>
  )
}
