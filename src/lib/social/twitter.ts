import { createHash, randomBytes } from 'crypto'

const API = 'https://api.x.com'

export interface TwitterPost {
  id: string
  content: string
  reach: number
  impressions: number
  likes: number
  replies: number
  retweets: number
  bookmarks: number
  posted_at: string
}

// ── PKCE helpers ─────────────────────────────────────────────────────────────

export function generatePKCE() {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

// ── OAuth token exchange ──────────────────────────────────────────────────────

export async function exchangeTwitterCode(
  code: string,
  codeVerifier: string,
  redirectUri: string
) {
  const basic = Buffer.from(
    `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
  ).toString('base64')

  const body = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  })

  const res = await fetch(`${API}/2/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body,
  })
  if (!res.ok) throw new Error(`Twitter token exchange failed: ${await res.text()}`)
  return res.json() as Promise<{
    access_token: string
    refresh_token?: string
    expires_in?: number
  }>
}

export async function refreshTwitterToken(refreshToken: string) {
  const basic = Buffer.from(
    `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
  ).toString('base64')

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })

  const res = await fetch(`${API}/2/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body,
  })
  if (!res.ok) throw new Error(`Twitter token refresh failed: ${await res.text()}`)
  return res.json() as Promise<{ access_token: string; refresh_token?: string }>
}

export async function getTwitterUserId(accessToken: string) {
  const res = await fetch(`${API}/2/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Failed to get Twitter user ID')
  const data = await res.json() as { data: { id: string; name: string; username: string } }
  return data.data
}

export interface TwitterMention {
  id: string
  content: string
  authorHandle: string
  authorFollowers: number
  reach: number
  created_at: string
}

export async function fetchTwitterMentions(
  brandName: string,
  since: Date
): Promise<TwitterMention[]> {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN
  if (!bearerToken) return []

  const sinceIso = since.toISOString().replace(/\.\d{3}Z$/, 'Z')
  const query = encodeURIComponent(`"${brandName}" -is:retweet`)
  const url =
    `${API}/2/tweets/search/recent` +
    `?query=${query}` +
    `&tweet.fields=created_at,public_metrics,text,author_id` +
    `&expansions=author_id` +
    `&user.fields=public_metrics,username` +
    `&start_time=${sinceIso}` +
    `&max_results=100`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${bearerToken}` },
  })

  if (res.status === 402) {
    throw new Error(
      'X API returned 402 Payment Required. The tweets/search/recent endpoint requires the X Developer Basic plan ($100/month). Your current account is on the Free tier (write-only).'
    )
  }
  if (!res.ok) {
    throw new Error(`X API error ${res.status}: ${await res.text()}`)
  }

  const data = await res.json() as {
    data?: Array<{
      id: string
      text: string
      created_at: string
      author_id: string
      public_metrics: { impression_count: number }
    }>
    includes?: {
      users?: Array<{ id: string; username: string; public_metrics?: { followers_count: number } }>
    }
  }

  const userMap = new Map((data.includes?.users ?? []).map(u => [u.id, u]))

  return (data.data ?? []).map(t => {
    const author = userMap.get(t.author_id)
    return {
      id: t.id,
      content: t.text,
      authorHandle: author?.username ?? '',
      authorFollowers: author?.public_metrics?.followers_count ?? 0,
      reach: t.public_metrics.impression_count,
      created_at: t.created_at,
    }
  })
}

// ── User mentions timeline (FREE tier — uses connected OAuth token) ───────────
// Unlike tweets/search/recent (requires $100/mo Basic plan), this endpoint
// returns tweets that @mention the connected account and is available on the
// free tier with user context OAuth.
export async function fetchTwitterUserMentions(
  userId: string,
  accessToken: string,
  since: Date
): Promise<TwitterMention[]> {
  const sinceIso = since.toISOString().replace(/\.\d{3}Z$/, 'Z')
  const url =
    `${API}/2/users/${userId}/mentions` +
    `?tweet.fields=created_at,public_metrics,text,author_id` +
    `&expansions=author_id` +
    `&user.fields=public_metrics,username` +
    `&start_time=${sinceIso}` +
    `&max_results=100`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (res.status === 402) {
    throw new Error('X_CREDITS_DEPLETED')
  }
  if (res.status === 403 || res.status === 401) {
    throw new Error(`X mentions auth error ${res.status}: token may be expired or missing tweet.read scope`)
  }
  if (!res.ok) {
    throw new Error(`X API mentions error ${res.status}: ${await res.text()}`)
  }

  const data = await res.json() as {
    data?: Array<{
      id: string
      text: string
      created_at: string
      author_id: string
      public_metrics: { impression_count: number }
    }>
    includes?: {
      users?: Array<{ id: string; username: string; public_metrics?: { followers_count: number } }>
    }
  }

  if (!data.data?.length) return []

  const userMap = new Map((data.includes?.users ?? []).map(u => [u.id, u]))
  return data.data.map(t => {
    const author = userMap.get(t.author_id)
    return {
      id: t.id,
      content: t.text,
      authorHandle: author?.username ?? '',
      authorFollowers: author?.public_metrics?.followers_count ?? 0,
      reach: t.public_metrics.impression_count,
      created_at: t.created_at,
    }
  })
}

