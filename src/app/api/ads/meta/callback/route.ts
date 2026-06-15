import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { Redis } from '@upstash/redis'
import { encrypt } from '@/lib/crypto'
import { getLongLivedToken } from '@/lib/social/meta'

export const runtime = 'nodejs'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'
const GRAPH   = 'https://graph.facebook.com/v21.0'

interface AdAccount {
  id:             string
  name:           string
  currency:       string
  account_status: number
}

interface AdAccountsResponse {
  data?: AdAccount[]
  error?: { message: string; code: number }
}

interface TokenResponse {
  access_token: string
  expires_in?:  number
  error?:       { message: string }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error || !code || !state) {
    const reason = searchParams.get('error_reason') ?? searchParams.get('error_description') ?? error ?? 'no_code'
    return NextResponse.redirect(
      `${APP_URL}/dashboard/digital?error=oauth_cancelled&reason=${encodeURIComponent(reason)}`
    )
  }

  // Verify Redis state
  const session = await redis.get<{ userId: string; platform: string }>(`adsoauth:${state}`)
  if (!session || session.platform !== 'meta') {
    return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=invalid_state`)
  }
  await redis.del(`adsoauth:${state}`)

  const redirectUri = `${APP_URL}/api/ads/meta/callback`
  const supabase    = await createServiceClient()

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
    // Exchange code for short-lived token
    const tokenParams = new URLSearchParams({
      client_id:     process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      redirect_uri:  redirectUri,
      code,
    })

    const tokenRes = await fetch(`${GRAPH}/oauth/access_token?${tokenParams}`)
    if (!tokenRes.ok) {
      console.error('[meta-ads-callback] token exchange failed:', await tokenRes.text())
      return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=token_exchange_failed`)
    }

    const tokenData = await tokenRes.json() as TokenResponse
    if (tokenData.error) {
      console.error('[meta-ads-callback] token error:', tokenData.error.message)
      return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=token_exchange_failed`)
    }

    // Exchange for long-lived token (60-day)
    const { access_token: longToken, expires_in } = await getLongLivedToken(tokenData.access_token)

    const tokenExpiry = expires_in
      ? new Date(Date.now() + expires_in * 1000).toISOString()
      : null

    // Fetch ad accounts
    const adAccountsRes = await fetch(
      `${GRAPH}/me/adaccounts?fields=id,name,currency,account_status&access_token=${longToken}`
    )
    const adAccountsData = await adAccountsRes.json() as AdAccountsResponse

    // Use the first active ad account (account_status === 1)
    const activeAccount = adAccountsData.data?.find(a => a.account_status === 1)
      ?? adAccountsData.data?.[0]

    const adAccountId  = activeAccount?.id ?? null
    const accountName  = activeAccount?.name ?? null
    const currency     = activeAccount?.currency ?? 'NGN'

    // Use the ad account ID as the account_id (act_XXXXXXXXX format)
    // Fall back to a user-level identifier if no ad accounts found
    const accountIdentifier = adAccountId ?? 'user-level'

    // Upsert into digital_ad_accounts with encrypted tokens
    const { error: upsertErr } = await supabase
      .from('digital_ad_accounts')
      .upsert(
        {
          brand_id:      brand.id,
          platform:      'meta',
          account_id:    accountIdentifier,
          account_name:  accountName,
          access_token:  encrypt(longToken),
          token_expiry:  tokenExpiry,
          ad_account_id: adAccountId,
          currency,
          sync_status:   'active',
          updated_at:    new Date().toISOString(),
        },
        { onConflict: 'brand_id,platform,account_id' }
      )

    if (upsertErr) {
      console.error('[meta-ads-callback] upsert error:', upsertErr)
      return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=db_error`)
    }

    return NextResponse.redirect(`${APP_URL}/dashboard/digital?connected=meta`)
  } catch (err) {
    console.error('[meta-ads-callback] unexpected error:', err)
    return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=oauth_failed`)
  }
}
