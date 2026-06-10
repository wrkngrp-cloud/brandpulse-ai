const GRAPH = 'https://graph.facebook.com/v21.0'

export interface MetaPost {
  id: string
  platform: 'instagram' | 'facebook'
  content: string
  media_url?: string
  content_type: string
  reach: number
  impressions: number
  likes: number
  comments: number
  shares: number
  saves: number
  video_views: number
  posted_at: string
}

export async function exchangeMetaCode(code: string, redirectUri: string) {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    redirect_uri: redirectUri,
    code,
  })
  const res = await fetch(`${GRAPH}/oauth/access_token?${params}`)
  if (!res.ok) throw new Error(`Meta token exchange failed: ${await res.text()}`)
  return res.json() as Promise<{ access_token: string; expires_in?: number }>
}

export async function getLongLivedToken(shortToken: string) {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    fb_exchange_token: shortToken,
  })
  const res = await fetch(`${GRAPH}/oauth/access_token?${params}`)
  if (!res.ok) throw new Error(`Meta long-lived token failed: ${await res.text()}`)
  return res.json() as Promise<{ access_token: string; expires_in: number }>
}

export async function getMetaUserId(accessToken: string) {
  const res = await fetch(`${GRAPH}/me?fields=id,name&access_token=${accessToken}`)
  if (!res.ok) throw new Error('Failed to get Meta user ID')
  return res.json() as Promise<{ id: string; name: string }>
}

export async function getInstagramAccount(pageAccessToken: string, pageId: string) {
  const res = await fetch(
    `${GRAPH}/${pageId}?fields=instagram_business_account&access_token=${pageAccessToken}`
  )
  if (!res.ok) throw new Error('Failed to get Instagram account')
  return res.json() as Promise<{ instagram_business_account?: { id: string } }>
}

export async function fetchInstagramPosts(igAccountId: string, accessToken: string, since: Date): Promise<MetaPost[]> {
  const sinceUnix = Math.floor(since.getTime() / 1000)
  const fields = 'id,media_type,media_url,caption,timestamp,like_count,comments_count'
  const res = await fetch(
    `${GRAPH}/${igAccountId}/media?fields=${fields}&since=${sinceUnix}&limit=50&access_token=${accessToken}`
  )
  if (!res.ok) return []
  const data = await res.json() as { data?: Record<string, unknown>[] }

  const posts: MetaPost[] = []
  for (const item of data.data ?? []) {
    // Fetch insights for reach/impressions
    const insightRes = await fetch(
      `${GRAPH}/${item.id}/insights?metric=impressions,reach,saved,video_views&period=lifetime&access_token=${accessToken}`
    )
    const insights = insightRes.ok ? await insightRes.json() : { data: [] }
    const metricsMap = Object.fromEntries(
      (insights.data ?? []).map((m: { name: string; values: { value: number }[] }) => [m.name, m.values[0]?.value ?? 0])
    )

    posts.push({
      id: String(item.id),
      platform: 'instagram',
      content: String(item.caption ?? ''),
      media_url: item.media_url as string | undefined,
      content_type: mapMediaType(String(item.media_type ?? '')),
      reach: metricsMap['reach'] ?? 0,
      impressions: metricsMap['impressions'] ?? 0,
      likes: Number(item.like_count ?? 0),
      comments: Number(item.comments_count ?? 0),
      shares: 0,
      saves: metricsMap['saved'] ?? 0,
      video_views: metricsMap['video_views'] ?? 0,
      posted_at: String(item.timestamp),
    })
  }
  return posts
}

export async function fetchFacebookPosts(pageId: string, accessToken: string, since: Date): Promise<MetaPost[]> {
  const sinceUnix = Math.floor(since.getTime() / 1000)
  const fields = 'id,message,created_time,likes.summary(true),comments.summary(true),shares'
  const res = await fetch(
    `${GRAPH}/${pageId}/posts?fields=${fields}&since=${sinceUnix}&limit=50&access_token=${accessToken}`
  )
  if (!res.ok) return []
  const data = await res.json() as { data?: Record<string, unknown>[] }

  return (data.data ?? []).map(item => ({
    id: String(item.id),
    platform: 'facebook' as const,
    content: String(item.message ?? ''),
    content_type: 'text',
    reach: 0,
    impressions: 0,
    likes: (item.likes as { summary?: { total_count?: number } })?.summary?.total_count ?? 0,
    comments: (item.comments as { summary?: { total_count?: number } })?.summary?.total_count ?? 0,
    shares: (item.shares as { count?: number })?.count ?? 0,
    saves: 0,
    video_views: 0,
    posted_at: String(item.created_time),
  }))
}

function mapMediaType(type: string): string {
  const map: Record<string, string> = {
    IMAGE: 'image', VIDEO: 'video', CAROUSEL_ALBUM: 'carousel',
    REEL: 'reel', STORY: 'story',
  }
  return map[type] ?? 'image'
}
