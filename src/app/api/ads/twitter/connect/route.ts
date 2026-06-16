import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Redis } from '@upstash/redis'
import { randomBytes, createHmac } from 'crypto'

export const runtime = 'nodejs'

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'

/**
 * X/Twitter Ads uses OAuth 1.0a for the Ads API.
 * Step 1: Get a request token from Twitter, then redirect user to authorise.
 */
export async function GET() {
  if (!process.env.TWITTER_ADS_API_KEY) {
    return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=twitter_not_configured`)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${APP_URL}/login`)
  }

  const callbackUrl = `${APP_URL}/api/ads/twitter/callback`
  const stateToken  = randomBytes(16).toString('hex')

  // Store user mapping keyed by state (we'll use oauth_token after redirect)
  await redis.set(
    `adsoauth:${stateToken}`,
    { userId: user.id, platform: 'twitter' },
    { ex: 600 }
  )

  // OAuth 1.0a request token
  const oauthParams = {
    oauth_callback:         encodeURIComponent(callbackUrl),
    oauth_consumer_key:     process.env.TWITTER_ADS_API_KEY!,
    oauth_nonce:            randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp:        String(Math.floor(Date.now() / 1000)),
    oauth_version:          '1.0',
  }

  const baseUrl    = 'https://api.twitter.com/oauth/request_token'
  const paramStr   = Object.entries(oauthParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')
  const sigBase    = `POST&${encodeURIComponent(baseUrl)}&${encodeURIComponent(paramStr)}`
  const signingKey = `${encodeURIComponent(process.env.TWITTER_ADS_API_SECRET!)}&`
  const signature  = createHmac('sha1', signingKey).update(sigBase).digest('base64')

  const authHeader = 'OAuth ' + Object.entries({ ...oauthParams, oauth_signature: encodeURIComponent(signature) })
    .map(([k, v]) => `${k}="${v}"`)
    .join(', ')

  const reqTokenRes = await fetch(baseUrl, {
    method:  'POST',
    headers: { Authorization: authHeader },
  })

  if (!reqTokenRes.ok) {
    const text = await reqTokenRes.text()
    console.error('[twitter-ads-connect] request token failed:', text)
    return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=twitter_request_token_failed`)
  }

  const body         = await reqTokenRes.text()
  const params       = new URLSearchParams(body)
  const oauthToken   = params.get('oauth_token')
  const confirmed    = params.get('oauth_callback_confirmed')

  if (!oauthToken || confirmed !== 'true') {
    console.error('[twitter-ads-connect] callback not confirmed or no token')
    return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=twitter_request_token_failed`)
  }

  // Store state → oauth_token mapping so callback can look it up
  await redis.set(`twitter_oauth_token:${oauthToken}`, stateToken, { ex: 600 })

  return NextResponse.redirect(
    `https://api.twitter.com/oauth/authorize?oauth_token=${oauthToken}`
  )
}
