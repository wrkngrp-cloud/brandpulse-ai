import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { InfluencersClient } from './influencers-client'
import { InfluencerRoiTracker } from '@/components/influencers/roi-tracker'
import { getActiveBrand } from '@/lib/active-brand'

export const dynamic = 'force-dynamic'

export default async function InfluencersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const brand = await getActiveBrand<{ id: string; name: string }>(supabase, 'id, name')

  if (!brand) redirect('/onboarding')

  const [{ data: influencers }, { data: campaigns }, { data: roiCampaigns }] = await Promise.all([
    supabase
      .from('influencers')
      .select('id, brand_id, name, handle, platform, category, followers, cultural_iq, risk_score, ai_notes, status, campaign_id, created_at, updated_at')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('campaigns')
      .select('id, name, status')
      .eq('brand_id', brand.id)
      .in('status', ['draft', 'active', 'paused'])
      .order('created_at', { ascending: false }),
    supabase
      .from('influencer_campaigns')
      .select('id, name, reach, impressions, engagements, emv, fee, currency, attributed_clicks, attributed_conversions, promo_code, utm_campaign, created_at')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: false }),
  ])

  return (
    <div className="space-y-10">
      <InfluencersClient
        brandId={brand.id}
        brandName={brand.name}
        initialInfluencers={influencers ?? []}
        campaigns={campaigns ?? []}
      />

      <div className="border-t pt-8">
        <InfluencerRoiTracker initialCampaigns={(roiCampaigns ?? []).map(c => ({
          ...c,
          emv: Number(c.emv ?? 0),
          fee: Number(c.fee ?? 0),
          reach: c.reach ?? 0,
          impressions: c.impressions ?? 0,
          engagements: c.engagements ?? 0,
          attributed_clicks: c.attributed_clicks ?? 0,
          attributed_conversions: c.attributed_conversions ?? 0,
        }))} />
      </div>
    </div>
  )
}
