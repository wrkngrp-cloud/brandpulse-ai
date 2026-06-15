import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Redis } from '@upstash/redis'
import { randomBytes } from 'crypto'

export const runtime = 'nodejs'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'

export async function GET() {
  if (!process.env.GOOGLE_ADS_CLIENT_ID) {
    return NextResponse.redirect(`${APP_URL}/dashboard/digital?error=google_not_configured`)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${APP_URL}/login`)
  }

  const state = randomBytes(16).toString('hex')

  await redis.set(
    `adsoauth:${state}`,
    { userId: user.id, platform: 'google' },
    { ex: 600 }
  )

  const redirectUri = `${APP_URL}/api/ads/google/callback`

  const params = new URLSearchParams({
    client_id:             process.env.GOOGLE_ADS_CLIENT_ID,
    redirect_uri:          redirectUri,
    response_type:         'code',
    scope:                 'https://www.googleapis.com/auth/adwords',
    state,
    access_type:           'offline',
    prompt:                'consent',
  })

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}
