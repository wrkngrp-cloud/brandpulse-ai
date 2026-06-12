const GRAPH = 'https://graph.facebook.com/v20.0'

export interface InstagramMention {
  id: string
  content: string
  authorHandle: string
  reach: number
  created_at: string
  permalink?: string
}

async function getHashtagId(
  igUserId: string,
  accessToken: string,
  hashtag: string
): Promise<string | null> {
  const res = await fetch(
    `${GRAPH}/${igUserId}/ig_hashtags?q=${encodeURIComponent(hashtag)}&access_token=${accessToken}`
  )
  if (!res.ok) return null
  const data = await res.json() as { data?: [{ id: string }] }
  return data.data?.[0]?.id ?? null
}

// Searches recent posts containing a hashtag. Available free on IG Business accounts.
// Rate limit: 30 unique hashtags per 7 days per Business Account.
export async function fetchInstagramHashtagMentions(
  igUserId: string,
  accessToken: string,
  hashtags: string[],
  since: Date
): Promise<InstagramMention[]> {
  const sinceMs = since.getTime()
  const mentions: InstagramMention[] = []

  for (const hashtag of hashtags) {
    const hashtagId = await getHashtagId(igUserId, accessToken, hashtag)
    if (!hashtagId) continue

    const res = await fetch(
      `${GRAPH}/${hashtagId}/recent_media` +
      `?user_id=${igUserId}` +
      `&fields=id,caption,media_type,timestamp,like_count,comments_count,permalink` +
      `&access_token=${accessToken}`
    )
    if (!res.ok) continue

    const data = await res.json() as {
      data?: Array<{
        id: string
        caption?: string
        timestamp: string
        like_count?: number
        comments_count?: number
        permalink?: string
      }>
    }

    for (const post of (data.data ?? [])) {
      if (new Date(post.timestamp).getTime() < sinceMs) continue
      mentions.push({
        id: `igh_${post.id}`,
        content: post.caption ?? `[#${hashtag} post]`,
        authorHandle: '',
        reach: (post.like_count ?? 0) + (post.comments_count ?? 0),
        created_at: post.timestamp,
        permalink: post.permalink,
      })
    }
  }

  return mentions
}

// Returns posts where the IG Business Account is @tagged by other users.
// Free with Business account, no rate limit beyond standard Graph API limits.
export async function fetchInstagramTaggedMedia(
  igUserId: string,
  accessToken: string,
  since: Date
): Promise<InstagramMention[]> {
  const res = await fetch(
    `${GRAPH}/${igUserId}/tags` +
    `?fields=id,caption,media_type,timestamp,like_count,comments_count,permalink,owner{username}` +
    `&access_token=${accessToken}`
  )
  if (!res.ok) return []

  const sinceMs = since.getTime()
  const data = await res.json() as {
    data?: Array<{
      id: string
      caption?: string
      timestamp: string
      like_count?: number
      comments_count?: number
      permalink?: string
      owner?: { username?: string }
    }>
  }

  return (data.data ?? [])
    .filter(post => new Date(post.timestamp).getTime() >= sinceMs)
    .map(post => ({
      id: `igt_${post.id}`,
      content: post.caption ?? '[Tagged post]',
      authorHandle: post.owner?.username ?? '',
      reach: (post.like_count ?? 0) + (post.comments_count ?? 0),
      created_at: post.timestamp,
      permalink: post.permalink,
    }))
}
