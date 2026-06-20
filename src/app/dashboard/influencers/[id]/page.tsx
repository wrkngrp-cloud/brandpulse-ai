import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { InfluencerDetailClient } from './influencer-detail-client'

export const dynamic = 'force-dynamic'

export default async function InfluencerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, category')
    .limit(1)
    .single()

  if (!brand) redirect('/onboarding')

  const [
    { data: influencer },
    { data: posts },
    { data: campaigns },
  ] = await Promise.all([
    supabase
      .from('influencers')
      .select('id, brand_id, name, handle, platform, category, followers, cultural_iq, risk_score, ai_notes, status, campaign_id, profile_url, social_urls, profile_data, brand_fit, created_at, updated_at')
      .eq('id', id)
      .eq('brand_id', brand.id)
      .single(),
    supabase
      .from('influencer_posts')
      .select('*')
      .eq('influencer_id', id)
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('campaigns')
      .select('id, name, status')
      .eq('brand_id', brand.id)
      .in('status', ['draft', 'active', 'paused'])
      .order('created_at', { ascending: false }),
  ])

  if (!influencer) notFound()

  return (
    <InfluencerDetailClient
      influencer={influencer}
      initialPosts={posts ?? []}
      campaigns={campaigns ?? []}
      brandCategory={brand.category ?? null}
    />
  )
}
