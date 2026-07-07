import { NextRequest, NextResponse }  from 'next/server'
import { createClient }               from '@/lib/supabase/server'
import { getActiveBrandId }           from '@/lib/active-brand'
import { Redis }                      from '@upstash/redis'
import { randomBytes }                from 'crypto'

export const runtime = 'nodejs'

const redis   = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'
const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth'

export async function GET(req: NextRequest) {
  // The developer token is a separate credential from the OAuth client pair.
  // Without all three, sync can never work — don't let anyone start the flow.
  if (
    !process.env.GOOGLE_ADS_CLIENT_ID ||
    !process.env.GOOGLE_ADS_CLIENT_SECRET ||
    !process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  ) {
    return NextResponse.redirect(`${APP_URL}/dashboard/connectors?error=google_ads_not_configured`)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${APP_URL}/auth/login`)

  // Capture active brand so the callback doesn't need to guess for multi-brand workspaces
  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.redirect(`${APP_URL}/onboarding`)

  // Optional return_to query param — Connectors page passes 'connectors', Digital page omits it
  const returnTo = req.nextUrl.searchParams.get('return_to') ?? 'digital'

  const state = randomBytes(16).toString('hex')
  await redis.set(
    `adsoauth:${state}`,
    { userId: user.id, platform: 'google_ads', brandId, returnTo },
    { ex: 600 },
  )

  const redirectUri = `${APP_URL}/api/ads/google-ads/callback`

  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_ADS_CLIENT_ID,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         'https://www.googleapis.com/auth/adwords',
    access_type:   'offline',   // required for Google to issue a refresh_token
    prompt:        'consent',   // guarantees a refresh_token on every connect
    state,
  })

  return NextResponse.redirect(`${GOOGLE_AUTH}?${params}`)
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No active brand' }, { status: 404 })

  // Stored platform value is 'google' (the schema's check constraint), not 'google_ads'
  const { error } = await supabase
    .from('digital_ad_accounts')
    .delete()
    .eq('brand_id', brandId)
    .eq('platform', 'google')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
