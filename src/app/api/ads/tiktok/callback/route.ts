import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { Redis } from '@upstash/redis'
import { encrypt } from '@/lib/crypto'

export const runtime = 'nodejs'

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'

interface TikTokTokenResponse {
  code:    number
  message: string
  data?: {
    access_token:           string
    access_token_expire_in: number   // seconds from epoch (Unix timestamp)
    refresh_token:          string
    refresh_token_expire_in: number
    scope:                  string
    advertiser_ids:         string[]
  }
}

interface TikTokAdvertiserResponse {
  code:    number
  message: string
  data?: {
    list?: Array<{
      advertiser_id:   string
      advertiser_name: string
      currency:        string
    }>
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code  = searchParams.get('code')   // TikTok calls this auth_code in some docs
  const authCode = searchParams.get('auth_code') ?? code
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error || !authCode || !state) {
    const reason = error ?? 'no_code'
    return NextResponse.redirect(
      `${APP_URL}/dashboard/digital?error=oauth_cancelled&reason=${encodeURIComponent(reason)}`
    )
  }

  const session = await redis.get<{ userId: string; platform: string }>(`adsoauth:${state}`)
  if (!session || session.platform !== 'tiktok') {
    return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=invalid_state`)
  }
  await redis.del(`adsoauth:${state}`)

  const supabase = await createServiceClient()

  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', session.userId)
    .single()

  if (!member) return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=no_workspace`)

  const { data: brand } = await supabase
    .from('brands')
    .select('id')
    .eq('workspace_id', member.workspace_id)
    .single()

  if (!brand) return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=no_brand`)

  try {
    // Exchange auth code for access token
    const tokenRes = await fetch('https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        app_id:     process.env.TIKTOK_ADS_APP_ID!,
        secret:     process.env.TIKTOK_ADS_SECRET!,
        auth_code:  authCode,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      console.error('[tiktok-ads-callback] token exchange HTTP failed:', await tokenRes.text())
      return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=token_exchange_failed`)
    }

    const tokenData = await tokenRes.json() as TikTokTokenResponse
    if (tokenData.code !== 0 || !tokenData.data) {
      console.error('[tiktok-ads-callback] token error:', tokenData.message)
      return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=token_exchange_failed`)
    }

    const { access_token, access_token_expire_in, refresh_token, advertiser_ids } = tokenData.data

    // Token expiry is a Unix timestamp for TikTok
    const tokenExpiry = access_token_expire_in
      ? new Date(access_token_expire_in * 1000).toISOString()
      : null

    // Fetch advertiser info for the first advertiser
    const firstAdvertiserId = advertiser_ids?.[0] ?? null
    let   accountName: string | null = null
    let   currency    = 'NGN'

    if (firstAdvertiserId) {
      const advRes = await fetch(
        `https://business-api.tiktok.com/open_api/v1.3/advertiser/info/?advertiser_ids=["${firstAdvertiserId}"]&fields=["advertiser_id","advertiser_name","currency"]`,
        { headers: { 'Access-Token': access_token } }
      )
      if (advRes.ok) {
        const advData = await advRes.json() as TikTokAdvertiserResponse
        const adv = advData.data?.list?.[0]
        if (adv) {
          accountName = adv.advertiser_name
          currency    = adv.currency ?? 'NGN'
        }
      }
    }

    const { error: upsertErr } = await supabase
      .from('digital_ad_accounts')
      .upsert(
        {
          brand_id:      brand.id,
          platform:      'tiktok',
          account_id:    firstAdvertiserId ?? 'tiktok-ads',
          account_name:  accountName,
          access_token:  encrypt(access_token),
          refresh_token: refresh_token ? encrypt(refresh_token) : null,
          token_expiry:  tokenExpiry,
          ad_account_id: firstAdvertiserId,
          currency,
          sync_status:   'active',
          updated_at:    new Date().toISOString(),
        },
        { onConflict: 'brand_id,platform,account_id' }
      )

    if (upsertErr) {
      console.error('[tiktok-ads-callback] upsert error:', upsertErr)
      return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=db_error`)
    }

    return NextResponse.redirect(`${APP_URL}/dashboard/digital?connected=tiktok`)
  } catch (err) {
    console.error('[tiktok-ads-callback] unexpected error:', err)
    return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=oauth_failed`)
  }
}
