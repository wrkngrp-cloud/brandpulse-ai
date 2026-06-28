import { NextRequest, NextResponse }  from 'next/server'
import { createClient }               from '@/lib/supabase/server'
import { getActiveBrandId }           from '@/lib/active-brand'
import { Redis }                      from '@upstash/redis'
import { randomBytes }                from 'crypto'

export const runtime = 'nodejs'

const redis  = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'
const GRAPH   = 'https://www.facebook.com/v21.0/dialog/oauth'

export async function GET(req: NextRequest) {
  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
    // Redirect to connectors with a clear error rather than producing a malformed OAuth URL
    return NextResponse.redirect(`${APP_URL}/dashboard/connectors?error=meta_not_configured`)
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
    { userId: user.id, platform: 'meta', brandId, returnTo },
    { ex: 600 },
  )

  const redirectUri = `${APP_URL}/api/ads/meta/callback`

  const params = new URLSearchParams({
    client_id:     process.env.META_APP_ID,
    redirect_uri:  redirectUri,
    state,
    scope:         'ads_read,ads_management,read_insights',
    response_type: 'code',
  })

  return NextResponse.redirect(`${GRAPH}?${params}`)
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No active brand' }, { status: 404 })

  const { error } = await supabase
    .from('digital_ad_accounts')
    .delete()
    .eq('brand_id', brandId)
    .eq('platform', 'meta')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
