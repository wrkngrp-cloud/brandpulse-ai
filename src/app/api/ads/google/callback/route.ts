import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { Redis } from '@upstash/redis'
import { encrypt } from '@/lib/crypto'

export const runtime = 'nodejs'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'

interface GoogleTokenResponse {
  access_token:  string
  refresh_token?: string
  expires_in?:   number
  token_type?:   string
  error?:        string
  error_description?: string
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error || !code || !state) {
    const reason = error ?? 'no_code'
    return NextResponse.redirect(
      `${APP_URL}/dashboard/digital?error=oauth_cancelled&reason=${encodeURIComponent(reason)}`
    )
  }

  // Verify Redis state
  const session = await redis.get<{ userId: string; platform: string }>(`adsoauth:${state}`)
  if (!session || session.platform !== 'google') {
    return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=invalid_state`)
  }
  await redis.del(`adsoauth:${state}`)

  const supabase    = await createServiceClient()
  const redirectUri = `${APP_URL}/api/ads/google/callback`

  // Resolve brand for this user
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
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     process.env.GOOGLE_ADS_CLIENT_ID!,
        client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
        code,
      }),
    })

    if (!tokenRes.ok) {
      console.error('[google-ads-callback] token exchange failed:', await tokenRes.text())
      return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=token_exchange_failed`)
    }

    const tokenData = await tokenRes.json() as GoogleTokenResponse
    if (tokenData.error) {
      console.error('[google-ads-callback] token error:', tokenData.error_description)
      return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=token_exchange_failed`)
    }

    const tokenExpiry = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null

    const { error: upsertErr } = await supabase
      .from('digital_ad_accounts')
      .upsert(
        {
          brand_id:      brand.id,
          platform:      'google',
          account_id:    'google-ads',
          account_name:  'Google Ads',
          access_token:  encrypt(tokenData.access_token),
          refresh_token: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
          token_expiry:  tokenExpiry,
          currency:      'NGN',
          sync_status:   'active',
          updated_at:    new Date().toISOString(),
        },
        { onConflict: 'brand_id,platform,account_id' }
      )

    if (upsertErr) {
      console.error('[google-ads-callback] upsert error:', upsertErr)
      return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=db_error`)
    }

    return NextResponse.redirect(`${APP_URL}/dashboard/digital?connected=google`)
  } catch (err) {
    console.error('[google-ads-callback] unexpected error:', err)
    return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=oauth_failed`)
  }
}
