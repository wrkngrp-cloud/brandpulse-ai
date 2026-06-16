import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Redis } from '@upstash/redis'
import { randomBytes } from 'crypto'

export const runtime = 'nodejs'

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'

export async function GET() {
  if (!process.env.LINKEDIN_ADS_CLIENT_ID) {
    return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=linkedin_not_configured`)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${APP_URL}/login`)
  }

  const state = randomBytes(16).toString('hex')

  await redis.set(
    `adsoauth:${state}`,
    { userId: user.id, platform: 'linkedin' },
    { ex: 600 }
  )

  const redirectUri = `${APP_URL}/api/ads/linkedin/callback`

  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     process.env.LINKEDIN_ADS_CLIENT_ID,
    redirect_uri:  redirectUri,
    state,
    // Scopes for LinkedIn Marketing API
    scope:         'r_ads r_ads_reporting rw_ads',
  })

  return NextResponse.redirect(
    `https://www.linkedin.com/oauth/v2/authorization?${params}`
  )
}
