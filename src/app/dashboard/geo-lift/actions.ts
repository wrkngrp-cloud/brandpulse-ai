'use server'

import { createClient }       from '@/lib/supabase/server'
import { inngest }            from '@/lib/inngest/client'

interface StartStudyInput {
  brandId:       string
  campaignId:    string | null
  treatmentCity: string
  controlCity:   string
  keyword:       string
  studyStart:    string
  studyEnd:      string
}

interface StartStudyResult {
  studyId?: string
  error?:   string
}

export async function startGeoLiftStudy(
  input: StartStudyInput,
): Promise<StartStudyResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { brandId, campaignId, treatmentCity, controlCity, keyword, studyStart, studyEnd } = input

  if (treatmentCity === controlCity) {
    return { error: 'Treatment and control cities must be different.' }
  }

  if (!keyword.trim()) {
    return { error: 'Keyword is required.' }
  }

  // Create the study record in pending state
  const { data: study, error } = await supabase
    .from('geo_lift_studies')
    .insert({
      brand_id:       brandId,
      campaign_id:    campaignId ?? null,
      treatment_city: treatmentCity,
      control_city:   controlCity,
      keyword:        keyword.trim(),
      study_start:    studyStart,
      study_end:      studyEnd,
      status:         'pending',
    })
    .select('id')
    .single()

  if (error || !study) {
    return { error: error?.message ?? 'Failed to create study.' }
  }

  // Fire the Inngest event
  await inngest.send({
    name: 'brandpulse/geo-lift.study-requested',
    data: {
      studyId:       study.id,
      brandId,
      campaignId:    campaignId ?? null,
      treatmentCity,
      controlCity,
      keyword:       keyword.trim(),
      studyStart,
      studyEnd,
    },
  })

  return { studyId: study.id }
}
