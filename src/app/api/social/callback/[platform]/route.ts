import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { Redis } from '@upstash/redis'
import { encrypt } from '@/lib/crypto'
import {
  exchangeMetaCode, getLongLivedToken, getMetaUserId,
  getInstagramAccount,
} from '@/lib/social/meta'
import { exchangeTwitterCode, getTwitterUserId } from '@/lib/social/twitter'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error || !code || !state) {
    return NextResponse.redirect(`${APP_URL}/dashboard?error=oauth_cancelled`)
  }

  // Verify state and retrieve session data
  const session = await redis.get<{ userId: string; platform: string; verifier?: string }>(`oauth:${state}`)
  if (!session || session.platform !== platform) {
    return NextResponse.redirect(`${APP_URL}/dashboard?error=oauth_invalid_state`)
  }
  await redis.del(`oauth:${state}`)

  const redirectUri = `${APP_URL}/api/social/callback/${platform}`
  const supabase = await createServiceClient()

  // Find brand_id for this user
  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', session.userId)
    .single()

  if (!member) return NextResponse.redirect(`${APP_URL}/dashboard?error=no_workspace`)

  const { data: brand } = await supabase
    .from('brands')
    .select('id')
    .eq('workspace_id', member.workspace_id)
    .single()

  if (!brand) return NextResponse.redirect(`${APP_URL}/dashboard?error=no_brand`)

  try {
    switch (platform) {
      case 'instagram': {
        const { access_token: shortToken } = await exchangeMetaCode(code, redirectUri)
        const { access_token } = await getLongLivedToken(shortToken)
        const user = await getMetaUserId(access_token)

        // Get the first connected Facebook page
        const pagesRes = await fetch(
          `https://graph.facebook.com/v21.0/me/accounts?access_token=${access_token}`
        )
        const pages = await pagesRes.json() as { data?: { id: string; access_token: string; name: string }[] }
        const page = pages.data?.[0]
        if (!page) return NextResponse.redirect(`${APP_URL}/dashboard?error=no_page`)

        // Get Instagram Business Account connected to this page
        const igData = await getInstagramAccount(page.access_token, page.id)
        const igId = igData.instagram_business_account?.id
        if (!igId) return NextResponse.redirect(`${APP_URL}/dashboard?error=no_ig_account`)

        await supabase.from('social_connections').upsert({
          brand_id: brand.id,
          platform: 'instagram',
          account_id: igId,
          account_name: user.name,
          access_token: encrypt(access_token),
          sync_status: 'active',
          connected_at: new Date().toISOString(),
        }, { onConflict: 'brand_id,platform,account_id' })
        break
      }

      case 'facebook': {
        const { access_token: shortToken } = await exchangeMetaCode(code, redirectUri)
        const { access_token } = await getLongLivedToken(shortToken)
        const user = await getMetaUserId(access_token)

        const pagesRes = await fetch(
          `https://graph.facebook.com/v21.0/me/accounts?access_token=${access_token}`
        )
        const pages = await pagesRes.json() as { data?: { id: string; access_token: string; name: string }[] }
        const page = pages.data?.[0]
        if (!page) return NextResponse.redirect(`${APP_URL}/dashboard?error=no_page`)

        await supabase.from('social_connections').upsert({
          brand_id: brand.id,
          platform: 'facebook',
          account_id: page.id,
          account_name: page.name,
          access_token: encrypt(page.access_token),
          sync_status: 'active',
          connected_at: new Date().toISOString(),
        }, { onConflict: 'brand_id,platform,account_id' })
        break
      }

      case 'twitter': {
        if (!session.verifier) return NextResponse.redirect(`${APP_URL}/dashboard?error=missing_verifier`)
        const tokens = await exchangeTwitterCode(code, session.verifier, redirectUri)
        const twitterUser = await getTwitterUserId(tokens.access_token)

        await supabase.from('social_connections').upsert({
          brand_id: brand.id,
          platform: 'twitter',
          account_id: twitterUser.id,
          account_name: `@${twitterUser.username}`,
          access_token: encrypt(tokens.access_token),
          refresh_token: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
          sync_status: 'active',
          connected_at: new Date().toISOString(),
        }, { onConflict: 'brand_id,platform,account_id' })
        break
      }

      default:
        return NextResponse.redirect(`${APP_URL}/dashboard?error=unsupported_platform`)
    }

    return NextResponse.redirect(`${APP_URL}/dashboard/content?connected=${platform}`)
  } catch (err) {
    console.error(`OAuth callback error for ${platform}:`, err)
    return NextResponse.redirect(`${APP_URL}/dashboard?error=oauth_failed`)
  }
}
