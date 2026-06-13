import { createServiceClient } from '@/lib/supabase/server'
import { fetchTwitterUserMentions, refreshTwitterToken } from '@/lib/social/twitter'
import { fetchInstagramHashtagMentions, fetchInstagramTaggedMedia } from '@/lib/social/instagram'
import { classifySentiment } from '@/lib/ai/classify-sentiment'
import { decrypt, encrypt } from '@/lib/crypto'

export interface CrawlResult {
  mentionsFound: number
  classified: number
  sources: string[]
  platformErrors: Record<string, string>
  error?: string
}

interface RawMention {
  platform: string
  external_id: string
  content: string
  author_handle: string
  author_followers: number
  reach: number
  created_at: string
}

interface PlatformStats {
  volume: number
  score: number
  positive_pct: number
  neutral_pct: number
  negative_pct: number
}

// 'Kuda Bank' → ['kudabank', 'kuda']
function deriveHashtags(brandName: string): string[] {
  const slug = brandName.toLowerCase().replace(/[^a-z0-9]/g, '')
  const first = brandName.toLowerCase().split(/\s+/)[0].replace(/[^a-z0-9]/g, '')
  return [...new Set([slug, first])].filter(h => h.length > 2)
}

function computePlatformStats(
  mentions: Array<{ sentiment_label: string | null; platform: string }>
): Record<string, PlatformStats> {
  const platforms = [...new Set(mentions.map(m => m.platform))]
  const result: Record<string, PlatformStats> = {}

  for (const platform of platforms) {
    const pm = mentions.filter(m => m.platform === platform)
    const vol = pm.length
    if (!vol) continue
    const pos = pm.filter(m => m.sentiment_label === 'positive').length
    const neu = pm.filter(m => m.sentiment_label === 'neutral').length
    const neg = pm.filter(m => m.sentiment_label === 'negative').length
    const mix = pm.filter(m => m.sentiment_label === 'mixed').length
    result[platform] = {
      volume: vol,
      score: Number(((pos * 100 + (neu + mix) * 50) / vol).toFixed(2)),
      positive_pct: Number(((pos / vol) * 100).toFixed(2)),
      neutral_pct: Number((((neu + mix) / vol) * 100).toFixed(2)),
      negative_pct: Number(((neg / vol) * 100).toFixed(2)),
    }
  }
  return result
}

