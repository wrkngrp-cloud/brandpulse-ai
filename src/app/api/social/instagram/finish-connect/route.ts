import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { Redis } from '@upstash/redis'
import { encrypt } from '@/lib/crypto'
import { getInstagramAccount } from '@/lib/social/meta'
import { metaUserIdForToken } from '@/lib/social/meta'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const GRAPH = 'https://graph.facebook.com/v21.0'

export async function POST(request: NextRequest) {
  const { key, pageId } = await request.json() as { key: string; pageId: string }

  if (!key || !pageId) {
    return NextResponse.json({ error: 'Missing key or pageId' }, { status: 400 })
  }

  const pending = await redis.get<{ accessToken: string; userId: string; brandId: string }>(`ig-pending:${key}`).catch(() => null)
  if (!pending) {
    return NextResponse.json({ error: 'Session expired. Please connect Instagram again.' }, { status: 400 })
  }

  const { accessToken, brandId } = pending

  // Fetch the page and its linked Instagram Business Account
  const pageRes = await fetch(
    `${GRAPH}/${pageId.trim()}?fields=id,name,access_token,instagram_business_account&access_token=${accessToken}`
  )
  const pageData = await pageRes.json() as {
    id?: string
    name?: string
    access_token?: string
    instagram_business_account?: { id: string }
    error?: { message: string }
  }

  if (pageData.error) {
    return NextResponse.json(
      { error: `Facebook Page not found or not accessible: ${pageData.error.message}` },
      { status: 400 }
    )
  }

  if (!pageData.instagram_business_account?.id) {
    // Try using our helper with the page token if present, else user token
    const pageToken = pageData.access_token ?? accessToken
    const igData = await getInstagramAccount(pageToken, pageData.id ?? pageId.trim())
    const igId = igData.instagram_business_account?.id

    if (!igId) {
      return NextResponse.json(
        { error: `Found "${pageData.name ?? pageId}" but it has no linked Instagram Business account. Switch your Instagram to a Business or Creator account and link it to this Page first.` },
        { status: 400 }
      )
    }

    pageData.instagram_business_account = { id: igId }
  }

  const supabase = await createServiceClient()
  // Who connected it, for Meta data deletion requests.
  const metaUserId = await metaUserIdForToken(accessToken)

  const { error: saveError } = await supabase.from('social_connections').upsert({
    brand_id: brandId,
    platform: 'instagram',
    account_id: pageData.instagram_business_account.id,
    account_name: pageData.name ?? `Page ${pageId}`,
    access_token: encrypt(accessToken),
    meta_user_id: metaUserId,
    sync_status: 'active',
    connected_at: new Date().toISOString(),
  }, { onConflict: 'brand_id,platform,account_id' })
  if (saveError) {
    console.error('[instagram-finish] save failed:', saveError.message)
    return NextResponse.json({ error: 'We could not save the connection. Try again.' }, { status: 500 })
  }

  await redis.del(`ig-pending:${key}`).catch(() => { /* best-effort cleanup; the key expires on its own TTL anyway */ })

  return NextResponse.json({ ok: true })
}
