import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getActiveBrand } from '@/lib/active-brand'
import { SurveyPanelsClient } from './panels-client'

export default async function SurveyPanelsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const brand = await getActiveBrand<{ id: string; name: string }>(supabase, 'id, name')

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
