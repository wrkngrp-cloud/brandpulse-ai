import { Suspense }     from 'react'
import { createClient } from '@/lib/supabase/server'
import { Skeleton }     from '@/components/ui/skeleton'
import { NewSurveyDialog } from './new-survey-dialog'
import { SurveysList }  from '@/components/surveys/surveys-list'
import { MessageSquare, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

const APP_URL = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

async function SurveyListServer() {
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
      <Suspense fallback={<Skeleton className="h-48 rounded-xl" />}>
        <SurveyListServer />
      </Suspense>
    </div>
  )
}
