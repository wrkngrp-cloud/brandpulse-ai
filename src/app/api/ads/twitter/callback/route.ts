import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { Redis } from '@upstash/redis'
import { encrypt } from '@/lib/crypto'
import { createHmac, randomBytes } from 'crypto'

export const runtime = 'nodejs'

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'

interface TwitterAccessTokenParams {
  oauth_token:        string
  oauth_token_secret: string
  user_id:            string
  screen_name:        string
}

interface TwitterAdsAccountsResponse {
  data?: Array<{
    id:       string
    name:     string
    currency: string
  }>
}

function buildOAuth1Header(
  method:      string,
  url:         string,
  tokenSecret: string,
  extraParams: Record<string, string>
): string {
  const oauthBase = {
    oauth_consumer_key:     process.env.TWITTER_ADS_API_KEY!,
    oauth_nonce:            randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp:        String(Math.floor(Date.now() / 1000)),
    oauth_version:          '1.0',
    ...extraParams,
  }

  const allParams  = { ...oauthBase }
  const paramStr   = Object.entries(allParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
  const sigBase    = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramStr)}`
  const signingKey = `${encodeURIComponent(process.env.TWITTER_ADS_API_SECRET!)}&${encodeURIComponent(tokenSecret)}`
  const signature  = createHmac('sha1', signingKey).update(sigBase).digest('base64')

  return 'OAuth ' + Object.entries({ ...oauthBase, oauth_signature: signature })
    .map(([k, v]) => `${k}="${encodeURIComponent(v)}"`)
    .join(', ')
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const oauthToken    = searchParams.get('oauth_token')
  const oauthVerifier = searchParams.get('oauth_verifier')
  const denied        = searchParams.get('denied')

  if (denied || !oauthToken || !oauthVerifier) {
    const reason = denied ? 'user_denied' : 'no_token'
    return NextResponse.redirect(
      `${APP_URL}/dashboard/digital?error=oauth_cancelled&reason=${encodeURIComponent(reason)}`
    )
  }

  // Look up state token from oauth_token
  const stateToken = await redis.get<string>(`twitter_oauth_token:${oauthToken}`)
  if (!stateToken) {
    return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=invalid_state`)
  }
  await redis.del(`twitter_oauth_token:${oauthToken}`)

  const session = await redis.get<{ userId: string; platform: string }>(`adsoauth:${stateToken}`)
  if (!session || session.platform !== 'twitter') {
    return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=invalid_state`)
  }
  await redis.del(`adsoauth:${stateToken}`)

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
    // Step 3: Exchange oauth_token + oauth_verifier for access token
    const accessTokenUrl = 'https://api.twitter.com/oauth/access_token'
    const authHeader     = buildOAuth1Header('POST', accessTokenUrl, '', {
      oauth_token:    oauthToken,
      oauth_verifier: oauthVerifier,
    })

    const accessRes = await fetch(accessTokenUrl, {
      method:  'POST',
      headers: { Authorization: authHeader },
    })

    if (!accessRes.ok) {
      console.error('[twitter-ads-callback] access token failed:', await accessRes.text())
      return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=token_exchange_failed`)
    }

    const accessBody   = await accessRes.text()
    const accessParams = new URLSearchParams(accessBody)
    const tokenData: TwitterAccessTokenParams = {
      oauth_token:        accessParams.get('oauth_token')        ?? '',
      oauth_token_secret: accessParams.get('oauth_token_secret') ?? '',
      user_id:            accessParams.get('user_id')            ?? '',
      screen_name:        accessParams.get('screen_name')        ?? '',
    }

    if (!tokenData.oauth_token) {
      console.error('[twitter-ads-callback] no access token in response')
      return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=token_exchange_failed`)
    }

    // Fetch Twitter Ads accounts
    const adsAccountsUrl = 'https://ads-api.twitter.com/12/accounts'
    const adsAuthHeader  = buildOAuth1Header('GET', adsAccountsUrl, tokenData.oauth_token_secret, {
      oauth_token: tokenData.oauth_token,
    })

    let firstAccountId: string | null = null
    let accountName:    string | null = tokenData.screen_name ? `@${tokenData.screen_name}` : null
    const currency                    = 'NGN'

    const adsRes = await fetch(adsAccountsUrl, {
      headers: { Authorization: adsAuthHeader },
    })
    if (adsRes.ok) {
      const adsData = await adsRes.json() as TwitterAdsAccountsResponse
      const first   = adsData.data?.[0]
      if (first) {
        firstAccountId = first.id
        accountName    = first.name ?? accountName
      }
    }

    // Combine access_token + secret as a delimited string (both encrypted)
    const combinedToken = `${tokenData.oauth_token}:${tokenData.oauth_token_secret}`

    const { error: upsertErr } = await supabase
      .from('digital_ad_accounts')
      .upsert(
        {
          brand_id:      brand.id,
          platform:      'twitter',
          account_id:    firstAccountId ?? tokenData.user_id ?? 'twitter-ads',
          account_name:  accountName,
          access_token:  encrypt(combinedToken),
          token_expiry:  null,    // Twitter OAuth 1.0a tokens don't expire
          ad_account_id: firstAccountId,
          currency,
          sync_status:   'active',
          updated_at:    new Date().toISOString(),
        },
        { onConflict: 'brand_id,platform,account_id' }
      )

    if (upsertErr) {
      console.error('[twitter-ads-callback] upsert error:', upsertErr)
      return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=db_error`)
    }

    return NextResponse.redirect(`${APP_URL}/dashboard/digital?connected=twitter`)
  } catch (err) {
    console.error('[twitter-ads-callback] unexpected error:', err)
    return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=oauth_failed`)
  }
}
