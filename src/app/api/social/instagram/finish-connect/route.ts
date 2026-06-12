import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { Redis } from '@upstash/redis'
import { encrypt } from '@/lib/crypto'
import { getInstagramAccount } from '@/lib/social/meta'

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

  const pending = await redis.get<{ accessToken: string; userId: string }>(`ig-pending:${key}`)
  if (!pending) {
    return NextResponse.json({ error: 'Session expired. Please connect Instagram again.' }, { status: 400 })
  }

  const { accessToken, userId } = pending

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

  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .single()

  if (!member) return NextResponse.json({ error: 'Workspace not found' }, { status: 400 })

  const { data: brand } = await supabase
    .from('brands')
    .select('id')
    .eq('workspace_id', member.workspace_id)
    .single()

  if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 400 })

  await supabase.from('social_connections').upsert({
    brand_id: brand.id,
    platform: 'instagram',
    account_id: pageData.instagram_business_account.id,
    account_name: pageData.name ?? `Page ${pageId}`,
    access_token: encrypt(accessToken),
    sync_status: 'active',
    connected_at: new Date().toISOString(),
  }, { onConflict: 'brand_id,platform,account_id' })

  await redis.del(`ig-pending:${key}`)

  return NextResponse.json({ ok: true })
}
