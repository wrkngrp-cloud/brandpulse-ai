import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { SurveyForm, type SurveyQuestion } from './survey-form'

export default async function SurveyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const { id } = await params
  const sp = await searchParams
  const source = sp.source ?? 'link'

  const supabase = await createServiceClient()

  const { data: survey } = await supabase
    .from('surveys')
    .select('id, name, questions, status, brand_id')
    .eq('id', id)
    .single()

  if (!survey) notFound()

  if (survey.status !== 'live') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="text-base font-medium">This survey is no longer active.</p>
          <p className="text-sm text-muted-foreground">Thank you for your interest.</p>
        </div>
      </div>
    )
  }

  const { data: brand } = await supabase
    .from('brands')
    .select('name')
    .eq('id', survey.brand_id)
    .single()

  const brandName = brand?.name ?? ''

  const questions = (survey.questions as SurveyQuestion[]).map(q => ({
    ...q,
    text: q.text.replace(/\{brand\}/g, brandName),
  }))

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <SurveyForm
        surveyId={survey.id}
        brandName={brandName}
        questions={questions}
        source={source}
      />
    </div>
  )
}
