import { NextRequest, NextResponse }  from 'next/server'
import { createServiceClient }        from '@/lib/supabase/server'
import { Redis }                      from '@upstash/redis'
import { encrypt }                    from '@/lib/crypto'
import { holdPick }                   from '@/lib/meta/pick'
import { metaUserIdForToken, getLongLivedToken }          from '@/lib/social/meta'

export const runtime = 'nodejs'

const redis   = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })
const APP_URL = process.env.APP_URL || 'http://localhost:3000'
const GRAPH   = 'https://graph.facebook.com/v21.0'

interface AdAccount {
  id:             string
  name:           string
  currency:       string
  account_status: number
}

interface AdAccountsResponse {
  data?:  AdAccount[]
  error?: { message: string; code: number }
}

interface TokenResponse {
  access_token: string
  expires_in?:  number
  error?:       { message: string }
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

  // Meta sends error if the user denied the OAuth dialog
  if (error || !code || !state) {
    const reason = searchParams.get('error_reason') ?? searchParams.get('error_description') ?? error ?? 'no_code'
    // We don't know returnTo at this point — default to connectors
    return NextResponse.redirect(
      `${APP_URL}/dashboard/connectors?error=oauth_cancelled&reason=${encodeURIComponent(reason)}`
    )
  }

  // Verify and consume the CSRF state from Redis. A Redis error means the
  // state can't be verified either way, which is the same outcome as the
  // state being missing: refuse rather than guess.
  const session = await redis.get<RedisState>(`adsoauth:${state}`).catch(() => null)
  if (!session || session.platform !== 'meta') {
    return NextResponse.redirect(`${APP_URL}/dashboard/connectors?error=invalid_state`)
  }
  await redis.del(`adsoauth:${state}`).catch(() => { /* best-effort cleanup */ })

  const { brandId, returnTo } = session
  const supabase = await createServiceClient()

  try {
    // Exchange authorisation code for short-lived token
    const tokenParams = new URLSearchParams({
      client_id:     process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      redirect_uri:  `${APP_URL}/api/ads/meta/callback`,
      code,
    })

    const tokenRes = await fetch(`${GRAPH}/oauth/access_token?${tokenParams}`)
    if (!tokenRes.ok) {
      console.error('[meta-callback] token exchange failed:', await tokenRes.text())
      return NextResponse.redirect(returnUrl(returnTo, { error: 'token_exchange_failed' }))
    }

    const tokenData = await tokenRes.json() as TokenResponse
    if (tokenData.error) {
      console.error('[meta-callback] token error:', tokenData.error.message)
      return NextResponse.redirect(returnUrl(returnTo, { error: 'token_exchange_failed' }))
    }

    // Upgrade to long-lived token (60-day TTL)
    const { access_token: longToken, expires_in } = await getLongLivedToken(tokenData.access_token)
    const tokenExpiry = expires_in
      ? new Date(Date.now() + expires_in * 1000).toISOString()
      : null

    const metaUserId = await metaUserIdForToken(longToken)

    // Fetch ad accounts associated with this user
    const adAccountsRes  = await fetch(
      `${GRAPH}/me/adaccounts?fields=id,name,currency,account_status&access_token=${longToken}`
    )
    const adAccountsData = await adAccountsRes.json() as AdAccountsResponse

    const accounts = adAccountsData.data ?? []
    // No ad account at all: say so. This used to save a placeholder row and
    // report "connected", and then the sync skipped it forever.
    if (!accounts.length) return NextResponse.redirect(returnUrl(returnTo, { error: 'no_ad_account' }))

    // More than one: let them choose, rather than taking the first.
    if (accounts.length > 1) {
      const key = await holdPick({
        kind: 'meta_ads', userId: session.userId, brandId, accessToken: longToken,
        expiresAt: tokenExpiry, metaUserId, returnTo,
        options: accounts.map(a => ({ id: a.id, name: a.name ?? a.id, note: a.account_status === 1 ? `Active · ${a.currency ?? ''}`.trim() : 'Not active' })),
      })
      return NextResponse.redirect(`${APP_URL}/dashboard/connectors/choose?key=${key}`)
    }

    const activeAccount = accounts[0]
    const adAccountId = activeAccount.id                // "act_XXXXXXXXX" format
    const accountName = activeAccount.name ?? null
    const currency    = activeAccount.currency ?? 'NGN'
    const accountIdentifier = adAccountId

    // A shared-access row for this brand gives way to the login: the login
    // carries its own token, so the two would only disagree. Before the
    // shared-access migration this filter names a missing column and the
    // delete is a harmless no-op, which is why its error is not checked.
    await supabase.from('digital_ad_accounts').delete()
      .eq('brand_id', brandId).eq('platform', 'meta').eq('auth_mode', 'shared')

    const { error: upsertErr } = await supabase
      .from('digital_ad_accounts')
      .upsert(
        {
          brand_id:      brandId,
          platform:      'meta',
          account_id:    accountIdentifier,
          account_name:  accountName,
          access_token:  encrypt(longToken),
          token_expiry:  tokenExpiry,
          ad_account_id: adAccountId,
          // Who connected it, for Meta data deletion requests.
          meta_user_id:  metaUserId,
          currency,
          sync_status:   'active',
          updated_at:    new Date().toISOString(),
        },
        { onConflict: 'brand_id,platform,account_id' },
      )

    if (upsertErr) {
      console.error('[meta-callback] upsert error:', upsertErr)
      return NextResponse.redirect(returnUrl(returnTo, { error: 'db_error' }))
    }

    return NextResponse.redirect(returnUrl(returnTo, { connected: 'meta' }))
  } catch (err) {
    console.error('[meta-callback] unexpected error:', err)
    return NextResponse.redirect(returnUrl(returnTo, { error: 'oauth_failed' }))
  }
}
