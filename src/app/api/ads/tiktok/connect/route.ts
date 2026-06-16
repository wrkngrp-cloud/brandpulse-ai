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
  if (!process.env.TIKTOK_ADS_APP_ID) {
    return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=tiktok_not_configured`)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${APP_URL}/login`)
  }

  const state = randomBytes(16).toString('hex')

  await redis.set(
    `adsoauth:${state}`,
    { userId: user.id, platform: 'tiktok' },
    { ex: 600 }
  )

  const redirectUri = `${APP_URL}/api/ads/tiktok/callback`

  const params = new URLSearchParams({
    app_id:       process.env.TIKTOK_ADS_APP_ID,
    redirect_uri: redirectUri,
    state,
    scope:        'advertiser_management',
  })

  return NextResponse.redirect(
    `https://ads.tiktok.com/marketing_api/auth?${params}`
  )
}
