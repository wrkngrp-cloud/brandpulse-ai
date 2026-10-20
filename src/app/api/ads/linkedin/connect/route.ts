import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrandId } from '@/lib/active-brand'
import { Redis } from '@upstash/redis'
import { randomBytes } from 'crypto'

export const runtime = 'nodejs'

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const APP_URL = process.env.APP_URL || 'http://localhost:3000'

export async function GET() {
  if (!process.env.LINKEDIN_ADS_CLIENT_ID) {
    return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=linkedin_not_configured`)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${APP_URL}/login`)
  }

  // Capture active brand so the callback doesn't need to guess for multi-brand workspaces
  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.redirect(`${APP_URL}/onboarding`)

  const state = randomBytes(16).toString('hex')

  try {
    await redis.set(
      `adsoauth:${state}`,
      { userId: user.id, platform: 'linkedin', brandId },
      { ex: 600 }
    )
  } catch {
    return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=connections_unavailable`)
  }

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
