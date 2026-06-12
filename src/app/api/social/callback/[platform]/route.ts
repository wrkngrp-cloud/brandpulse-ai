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
const GRAPH = 'https://graph.facebook.com/v21.0'

interface FacebookPage {
  id: string
  name: string
  access_token: string
  category?: string
}

interface FacebookPagesResponse {
  data?: FacebookPage[]
  error?: { message: string; code: number }
}

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
    const reason = searchParams.get('error_reason') ?? searchParams.get('error_description') ?? error ?? 'no_code'
    return NextResponse.redirect(`${APP_URL}/dashboard?error=oauth_cancelled&reason=${encodeURIComponent(reason)}`)
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
      case 'facebook': {
        const { access_token: shortToken } = await exchangeMetaCode(code, redirectUri)
        const { access_token } = await getLongLivedToken(shortToken)

        // Get the user's connected Facebook Pages
        const pagesRes = await fetch(
          `${GRAPH}/me/accounts?fields=id,name,access_token,category&access_token=${access_token}`
        )
        const pagesData: FacebookPagesResponse = await pagesRes.json()
        const page = pagesData.data?.[0]

        if (page) {
          // Store the PAGE access token — required for fetching page posts
          await supabase.from('social_connections').upsert({
            brand_id: brand.id,
            platform: 'facebook',
            account_id: page.id,
            account_name: page.name,
            access_token: encrypt(page.access_token),
            sync_status: 'active',
            connected_at: new Date().toISOString(),
          }, { onConflict: 'brand_id,platform,account_id' })
        } else {
          // No pages found — store user-level token as fallback so connection isn't lost
          const user = await getMetaUserId(access_token)
          await supabase.from('social_connections').upsert({
            brand_id: brand.id,
            platform: 'facebook',
            account_id: user.id,
            account_name: user.name,
            access_token: encrypt(access_token),
            sync_status: 'active',
            connected_at: new Date().toISOString(),
          }, { onConflict: 'brand_id,platform,account_id' })
        }
        break
      }

      case 'instagram': {
        const { access_token: shortToken } = await exchangeMetaCode(code, redirectUri)
        const { access_token } = await getLongLivedToken(shortToken)
        const user = await getMetaUserId(access_token)

        // Log granted permissions for debugging
        const permRes = await fetch(`${GRAPH}/me/permissions?access_token=${access_token}`)
        const permData = await permRes.json() as { data?: { permission: string; status: string }[] }
        const grantedPerms = permData.data?.filter(p => p.status === 'granted').map(p => p.permission) ?? []
        console.log('[instagram-oauth] granted permissions:', grantedPerms)

        // Fetch pages — include tasks field which helps surface New Page Experience pages
        const pagesRes = await fetch(
          `${GRAPH}/me/accounts?fields=id,name,access_token,tasks&access_token=${access_token}`
        )
        const pagesData: FacebookPagesResponse = await pagesRes.json()
        console.log('[instagram-oauth] /me/accounts response:', JSON.stringify(pagesData))

        // Fallback 1: field-expansion syntax — behaves differently for NPE pages
        let pages = pagesData.data ?? []
        if (pages.length === 0) {
          const meRes = await fetch(
            `${GRAPH}/me?fields=accounts{id,name,access_token,tasks}&access_token=${access_token}`
          )
          const meData = await meRes.json() as { accounts?: { data?: FacebookPage[] } }
          console.log('[instagram-oauth] /me?fields=accounts response:', JSON.stringify(meData))
          pages = meData.accounts?.data ?? []
        }

        // Fallback 2: try the IG account directly on the user node (NPE pages sometimes expose this)
        if (pages.length === 0) {
          const igDirectRes = await fetch(
            `${GRAPH}/me?fields=instagram_business_account{id,name}&access_token=${access_token}`
          )
          const igDirectData = await igDirectRes.json() as { instagram_business_account?: { id: string; name: string } }
          console.log('[instagram-oauth] /me?fields=instagram_business_account response:', JSON.stringify(igDirectData))
          if (igDirectData.instagram_business_account?.id) {
            await supabase.from('social_connections').upsert({
              brand_id: brand.id,
              platform: 'instagram',
              account_id: igDirectData.instagram_business_account.id,
              account_name: igDirectData.instagram_business_account.name ?? user.name,
              access_token: encrypt(access_token),
              sync_status: 'active',
              connected_at: new Date().toISOString(),
            }, { onConflict: 'brand_id,platform,account_id' })
            return NextResponse.redirect(`${APP_URL}/dashboard/content?connected=instagram`)
          }
        }

        const page = pages[0]

        if (!page) {
          const missing = ['pages_show_list', 'pages_read_engagement'].filter(p => !grantedPerms.includes(p))
          const reason = missing.length
            ? `missing_scopes:${missing.join(',')}`
            : 'no_pages_returned'
          return NextResponse.redirect(
            `${APP_URL}/dashboard/content?error=no_facebook_page&reason=${encodeURIComponent(reason)}`
          )
        }

        // Get the Instagram Business Account linked to the Facebook Page
        const igData = await getInstagramAccount(page.access_token, page.id)
        const igId = igData.instagram_business_account?.id

        if (!igId) {
          return NextResponse.redirect(
            `${APP_URL}/dashboard/content?error=no_ig_business_account&page=${encodeURIComponent(page.name)}`
          )
        }

        // Store long-lived user token — Instagram Graph API /media endpoint uses user tokens
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