// Searches recent tweets that mention the brand name as text or hashtag.
// Uses the connected user's OAuth token — same credential as fetchTwitterUserMentions.
// Excludes retweets and the brand's own tweets so results are third-party mentions only.
export async function fetchTwitterKeywordMentions(
  brandName: string,
  excludeUsername: string,   // handle WITHOUT @, e.g. "jarafoods"
  accessToken: string,
  since: Date,
  extraHashtags: string[] = []
): Promise<TwitterMention[]> {
  // Build base hashtag from brand name: "Jara Foods" → "#jarafoods"
  const baseSlug = brandName.toLowerCase().replace(/[^a-z0-9]/g, '')
  const allHashtags = [...new Set([baseSlug, ...extraHashtags.map(h => h.replace(/^#/, '').toLowerCase())])]
  const hashtagPart = allHashtags.map(h => `#${h}`).join(' OR ')

  // Exact brand name phrase OR any of the hashtags, no retweets, exclude brand's own tweets
  const query = `("${brandName}" OR ${hashtagPart}) -is:retweet${excludeUsername ? ` -(from:${excludeUsername})` : ''}`
  const sinceIso = since.toISOString().replace(/\.\d{3}Z$/, 'Z')

  const url =
    `${API}/2/tweets/search/recent` +
    `?query=${encodeURIComponent(query)}` +
    `&tweet.fields=created_at,public_metrics,text,author_id` +
    `&expansions=author_id` +
    `&user.fields=public_metrics,username` +
    `&start_time=${sinceIso}` +
    `&max_results=100`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (res.status === 402) throw new Error('X_CREDITS_DEPLETED')
  if (res.status === 403 || res.status === 401) {
    throw new Error(`X keyword search auth error ${res.status}: ${await res.text()}`)
  }
  if (!res.ok) {
    throw new Error(`X API keyword search error ${res.status}: ${await res.text()}`)
  }

  const data = await res.json() as {
    data?: Array<{
      id: string
      text: string
      created_at: string
      author_id: string
      public_metrics: { impression_count: number }
    }>
    includes?: {
      users?: Array<{ id: string; username: string; public_metrics?: { followers_count: number } }>
    }
  }

  if (!data.data?.length) return []

  const userMap = new Map((data.includes?.users ?? []).map(u => [u.id, u]))
  return data.data.map(t => {
    const author = userMap.get(t.author_id)
    return {
      id: t.id,
      content: t.text,
      authorHandle: author?.username ?? '',
      authorFollowers: author?.public_metrics?.followers_count ?? 0,
      reach: t.public_metrics.impression_count,
      created_at: t.created_at,
    }
  })
}

export async function fetchTwitterPosts(userId: string, accessToken: string, since: Date): Promise<TwitterPost[]> {
  const sinceIso = since.toISOString().replace(/\.\d{3}Z$/, 'Z')
  const fields = 'created_at,public_metrics,text'
  const res = await fetch(
    `${API}/2/users/${userId}/tweets?tweet.fields=${fields}&start_time=${sinceIso}&max_results=100&exclude=retweets,replies`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) return []

  const data = await res.json() as {
    data?: {
      id: string; text: string; created_at: string
      public_metrics: { like_count: number; reply_count: number; retweet_count: number; bookmark_count: number; impression_count: number }
    }[]
  }

  return (data.data ?? []).map(t => ({
    id: t.id,
    content: t.text,
    reach: t.public_metrics.impression_count,
    impressions: t.public_metrics.impression_count,
    likes: t.public_metrics.like_count,
    replies: t.public_metrics.reply_count,
    retweets: t.public_metrics.retweet_count,
    bookmarks: t.public_metrics.bookmark_count,
    posted_at: t.created_at,
  }))
}
