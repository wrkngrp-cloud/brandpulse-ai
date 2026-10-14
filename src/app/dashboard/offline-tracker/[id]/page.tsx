import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrand } from '@/lib/active-brand'
import { PageHeader } from '@/components/dashboard/page-header'
import { TourTrigger } from '@/components/tours/tour-trigger'
import { QrIcon } from '@/components/brand/icon'
import { trackingUrlFor, withUtm } from '@/lib/tools/offline-tracker'
import type { CampaignType } from '@/lib/tools/campaign-labels'
import { CampaignDetailClient } from './campaign-detail-client'

export const dynamic = 'force-dynamic'

/**
 * One campaign: its placements, what each one brought in, and the enquiries.
 *
 * Every read is through the RLS client, so a campaign id in the URL belonging
 * to another workspace returns nothing and this page 404s. The enquiry rows
 * carry names and phone numbers, and their policy deliberately excludes the
 * lead desk: they belong to the workspace that ran the campaign.
 */
export default async function CampaignDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const brand = await getActiveBrand<{ id: string; name: string }>(supabase, 'id, name')
  if (!brand) redirect('/dashboard')

  const { data: campaign } = await supabase
    .from('tool_campaigns')
    .select('id, name, campaign_type, destination_url, market, response_enabled, response_headline, response_blurb, created_at')
    .eq('id', id)
    .eq('brand_id', brand.id)
    .maybeSingle()

  if (!campaign) notFound()

  const [{ data: placements }, { data: responses }, { data: visits }] = await Promise.all([
    supabase
      .from('tool_placements')
      .select('id, name, slug, utm_content, visits, unique_visits, created_at')
      .eq('campaign_id', campaign.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('tool_responses')
      .select('id, placement_id, name, email, phone, message, wants_callback, consented_at, created_at')
      .eq('campaign_id', campaign.id)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('tool_visits')
      .select('placement_id, device_type, ip_region, is_unique, is_bot, created_at')
      .eq('campaign_id', campaign.id)
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  const withUrls = (placements ?? []).map(p => ({
    ...p,
    trackingUrl: trackingUrlFor(p.slug),
    destinationWithUtm: withUtm(campaign.destination_url, {
      campaignType: campaign.campaign_type as CampaignType,
      campaignName: campaign.name,
      placementUtm: p.utm_content,
    }),
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Campaigns"
        title={campaign.name}
        subtitle="Each placement has its own link and code. What follows is what people actually did with them."
        icon={QrIcon}
        actions={<TourTrigger module="offline_tracker" />}
      />
      <CampaignDetailClient
        brandName={brand.name}
        campaign={{
          id:               campaign.id,
          name:             campaign.name,
          campaignType:     campaign.campaign_type as CampaignType,
          destinationUrl:   campaign.destination_url,
          market:           campaign.market,
          responseEnabled:  campaign.response_enabled,
          responseHeadline: campaign.response_headline,
          responseBlurb:    campaign.response_blurb,
        }}
        placements={withUrls}
        responses={responses ?? []}
        visits={visits ?? []}
      />
    </div>
  )
}
