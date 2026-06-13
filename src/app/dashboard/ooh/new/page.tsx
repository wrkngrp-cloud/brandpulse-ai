import { createClient } from '@/lib/supabase/server'
import { redirect }      from 'next/navigation'
import { OohSiteForm }   from '@/components/ooh/ooh-site-form'
import { createSite }    from '../actions'

export default async function NewOohSitePage({
  searchParams,
}: {
  searchParams: Promise<{ campaign_id?: string }>
}) {
  const { campaign_id } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: brand } = await supabase
    .from('brands').select('id, name, ooh_redirect_domain').limit(1).single()
  if (!brand) redirect('/onboarding')

  // Resolve campaign name for display if campaign_id provided
  let campaignName: string | null = null
  if (campaign_id) {
    const { data: campaign } = await supabase
      .from('campaigns').select('name').eq('id', campaign_id).single()
    campaignName = campaign?.name ?? null
  }

  const defaultUrl = process.env.APP_URL ?? 'https://brandpulse-ai-tau.vercel.app'
  const appUrl = brand.ooh_redirect_domain
    ? `https://${brand.ooh_redirect_domain}`
    : defaultUrl

  // Check for an existing in-progress draft for this brand
  const { data: draft } = await supabase
    .from('ooh_sites')
    .select('id, site_name, city, address, vanity_slug, lat, lng, landing_url, format_type, lga, state, daily_traffic, monthly_cost, currency, campaign_start, campaign_end, illuminated, pole_count, short_code, notes, operator, traffic_ai_estimated')
    .eq('brand_id', brand.id)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Add OOH Site</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {campaignName
            ? `Adding to campaign: ${campaignName}`
            : 'Generate a vanity link and UTM to attribute traffic from this site.'}
        </p>
      </div>

      <OohSiteForm
        action={createSite}
        brandName={brand.name}
        appUrl={appUrl}
        customDomain={brand.ooh_redirect_domain ?? null}
        draft={draft ?? null}
        campaignId={campaign_id ?? null}
      />
    </div>
  )
}
