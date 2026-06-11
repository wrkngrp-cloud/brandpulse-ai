import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Redis } from '@upstash/redis'
import { randomBytes } from 'crypto'
import { generatePKCE } from '@/lib/social/twitter'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { platform } = await params
  const state = randomBytes(16).toString('hex')
  const redirectUri = `${APP_URL}/api/social/callback/${platform}`

  switch (platform) {
    case 'instagram':
    case 'facebook': {
      await redis.set(`oauth:${state}`, { userId: user.id, platform }, { ex: 600 })

      // Minimal scopes using only the consumer use case (already approved).
      // Page and Instagram scopes require additional Meta use cases — add them
      // once the "Access content shared by Pages" and "Access Instagram" use
      // cases are enabled in the Meta developer portal.
      const scopes = 'public_profile,email'

      const authUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth')
      authUrl.searchParams.set('client_id', process.env.META_APP_ID ?? '')
      authUrl.searchParams.set('redirect_uri', redirectUri)
      authUrl.searchParams.set('scope', scopes)
      authUrl.searchParams.set('state', state)
      authUrl.searchParams.set('response_type', 'code')

      return NextResponse.redirect(authUrl.toString())
    }

    case 'twitter': {
      const { verifier, challenge } = generatePKCE()
      await redis.set(`oauth:${state}`, { userId: user.id, platform, verifier }, { ex: 600 })

      const authUrl = new URL('https://twitter.com/i/oauth2/authorize')
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('client_id', process.env.TWITTER_CLIENT_ID ?? '')
      authUrl.searchParams.set('redirect_uri', redirectUri)
      authUrl.searchParams.set('scope', 'tweet.read users.read offline.access')
      authUrl.searchParams.set('state', state)
      authUrl.searchParams.set('code_challenge', challenge)
      authUrl.searchParams.set('code_challenge_method', 'S256')

      return NextResponse.redirect(authUrl.toString())
    }

    default:
      return NextResponse.json({ error: 'Unsupported platform' }, { status: 400 })
  }
}
