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

interface LinkedInTokenResponse {
  access_token:             string
  expires_in:               number   // seconds
  refresh_token?:           string
  refresh_token_expires_in?: number
  error?:                   string
  error_description?:       string
}

interface LinkedInAccountsResponse {
  elements?: Array<{
    id:              string
    name?:           string
    currency?:       string
    servingStatuses?: string[]
  }>
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error || !code || !state) {
    const reason = searchParams.get('error_description') ?? error ?? 'no_code'
    return NextResponse.redirect(
      `${APP_URL}/dashboard/digital?error=oauth_cancelled&reason=${encodeURIComponent(reason)}`
    )
  }

  const session = await redis.get<{ userId: string; platform: string }>(`adsoauth:${state}`)
  if (!session || session.platform !== 'linkedin') {
    return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=invalid_state`)
  }
  await redis.del(`adsoauth:${state}`)

  const supabase    = await createServiceClient()
  const redirectUri = `${APP_URL}/api/ads/linkedin/callback`

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
    // Exchange code for access token
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        grant_type:    'authorization_code',
        code,
        redirect_uri:  redirectUri,
        client_id:     process.env.LINKEDIN_ADS_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_ADS_CLIENT_SECRET!,
      }),
    })

    if (!tokenRes.ok) {
      console.error('[linkedin-ads-callback] token exchange failed:', await tokenRes.text())
      return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=token_exchange_failed`)
    }

    const tokenData = await tokenRes.json() as LinkedInTokenResponse
    if (tokenData.error) {
      console.error('[linkedin-ads-callback] token error:', tokenData.error_description)
      return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=token_exchange_failed`)
    }

    const tokenExpiry = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null

    // Fetch ad accounts for this user
    const accountsRes = await fetch(
      'https://api.linkedin.com/v2/adAccountsV2?q=search&search.type.values[0]=BUSINESS&search.status.values[0]=ACTIVE',
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    )

    let firstAccountId: string | null  = null
    let accountName:    string | null  = null
    let currency                       = 'USD'  // LinkedIn default; NGN is uncommon there

    if (accountsRes.ok) {
      const accountsData = await accountsRes.json() as LinkedInAccountsResponse
      const first = accountsData.elements?.[0]
      if (first) {
        firstAccountId = first.id
        accountName    = first.name ?? null
        currency       = first.currency ?? 'USD'
      }
    }

    const { error: upsertErr } = await supabase
      .from('digital_ad_accounts')
      .upsert(
        {
          brand_id:      brand.id,
          platform:      'linkedin',
          account_id:    firstAccountId ?? 'linkedin-ads',
          account_name:  accountName,
          access_token:  encrypt(tokenData.access_token),
          refresh_token: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
          token_expiry:  tokenExpiry,
          ad_account_id: firstAccountId,
          currency,
          sync_status:   'active',
          updated_at:    new Date().toISOString(),
        },
        { onConflict: 'brand_id,platform,account_id' }
      )

    if (upsertErr) {
      console.error('[linkedin-ads-callback] upsert error:', upsertErr)
      return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=db_error`)
    }

    return NextResponse.redirect(`${APP_URL}/dashboard/digital?connected=linkedin`)
  } catch (err) {
    console.error('[linkedin-ads-callback] unexpected error:', err)
    return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=oauth_failed`)
  }
}
