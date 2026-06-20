import { createClient } from '@/lib/supabase/server'
import { SurveyPanelsClient } from './panels-client'

export default async function SurveyPanelsPage() {
  const supabase = await createClient()

  const { data: brand } = await supabase.from('brands').select('id, name').limit(1).single()

  const { data: panels } = await supabase
    .from('survey_panels')
    .select('*')
    .eq('brand_id', brand?.id ?? '')
    .order('created_at', { ascending: false })

  return (
    <SurveyPanelsClient
      brandName={brand?.name ?? 'Your brand'}
      initialPanels={panels ?? []}
    />
  )
}
