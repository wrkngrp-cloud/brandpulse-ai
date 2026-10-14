import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }       from '@/lib/supabase/server'
import { recordVisit, withUtm }      from '@/lib/tools/offline-tracker'
import type { CampaignType }         from '@/lib/tools/campaign-labels'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const supabase  = await createServiceClient()

  // ── 1. Check print_placements first ──────────────────────────────────────
  const { data: placement } = await supabase
    .from('print_placements')
    .select('id, brand_id, attribution_url')
    .eq('vanity_slug', slug)
    .maybeSingle()

  if (placement?.attribution_url) {
    const printUa         = request.headers.get('user-agent') ?? ''
    const printDeviceType = /mobile|android|iphone|ipad/i.test(printUa) ? 'mobile'
      : /tablet/i.test(printUa) ? 'tablet' : 'desktop'
    const printIpRegion = request.headers.get('x-vercel-ip-country-region')
      ?? request.headers.get('cf-ipcountry')
      ?? null

    await Promise.allSettled([
      supabase.from('print_visits').insert({
        placement_id: placement.id,
        brand_id:     placement.brand_id,
        ip_region:    printIpRegion,
        device_type:  printDeviceType,
        referrer:     request.headers.get('referer') ?? null,
      }),
      supabase.rpc('increment_print_scans', { placement_id: placement.id }),
    ])

    return NextResponse.redirect(placement.attribution_url, 302)
  }

  // ── 2. Free Offline Campaign Tracker placements ───────────────────────────
  // Third in the order, after the two that predate it. A slug here is printed
  // on a billboard or a flyer and can never be reissued, so mintSlug checks
  // all three tables before handing one out.
  const { data: toolPlacement } = await supabase
    .from('tool_placements')
    .select('id, campaign_id, slug, utm_content, tool_campaigns!inner(id, name, destination_url, campaign_type, response_enabled)')
    .eq('slug', slug)
    .maybeSingle()

  if (toolPlacement) {
    const campaign = (toolPlacement as unknown as {
      tool_campaigns: {
        id: string; name: string; destination_url: string
        campaign_type: CampaignType; response_enabled: boolean
      }
    }).tool_campaigns

    const ua = request.headers.get('user-agent') ?? ''
    const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
      || request.headers.get('x-real-ip') || 'unknown'
    const region = request.headers.get('x-vercel-ip-country-region')
      ?? request.headers.get('cf-ipcountry')
      ?? null

    // Awaited, not fired and forgotten: on a serverless platform the process
    // exits with the response and the write is lost. The same reason the OOH
    // branch below awaits its own.
    await recordVisit({
      placementId: toolPlacement.id,
      campaignId:  campaign.id,
      slug:        toolPlacement.slug,
      ip, userAgent: ua,
      referrer:    request.headers.get('referer') ?? null,
      ipRegion:    region,
    })

    /* With response capture switched on, the campaign's own page comes first
       and carries the destination as its primary action. The placement rides
       along in the query so a form submission can be attributed to the
       billboard it came from. Off by default, because the owner chose the
       destination and we do not get to interpose on it uninvited. */
    const destination = campaign.response_enabled
      ? `${request.nextUrl.origin}/respond/${campaign.id}?p=${encodeURIComponent(toolPlacement.slug)}`
      : withUtm(campaign.destination_url, {
          campaignType: campaign.campaign_type,
          campaignName: campaign.name,
          placementUtm: toolPlacement.utm_content,
        })

    return NextResponse.redirect(destination, 302)
  }

  // ── 3. Fall through to existing OOH redirect logic ────────────────────────
  const { data: site } = await supabase
    .from('ooh_sites')
    .select('id, brand_id, landing_url')
    .eq('vanity_slug', slug)
    .maybeSingle()

  if (!site?.landing_url) {
    return NextResponse.redirect(new URL('/', request.url), 302)
  }

  const ua         = request.headers.get('user-agent') ?? ''
  const deviceType = /mobile|android|iphone|ipad/i.test(ua) ? 'mobile'
    : /tablet/i.test(ua) ? 'tablet' : 'desktop'

  const ipRegion = request.headers.get('x-vercel-ip-country-region')
    ?? request.headers.get('cf-ipcountry')
    ?? null
  const geoLatStr  = request.headers.get('x-vercel-ip-latitude')
  const geoLngStr  = request.headers.get('x-vercel-ip-longitude')
  const geoCity    = request.headers.get('x-vercel-ip-city') ?? null
  const geoLat     = geoLatStr  ? parseFloat(geoLatStr)  : null
  const geoLng     = geoLngStr  ? parseFloat(geoLngStr)  : null

  const sp           = request.nextUrl.searchParams
  const utmSource    = sp.get('utm_source')
  const utmMedium    = sp.get('utm_medium')
  const utmCampaign  = sp.get('utm_campaign')
  const utmContent   = sp.get('utm_content')

  // Forward UTM params to landing page
  let destination = site.landing_url
  try {
    const url = new URL(destination)
    if (utmSource)   url.searchParams.set('utm_source',   utmSource)
    if (utmMedium)   url.searchParams.set('utm_medium',   utmMedium)
    if (utmCampaign) url.searchParams.set('utm_campaign', utmCampaign)
    if (utmContent)  url.searchParams.set('utm_content',  utmContent)
    destination = url.toString()
  } catch {
    // landing_url may be relative — send as-is
  }

  // Log visit + increment counter before redirecting so the serverless function
  // doesn't get killed before the DB writes complete (void fire-and-forget is
  // unreliable on Vercel edge — the process exits with the response).
  await Promise.allSettled([
    supabase.from('ooh_visits').insert({
      site_id:              site.id,
      brand_id:             site.brand_id,
      ip_region:            ipRegion,
      device_type:          deviceType,
      referrer:             request.headers.get('referer') ?? null,
      utm_source:           utmSource,
      utm_medium:           utmMedium,
      utm_campaign:         utmCampaign,
      utm_content:          utmContent,
      geo_lat:              geoLat,
      geo_lng:              geoLng,
      geo_city:             geoCity,
      geo_state:            ipRegion,
      matched_site_id:      site.id,
      attribution_method:   'branded_link',
      attribution_confidence: 0.95,
    }),
    supabase.rpc('increment_ooh_visits', { site_id: site.id }),
  ])

  // 302 so browsers never cache the redirect — every visit hits the server.
  return NextResponse.redirect(destination, 302)
}
