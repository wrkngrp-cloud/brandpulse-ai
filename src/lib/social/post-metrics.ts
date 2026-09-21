/**
 * Pull engagement metrics for a single social post from its public URL.
 *
 * What is reachable, and what is not:
 *
 *   Public counts   likes, comments, and on some platforms views/plays. These
 *                   are readable without the creator's permission.
 *   Owner insights  reach, impressions, saves, shares. No platform exposes
 *                   these for someone else's post. That is a permission model,
 *                   not an API tier, so no amount of spend unlocks them. They
 *                   stay manual until the creator connects their own account.
 *
 * Every number we return is tagged `pulled`. Anything we cannot reach is left
 * absent and listed in `ownerOnly`, so the form can label it honestly.
 */

import { decrypt } from '@/lib/crypto'

export type MetricSource = 'pulled' | 'entered' | 'estimated'

export type MetricKey = 'views' | 'likes' | 'comments' | 'shares' | 'saves' | 'reach'

export interface PostMetrics {
  views?:    number
  likes?:    number
  comments?: number
  shares?:   number
  saves?:    number
  reach?:    number
}

export interface PostMetricsResult {
  metrics:  PostMetrics
  /** Per-metric provenance for everything present in `metrics`. */
  sources:  Partial<Record<MetricKey, MetricSource>>
  /** Metrics this platform only ever shows the post's owner. */
  ownerOnly: MetricKey[]
  /** Plain-English reason nothing came back, or null when metrics were pulled. */
  note:     string | null
}

/* Only the reads this module needs. The client's own generics reject the
   narrow row shapes below, and typing this against the generated database
   types would couple a connector helper to them for no gain. Same approach as
   `Sb` in src/lib/demo/module-pack.ts. */
/* eslint-disable @typescript-eslint/no-explicit-any */
type Reader = { from: (table: string) => any }

const GRAPH        = 'https://graph.facebook.com/v20.0'
const X_API        = 'https://api.x.com'
const YT_API       = 'https://www.googleapis.com/youtube/v3'
const FETCH_TIMEOUT = 8000

/** Owner-only metrics per platform, for the honest-labelling path. */
const OWNER_ONLY: Record<string, MetricKey[]> = {
  instagram: ['reach', 'saves', 'shares'],
  twitter:   ['reach'],
  youtube:   ['reach'],
  tiktok:    ['views', 'shares', 'reach'],
  facebook:  ['reach', 'shares'],
}

function empty(platform: string, note: string | null): PostMetricsResult {
  return { metrics: {}, sources: {}, ownerOnly: OWNER_ONLY[platform] ?? [], note }
}

function num(v: unknown): number | undefined {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : undefined
}

// ── URL parsing ───────────────────────────────────────────────────────────────

/** Instagram shortcode from /p/CODE/ or /reel/CODE/ or /tv/CODE/. */
export function instagramShortcode(url: string): string | null {
  return url.match(/instagram\.com\/(?:[^/]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/)?.[1] ?? null
}

/** Numeric tweet id from /status/123. */
export function tweetId(url: string): string | null {
  return url.match(/(?:twitter|x)\.com\/[^/]+\/status(?:es)?\/(\d+)/)?.[1] ?? null
}

/** YouTube video id from watch?v=, youtu.be/, or /shorts/. */
export function youtubeVideoId(url: string): string | null {
  return (
    url.match(/[?&]v=([A-Za-z0-9_-]{11})/)?.[1] ??
    url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/)?.[1] ??
    url.match(/\/shorts\/([A-Za-z0-9_-]{11})/)?.[1] ??
    null
  )
}

// ── Instagram: business_discovery on the connected account ────────────────────

interface IgMedia {
  id:                 string
  permalink?:         string
  like_count?:        number
  comments_count?:    number
  play_count?:        number
  media_product_type?: string
}

/**
 * Reads another public Business/Creator account's recent media through the
 * brand's own connected Instagram account. Matched to the pasted URL by
 * shortcode, because business_discovery queries by username and returns a list.
 *
 * `play_count` is not present on every media type and older API versions reject
 * it outright, so it is requested on a first attempt and dropped on a retry.
 */
