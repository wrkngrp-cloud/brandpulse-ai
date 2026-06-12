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
  if (!res.ok) return []

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
