import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { InfluencersClient } from './influencers-client'

export const dynamic = 'force-dynamic'

export default async function InfluencersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: brand } = await supabase
    .from('brands')
    .select('id, name')
    .limit(1)
    .single()

  if (!brand) redirect('/onboarding')

  const { data: influencers } = await supabase
    .from('influencers')
    .select('id, brand_id, name, handle, platform, category, followers, cultural_iq, risk_score, ai_notes, status, campaign_id, created_at, updated_at')
    .eq('brand_id', brand.id)
    .order('created_at', { ascending: false })

  return (
    <InfluencersClient
      brandId={brand.id}
      brandName={brand.name}
      initialInfluencers={influencers ?? []}
    />
  )
}
