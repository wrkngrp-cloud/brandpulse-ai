import { NextRequest, NextResponse }  from 'next/server'
import { createServiceClient }        from '@/lib/supabase/server'
import { Redis }                      from '@upstash/redis'
import { encrypt }                    from '@/lib/crypto'

export const runtime = 'nodejs'

const redis   = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const ADS_API   = 'https://googleads.googleapis.com/v17'

interface TokenResponse {
  access_token?:  string
  refresh_token?: string
  expires_in?:    number
  token_type?:    string
  error?:             string
  error_description?: string
}

interface ListCustomersResponse {
  resourceNames?: string[]
  error?: { message: string; code: number }
}

interface RedisState {
  userId:   string
  platform: string
  brandId:  string
  returnTo: string
}

function returnUrl(returnTo: string, params: Record<string, string>): string {
  const base = returnTo === 'connectors'
    ? `${APP_URL}/dashboard/connectors`
    : `${APP_URL}/dashboard/digital`
  const qs = new URLSearchParams(params)
  return `${base}?${qs}`
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Google sends error=access_denied if the user cancelled the consent screen
  if (error || !code || !state) {
    const reason = error ?? 'no_code'
    // We don't know returnTo at this point — default to connectors
    return NextResponse.redirect(
      `${APP_URL}/dashboard/connectors?error=oauth_cancelled&reason=${encodeURIComponent(reason)}`
    )
  }

  // Verify and consume the CSRF state from Redis
  const session = await redis.get<RedisState>(`adsoauth:${state}`)
  if (!session || session.platform !== 'google_ads') {
    return NextResponse.redirect(`${APP_URL}/dashboard/connectors?error=invalid_state`)
  }
  await redis.del(`adsoauth:${state}`)

  const { brandId, returnTo } = session

  // Defense in depth — the connect route already gates on these, but guard here too
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  if (!process.env.GOOGLE_ADS_CLIENT_ID || !process.env.GOOGLE_ADS_CLIENT_SECRET || !developerToken) {
    return NextResponse.redirect(returnUrl(returnTo, { error: 'google_ads_not_configured' }))
  }

  const supabase = await createServiceClient()

  try {
    // Exchange authorisation code for tokens
    const tokenRes = await fetch(TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     process.env.GOOGLE_ADS_CLIENT_ID,
        client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
        redirect_uri:  `${APP_URL}/api/ads/google-ads/callback`,
        grant_type:    'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      console.error('[google-ads-callback] token exchange failed:', await tokenRes.text())
      return NextResponse.redirect(returnUrl(returnTo, { error: 'token_exchange_failed' }))
    }

    const tokenData = await tokenRes.json() as TokenResponse
    if (tokenData.error || !tokenData.access_token) {
      console.error('[google-ads-callback] token error:', tokenData.error_description ?? tokenData.error)
      return NextResponse.redirect(returnUrl(returnTo, { error: 'token_exchange_failed' }))
    }

    const tokenExpiry = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null

    // List the Google Ads customer accounts this user can access
    const customersRes = await fetch(`${ADS_API}/customers:listAccessibleCustomers`, {
      headers: {
        Authorization:     `Bearer ${tokenData.access_token}`,
        'developer-token': developerToken,
      },
    })

    if (!customersRes.ok) {
      console.error('[google-ads-callback] listAccessibleCustomers failed:', await customersRes.text())
      return NextResponse.redirect(returnUrl(returnTo, { error: 'account_list_failed' }))
    }

    const customersData = await customersRes.json() as ListCustomersResponse
    const firstResource = customersData.resourceNames?.[0]
    if (!firstResource) {
      console.error('[google-ads-callback] no accessible customers found')
      return NextResponse.redirect(returnUrl(returnTo, { error: 'no_ad_accounts' }))
    }

    // "customers/1234567890" → "1234567890"
    const customerId = firstResource.replace('customers/', '')

    const { error: upsertErr } = await supabase
      .from('digital_ad_accounts')
      .upsert(
        {
          brand_id:      brandId,
          platform:      'google',
          account_id:    customerId,
          account_name:  null,
          access_token:  encrypt(tokenData.access_token),
          // Google always issues a refresh_token with access_type=offline & prompt=consent,
          // but store whatever we got rather than crashing if it's ever missing
          refresh_token: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
          token_expiry:  tokenExpiry,
          ad_account_id: customerId,
          currency:      'NGN',
          sync_status:   'active',
          updated_at:    new Date().toISOString(),
        },
        { onConflict: 'brand_id,platform,account_id' },
      )

    if (upsertErr) {
      console.error('[google-ads-callback] upsert error:', upsertErr)
      return NextResponse.redirect(returnUrl(returnTo, { error: 'db_error' }))
    }

    return NextResponse.redirect(returnUrl(returnTo, { connected: 'google_ads' }))
  } catch (err) {
    console.error('[google-ads-callback] unexpected error:', err)
    return NextResponse.redirect(returnUrl(returnTo, { error: 'oauth_failed' }))
  }
}
