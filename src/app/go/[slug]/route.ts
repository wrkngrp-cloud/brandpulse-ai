import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }       from '@/lib/supabase/server'

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

  // ── 2. Fall through to existing OOH redirect logic ────────────────────────
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
      site_id:      site.id,
      brand_id:     site.brand_id,
      ip_region:    ipRegion,
      device_type:  deviceType,
      referrer:     request.headers.get('referer') ?? null,
      utm_source:   utmSource,
      utm_medium:   utmMedium,
      utm_campaign: utmCampaign,
      utm_content:  utmContent,
    }),
    supabase.rpc('increment_ooh_visits', { site_id: site.id }),
  ])

  // 302 so browsers never cache the redirect — every visit hits the server.
  return NextResponse.redirect(destination, 302)
}