export async function runCrawl(brandId: string, runId?: string): Promise<CrawlResult> {
  const supabase = await createServiceClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const today = new Date().toISOString().slice(0, 10)

  const { data: brand } = await supabase
    .from('brands').select('id, name').eq('id', brandId).single()
  if (!brand) throw new Error('Brand not found')

  // ── 1. Get connected social accounts ──────────────────────────────────────
  const { data: connections } = await supabase
    .from('social_connections')
    .select('platform, account_id, access_token, refresh_token, account_name')
    .eq('brand_id', brandId)
    .eq('sync_status', 'active')

  const twitterConn  = connections?.find(c => c.platform === 'twitter')
  const instagramConn = connections?.find(c => c.platform === 'instagram')

  // ── 2. Fetch mentions from all connected platforms ─────────────────────────
  const allMentions: RawMention[] = []
  const sources: string[] = []
  const platformErrors: Record<string, string> = {}

  if (twitterConn?.account_id && twitterConn.access_token) {
    try {
      let accessToken = decrypt(twitterConn.access_token)

      // Inner fetch — on 401 attempt one token refresh before giving up
      const fetchMentions = async () =>
        fetchTwitterUserMentions(twitterConn.account_id!, accessToken, since)

      let tweets = await fetchMentions().catch(async (err: unknown) => {
        const msg = err instanceof Error ? err.message : ''
        const isExpired = (msg.includes('401') || msg.includes('auth error')) && !msg.includes('X_CREDITS_DEPLETED')
        if (!isExpired || !twitterConn.refresh_token) throw err

        // Refresh the token
        const refreshed = await refreshTwitterToken(decrypt(twitterConn.refresh_token))
        accessToken = refreshed.access_token

        // Persist refreshed tokens so the next crawl works without re-auth
        await supabase.from('social_connections').update({
          access_token: encrypt(refreshed.access_token),
          ...(refreshed.refresh_token ? { refresh_token: encrypt(refreshed.refresh_token) } : {}),
        }).eq('brand_id', brandId).eq('platform', 'twitter')

        return fetchMentions()
      })

      allMentions.push(...tweets.map(t => ({
        platform: 'twitter',
        external_id: t.id,
        content: t.content,
        author_handle: t.authorHandle,
        author_followers: t.authorFollowers,
        reach: t.reach,
        created_at: t.created_at,
      })))
      sources.push('twitter')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('[runCrawl] Twitter mentions failed:', msg)
      platformErrors.twitter = msg
    }
  }

  if (instagramConn?.account_id && instagramConn.access_token) {
    try {
      const hashtags = deriveHashtags(brand.name)
      const igToken = decrypt(instagramConn.access_token)
      const [hashtagMentions, taggedMedia] = await Promise.all([
        fetchInstagramHashtagMentions(instagramConn.account_id, igToken, hashtags, since),
        fetchInstagramTaggedMedia(instagramConn.account_id, igToken, since),
      ])
      allMentions.push(...[...hashtagMentions, ...taggedMedia].map(m => ({
        platform: 'instagram',
        external_id: m.id,
        content: m.content,
        author_handle: m.authorHandle,
        author_followers: 0,
        reach: m.reach,
        created_at: m.created_at,
      })))
      sources.push('instagram')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('[runCrawl] Instagram mentions failed:', msg)
      platformErrors.instagram = msg
    }
  }

  // ── 3. Dedup and insert fresh mentions ────────────────────────────────────
  let mentionsFound = 0

  if (allMentions.length) {
    const byPlatform = allMentions.reduce<Record<string, RawMention[]>>((acc, m) => {
      ;(acc[m.platform] ??= []).push(m)
      return acc
    }, {})

    for (const [platform, platformMentions] of Object.entries(byPlatform)) {
      const externalIds = platformMentions.map(m => m.external_id)
      const { data: existing } = await supabase
        .from('mentions').select('external_id')
        .eq('brand_id', brandId).eq('platform', platform)
        .in('external_id', externalIds)

      const seenIds = new Set((existing ?? []).map(m => m.external_id))
      const fresh = platformMentions.filter(m => !seenIds.has(m.external_id))

      if (fresh.length) {
        const rows = fresh.map(m => ({
          brand_id: brandId,
          platform: m.platform,
          external_id: m.external_id,
          content: m.content,
          author_handle: m.author_handle,
          author_followers: m.author_followers,
          reach: m.reach,
          created_at: m.created_at,
        }))
        const { error } = await supabase.from('mentions').insert(rows)
        if (!error) mentionsFound += rows.length
      }
    }
  }

  // ── 4. Classify unclassified mentions ─────────────────────────────────────
  let classified = 0
  const { data: unclassified } = await supabase
    .from('mentions').select('id, content')
    .eq('brand_id', brandId).is('sentiment_label', null)
    .gte('created_at', since.toISOString()).limit(100)

  const items = (unclassified ?? [])
    .filter(m => m.content)
    .map(m => ({ id: m.id, text: m.content! }))

  if (items.length) {
    try {
      const results = await classifySentiment(brandId, items)
      for (const r of results) {
        await supabase.from('mentions').update({
          sentiment_label: r.sentiment,
          sentiment_score: Math.round(r.confidence * 100),
          emotion_tags: [r.emotion],
        }).eq('id', r.id)
      }
      classified = results.length
    } catch (err) {
      console.error('[runCrawl] classification failed:', err)
    }
  }

  // ── 5. Aggregate into sentiment_daily (per-platform + volume-weighted blend)
  const { data: scored } = await supabase
    .from('mentions')
    .select('sentiment_label, emotion_tags, platform')
    .eq('brand_id', brandId)
    .not('sentiment_label', 'is', null)
    .gte('created_at', `${today}T00:00:00.000Z`)

  if (scored?.length) {
    const total = scored.length
    const platformBreakdown = computePlatformStats(scored)

    // Volume-weighted blend across all platforms
    const social_score = Number(
      (Object.values(platformBreakdown)
        .reduce((sum, p) => sum + p.score * p.volume, 0) / total
      ).toFixed(2)
    )

    // Overall distribution (used for the breakdown bars)
    const positiveCount = scored.filter(m => m.sentiment_label === 'positive').length
    const neutralCount  = scored.filter(m => m.sentiment_label === 'neutral').length
    const negativeCount = scored.filter(m => m.sentiment_label === 'negative').length
    const mixedCount    = scored.filter(m => m.sentiment_label === 'mixed').length

    const positive_pct = Number(((positiveCount / total) * 100).toFixed(2))
    const neutral_pct  = Number((((neutralCount + mixedCount) / total) * 100).toFixed(2))
    const negative_pct = Number(((negativeCount / total) * 100).toFixed(2))

    const emotionDistribution: Record<string, number> = {}
    for (const m of scored) {
      for (const e of (m.emotion_tags ?? [])) {
        emotionDistribution[e] = (emotionDistribution[e] ?? 0) + 1
      }
    }

    await supabase.from('sentiment_daily').upsert({
      brand_id: brandId, day: today,
      social_score, blended_score: social_score,
      positive_pct, neutral_pct, negative_pct,
      emotion_distribution: emotionDistribution,
      platform_breakdown: platformBreakdown,
    }, { onConflict: 'brand_id,day' })
  }

  // ── 6. Mark run complete ───────────────────────────────────────────────────
  if (runId) {
    await supabase.from('crawl_runs').update({
      status: 'done', mentions_found: mentionsFound,
      classified, completed_at: new Date().toISOString(),
    }).eq('id', runId)
  }

  return { mentionsFound, classified, sources, platformErrors }
}