async function fetchInstagram(
  igUserId:    string,
  accessToken: string,
  username:    string,
  shortcode:   string,
): Promise<PostMetricsResult> {
  const base = (mediaFields: string) =>
    `${GRAPH}/${igUserId}?fields=business_discovery.username(${encodeURIComponent(username)})` +
    `%7Bmedia.limit(50)%7B${mediaFields}%7D%7D` +
    `&access_token=${encodeURIComponent(accessToken)}`

  const attempts = [
    'id,permalink,like_count,comments_count,media_product_type,play_count',
    'id,permalink,like_count,comments_count,media_product_type',
  ]

  let media: IgMedia[] | null = null
  let lastError = ''

  for (const fields of attempts) {
    try {
      const res = await fetch(base(fields), { signal: AbortSignal.timeout(FETCH_TIMEOUT) })
      if (!res.ok) {
        lastError = `Instagram Graph API ${res.status}`
        continue
      }
      const data = await res.json() as { business_discovery?: { media?: { data?: IgMedia[] } } }
      media = data.business_discovery?.media?.data ?? []
      break
    } catch {
      lastError = 'Instagram Graph API did not respond'
    }
  }

  if (!media) {
    return empty('instagram', `${lastError}. Enter the metrics manually.`)
  }

  const match = media.find(m => m.permalink && instagramShortcode(m.permalink) === shortcode)
  if (!match) {
    return empty(
      'instagram',
      media.length === 0
        ? `No public media found for @${username}. Instagram only exposes Business and Creator accounts, so a personal account returns nothing.`
        : `That post was not in @${username}'s 50 most recent posts, so its counts could not be read. Enter them manually.`,
    )
  }

  const metrics: PostMetrics = {}
  const sources: Partial<Record<MetricKey, MetricSource>> = {}

  const likes = num(match.like_count)
  if (likes !== undefined)    { metrics.likes    = likes;  sources.likes    = 'pulled' }
  const comments = num(match.comments_count)
  if (comments !== undefined) { metrics.comments = comments; sources.comments = 'pulled' }
  const plays = num(match.play_count)
  if (plays !== undefined)    { metrics.views    = plays;  sources.views    = 'pulled' }

  return {
    metrics,
    sources,
    ownerOnly: OWNER_ONLY.instagram,
    note: Object.keys(metrics).length === 0
      ? 'Instagram returned the post but no public counts for it. Enter the metrics manually.'
      : null,
  }
}

// ── X: tweet lookup on the pay-per-use plan ───────────────────────────────────

/**
 * GET /2/tweets returns public_metrics for any public post. Billed per read on
 * the pay-per-use plan, so a depleted balance answers 402 and we say so rather
 * than failing silently.
 *
 * impression_count is only returned for posts owned by the authenticating
 * account, so it is taken when present and treated as owner-only when absent.
 */
