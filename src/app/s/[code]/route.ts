import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }       from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params
  const supabase  = await createServiceClient()

  const { data: site } = await supabase
    .from('ooh_sites')
    .select('id, brand_id, landing_url')
    .eq('short_code', code)
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

  const sp          = request.nextUrl.searchParams
  const utmSource   = sp.get('utm_source')
  const utmMedium   = sp.get('utm_medium')
  const utmCampaign = sp.get('utm_campaign')
  const utmContent  = sp.get('utm_content')

  let destination = site.landing_url
  try {
    const url = new URL(destination)
    if (utmSource)   url.searchParams.set('utm_source',   utmSource)
    if (utmMedium)   url.searchParams.set('utm_medium',   utmMedium)
    if (utmCampaign) url.searchParams.set('utm_campaign', utmCampaign)
    if (utmContent)  url.searchParams.set('utm_content',  utmContent)
    destination = url.toString()
  } catch { /* relative URL — send as-is */ }

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

  return NextResponse.redirect(destination, 302)
}
