'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const B2_QUESTIONS = [
  {
    id: 'q1',
    type: 'single_choice',
    text: 'How did you first hear about {brand}?',
    required: true,
    options: [
      'Social media (Instagram, X or TikTok)',
      'Friend or family',
      'Online search',
      'TV, radio or billboard',
      'Other',
    ],
  },
  {
    id: 'q2',
    type: 'nps',
    text: 'How likely are you to recommend {brand} to a friend or colleague?',
    required: true,
  },
]

export async function createSurvey(name: string) {
  const supabase = await createClient()

  const { data: brand } = await supabase
    .from('brands')
    .select('id')
    .limit(1)
    .single()

  if (!brand) throw new Error('No brand found')

  const { data, error } = await supabase
    .from('surveys')
    .insert({
      brand_id: brand.id,
      name,
      type: 'b2_intercept',
      questions: B2_QUESTIONS,
      deploy_channels: ['link', 'in-app', 'email'],
      status: 'draft',
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/surveys')
  return data.id
}

export async function updateSurveyStatus(surveyId: string, status: 'live' | 'closed') {
  const supabase = await createClient()

  const { error } = await supabase
    .from('surveys')
    .update({ status })
    .eq('id', surveyId)

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/surveys')
  revalidatePath(`/dashboard/surveys/${surveyId}`)
}

export async function deleteSurvey(surveyId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('surveys')
    .delete()
    .eq('id', surveyId)

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/surveys')
}
