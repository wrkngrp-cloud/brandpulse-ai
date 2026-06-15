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
const GRAPH = 'https://www.facebook.com/v21.0/dialog/oauth'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${APP_URL}/login`)
  }

  const state = randomBytes(16).toString('hex')

  await redis.set(
    `adsoauth:${state}`,
    { userId: user.id, platform: 'meta' },
    { ex: 600 }
  )

  const redirectUri = `${APP_URL}/api/ads/meta/callback`

  const params = new URLSearchParams({
    client_id:     process.env.META_APP_ID!,
    redirect_uri:  redirectUri,
    state,
    scope:         'ads_read,ads_management,business_management,read_insights',
    response_type: 'code',
  })

  return NextResponse.redirect(`${GRAPH}?${params}`)
}
