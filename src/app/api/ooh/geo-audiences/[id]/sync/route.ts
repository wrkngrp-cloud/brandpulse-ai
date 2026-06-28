import { NextRequest, NextResponse }  from 'next/server'
import { createClient }               from '@/lib/supabase/server'
import { getActiveBrand }             from '@/lib/active-brand'
import { decrypt }                    from '@/lib/crypto'

export const runtime = 'nodejs'

const GRAPH = 'https://graph.facebook.com/v21.0'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string }>(supabase, 'id')
  if (!brand) return NextResponse.json({ error: 'No active brand' }, { status: 404 })

  const { id } = await params

  // Load the geo audience + its OOH site
  const { data: audience } = await supabase
    .from('ooh_geo_audiences')
    .select('*, ooh_sites(lat, lng, city)')
    .eq('id', id)
    .eq('brand_id', brand.id)
    .single()

  if (!audience) return NextResponse.json({ error: 'Audience not found' }, { status: 404 })
  if (audience.platform !== 'meta') {
    return NextResponse.json({ error: 'Only Meta sync is supported at this time' }, { status: 400 })
  }

  // Get Meta Ads token
  const { data: adAccount } = await supabase
    .from('digital_ad_accounts')
    .select('access_token, ad_account_id')
    .eq('brand_id', brand.id)
    .eq('platform', 'meta')
    .single()

  if (!adAccount) {
    return NextResponse.json(
      { error: 'Meta Ads not connected. Connect your Meta Ads account in Connectors first.' },
      { status: 400 },
    )
  }

  const token       = decrypt(adAccount.access_token)
  const adAccountId = adAccount.ad_account_id   // e.g. "act_123456789"
  const site        = audience.ooh_sites as { lat: number; lng: number; city: string } | null

  if (!site?.lat || !site?.lng) {
    return NextResponse.json({ error: 'OOH site is missing location coordinates' }, { status: 400 })
  }

  const radiusKm = (audience.fence_radius_m ?? 500) / 1000

  // Mark as syncing
  await supabase
    .from('ooh_geo_audiences')
    .update({ status: 'syncing', status_message: null, updated_at: new Date().toISOString() })
    .eq('id', id)

  try {
    // Call Meta reach estimate API to validate the targeting spec and get audience size
    const targetingSpec = JSON.stringify({
      geo_locations: {
        custom_locations: [{
          latitude:      site.lat,
          longitude:     site.lng,
          radius:        radiusKm,
          distance_unit: 'kilometer',
        }],
      },
    })

    const estimateUrl = new URL(`${GRAPH}/${adAccountId}/reachestimate`)
    estimateUrl.searchParams.set('targeting_spec',    targetingSpec)
    estimateUrl.searchParams.set('optimization_goal', 'IMPRESSIONS')
    estimateUrl.searchParams.set('access_token',      token)
    estimateUrl.searchParams.set('fields',            'users_lower_bound,users_upper_bound,estimate_ready')

    const estimateRes  = await fetch(estimateUrl.toString())
    const estimateData = await estimateRes.json() as {
      data?: { users_lower_bound?: number; users_upper_bound?: number; estimate_ready?: boolean }
      error?: { message: string; code: number }
    }

    if (estimateData.error) {
      await supabase
        .from('ooh_geo_audiences')
        .update({
          status:         'error',
          status_message: estimateData.error.message,
          updated_at:     new Date().toISOString(),
        })
        .eq('id', id)
      return NextResponse.json({ error: estimateData.error.message }, { status: 400 })
    }

    const lower = estimateData.data?.users_lower_bound ?? 0
    const upper = estimateData.data?.users_upper_bound ?? 0
    const reach = Math.round((lower + upper) / 2)

    // Store the targeting spec as the external reference
    const externalRef = `geo:${site.lat},${site.lng},${radiusKm}km`

    await supabase
      .from('ooh_geo_audiences')
      .update({
        status:               'active',
        status_message:       `Estimated reach: ${lower.toLocaleString()}–${upper.toLocaleString()} people`,
        external_audience_id: externalRef,
        estimated_reach:      reach,
        synced_at:            new Date().toISOString(),
        updated_at:           new Date().toISOString(),
      })
      .eq('id', id)

    return NextResponse.json({
      ok:              true,
      estimated_reach: reach,
      lower_bound:     lower,
      upper_bound:     upper,
      targeting_spec:  JSON.parse(targetingSpec),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sync failed'
    await supabase
      .from('ooh_geo_audiences')
      .update({ status: 'error', status_message: msg, updated_at: new Date().toISOString() })
      .eq('id', id)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