async function fetchTwitter(id: string, bearerToken: string): Promise<PostMetricsResult> {
  const url = `${X_API}/2/tweets?ids=${id}&tweet.fields=public_metrics`

  let res: Response
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${bearerToken}` },
      signal:  AbortSignal.timeout(FETCH_TIMEOUT),
    })
  } catch {
    return empty('twitter', 'X did not respond. Enter the metrics manually.')
  }

  if (res.status === 402) {
    return empty('twitter', 'X credits are depleted, so the post could not be read. Top up the balance or enter the metrics manually.')
  }
  if (res.status === 429) {
    return empty('twitter', 'X rate limit reached. Try again shortly or enter the metrics manually.')
  }
  if (res.status === 401 || res.status === 403) {
    return empty('twitter', 'X rejected the credential for post reads. Check the app has read access, then try again.')
  }
  if (!res.ok) {
    return empty('twitter', `X returned ${res.status}. Enter the metrics manually.`)
  }

  const data = await res.json().catch(() => null) as {
    data?: Array<{
      public_metrics?: {
        like_count?:       number
        reply_count?:      number
        retweet_count?:    number
        quote_count?:      number
        bookmark_count?:   number
        impression_count?: number
      }
    }>
  } | null

  const pm = data?.data?.[0]?.public_metrics
  if (!pm) {
    return empty('twitter', 'That post is not publicly readable. It may be deleted, private or age-restricted.')
  }

  const metrics: PostMetrics = {}
  const sources: Partial<Record<MetricKey, MetricSource>> = {}

  const likes = num(pm.like_count)
  if (likes !== undefined)  { metrics.likes    = likes; sources.likes    = 'pulled' }
  const replies = num(pm.reply_count)
  if (replies !== undefined) { metrics.comments = replies; sources.comments = 'pulled' }

  // Reposts and quotes are both amplification, so they add up to shares.
  const reposts = num(pm.retweet_count)
  const quotes  = num(pm.quote_count)
  if (reposts !== undefined || quotes !== undefined) {
    metrics.shares  = (reposts ?? 0) + (quotes ?? 0)
    sources.shares  = 'pulled'
  }
  const bookmarks = num(pm.bookmark_count)
  if (bookmarks !== undefined) { metrics.saves = bookmarks; sources.saves = 'pulled' }

  // Returned only for the authenticating account's own posts.
  const impressions = num(pm.impression_count)
  const ownerOnly: MetricKey[] = ['reach']
  if (impressions !== undefined) {
    metrics.views  = impressions
    sources.views  = 'pulled'
  }

  return { metrics, sources, ownerOnly, note: null }
}

// ── YouTube: fully public with an API key ─────────────────────────────────────

async function fetchYoutube(videoId: string, apiKey: string): Promise<PostMetricsResult> {
  const url = `${YT_API}/videos?part=statistics&id=${videoId}&key=${encodeURIComponent(apiKey)}`

  let res: Response
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT) })
  } catch {
    return empty('youtube', 'YouTube did not respond. Enter the metrics manually.')
  }
  if (!res.ok) {
    return empty('youtube', `YouTube Data API returned ${res.status}. Check the saved API key.`)
  }

  const data = await res.json().catch(() => null) as {
    items?: Array<{ statistics?: { viewCount?: string; likeCount?: string; commentCount?: string } }>
  } | null

  const st = data?.items?.[0]?.statistics
  if (!st) return empty('youtube', 'That video is not publicly readable.')

  const metrics: PostMetrics = {}
  const sources: Partial<Record<MetricKey, MetricSource>> = {}

  const views = num(st.viewCount)
  if (views !== undefined)    { metrics.views    = views;    sources.views    = 'pulled' }
  const likes = num(st.likeCount)
  if (likes !== undefined)    { metrics.likes    = likes;    sources.likes    = 'pulled' }
  const comments = num(st.commentCount)
  if (comments !== undefined) { metrics.comments = comments; sources.comments = 'pulled' }

  return { metrics, sources, ownerOnly: OWNER_ONLY.youtube, note: null }
}

// ── entry point ───────────────────────────────────────────────────────────────

/**
 * The caller must already have verified that `brandId` belongs to the signed-in
 * user; this reads connector rows for that brand.
 */
export async function fetchPostMetrics(opts: {
  supabase:          Reader
  brandId:           string
  platform:          string
  postUrl:           string
  influencerHandle?: string | null
}): Promise<PostMetricsResult> {
  const { supabase, brandId, platform, postUrl, influencerHandle } = opts

  if (platform === 'tiktok') {
    return empty(
      'tiktok',
      'TikTok has no public lookup for another account’s video. Its API needs the creator to connect their own account, so enter the metrics manually.',
    )
  }
  if (platform === 'facebook') {
    return empty('facebook', 'Facebook post counts need the owning Page connected. Enter the metrics manually.')
  }

  if (platform === 'instagram') {
    const shortcode = instagramShortcode(postUrl)
    if (!shortcode) return empty('instagram', 'That does not look like an Instagram post or reel link.')

    const username = (influencerHandle ?? '').trim().replace(/^@/, '')
    if (!username) {
      return empty('instagram', 'This creator has no Instagram handle saved, which Instagram needs to look the post up.')
    }

    const { data } = await supabase
      .from('social_connections')
      .select('account_id, access_token')
      .eq('brand_id', brandId)
      .eq('platform', 'instagram')
      .maybeSingle()

    const conn = data as { account_id?: string | null; access_token?: string | null } | null
    if (!conn?.account_id || !conn.access_token) {
      return empty('instagram', 'Connect your own Instagram Business account first. Instagram only allows these reads through a connected account.')
    }

    let token: string
    try {
      token = decrypt(conn.access_token)
    } catch {
      return empty('instagram', 'The saved Instagram token could not be read. Reconnect the account.')
    }

    return fetchInstagram(conn.account_id, token, username, shortcode)
  }

  if (platform === 'twitter') {
    const id = tweetId(postUrl)
    if (!id) return empty('twitter', 'That does not look like a link to a specific X post.')

    const bearer = process.env.TWITTER_BEARER_TOKEN
    if (!bearer) {
      return empty('twitter', 'X post reads are not configured on this deployment.')
    }
    return fetchTwitter(id, bearer)
  }

  if (platform === 'youtube') {
    const videoId = youtubeVideoId(postUrl)
    if (!videoId) return empty('youtube', 'That does not look like a YouTube video link.')

    const { data } = await supabase
      .from('youtube_api_configs')
      .select('api_key')
      .eq('brand_id', brandId)
      .maybeSingle()

    const row = data as { api_key?: string | null } | null
    if (!row?.api_key) {
      return empty('youtube', 'Save a YouTube Data API key in Connectors to read video statistics.')
    }

    let key: string
    try {
      key = decrypt(row.api_key)
    } catch {
      return empty('youtube', 'The saved YouTube API key could not be read. Save it again.')
    }

    return fetchYoutube(videoId, key)
  }

  return empty(platform, 'Unrecognised platform. Enter the metrics manually.')
}
