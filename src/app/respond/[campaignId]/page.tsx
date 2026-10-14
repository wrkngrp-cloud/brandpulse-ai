import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase/server'
import { withUtm } from '@/lib/tools/offline-tracker'
import type { CampaignType } from '@/lib/tools/campaign-labels'
import { RespondForm } from './respond-form'

export const dynamic = 'force-dynamic'

/**
 * The campaign response page.
 *
 * Public, reached from a printed QR code when the campaign owner has turned
 * response capture on. Service-role read of one campaign by id, which is the
 * same shape as the survey and ambassador pages: the id in the path is the
 * token, and the only fields read are the ones meant to be shown in public.
 *
 * It never lists responses, so an enquiry someone else left cannot be read
 * from here. Those rows are personal data and belong to the workspace.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function RespondPage({
  params, searchParams,
}: {
  params: Promise<{ campaignId: string }>
  searchParams: Promise<{ p?: string }>
}) {
  const { campaignId } = await params
  const { p } = await searchParams

  const svc = await createServiceClient()
  const { data: campaign } = await svc
    .from('tool_campaigns')
    .select('id, name, campaign_type, destination_url, response_enabled, response_headline, response_blurb, brand_id')
    .eq('id', campaignId)
    .maybeSingle()

  if (!campaign || !campaign.response_enabled || !campaign.brand_id) notFound()

  // The brand's own name and logo, so the page reads as theirs rather than
  // as ours. Nothing else about the brand is exposed.
  const { data: brand } = await svc
    .from('brands').select('name, logo_url').eq('id', campaign.brand_id).maybeSingle()

  let placementName: string | null = null
  if (p) {
    const { data: placement } = await svc
      .from('tool_placements').select('name').eq('campaign_id', campaign.id).eq('slug', p).maybeSingle()
    placementName = placement?.name ?? null
  }

  const destination = withUtm(campaign.destination_url, {
    campaignType: campaign.campaign_type as CampaignType,
    campaignName: campaign.name,
    placementUtm: p ?? 'response-page',
  })

  return (
    <RespondForm
      campaignId={campaign.id}
      campaignName={campaign.name}
      brandName={brand?.name ?? null}
      brandLogo={brand?.logo_url ?? null}
      headline={campaign.response_headline}
      blurb={campaign.response_blurb}
      destination={destination}
      placementSlug={p ?? null}
      placementName={placementName}
    />
  )
}
