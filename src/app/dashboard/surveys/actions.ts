'use server'

import { createClient } from '@/lib/supabase/server'
import { getActiveBrandId } from '@/lib/active-brand'
import { revalidatePath } from 'next/cache'
import { TEMPLATE_MAP, type SurveyType } from '@/lib/survey-templates'

export async function createSurvey(name: string, templateId: SurveyType = 'b2_intercept') {
  const supabase = await createClient()

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) throw new Error('Set up a brand before you create a survey.')

  const template = TEMPLATE_MAP[templateId]
  if (!template) throw new Error('Invalid template')

  const { data, error } = await supabase
    .from('surveys')
    .insert({
      brand_id:        brandId,
      name,
      type:            templateId,
      questions:       template.questions,
      deploy_channels: ['link', 'in-app', 'email'],
      status:          'draft',
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
