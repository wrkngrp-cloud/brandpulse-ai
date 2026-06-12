import { createServiceClient } from '@/lib/supabase/server'
import { fetchTwitterUserMentions } from '@/lib/social/twitter'
import { fetchInstagramHashtagMentions, fetchInstagramTaggedMedia } from '@/lib/social/instagram'
import { classifySentiment } from '@/lib/ai/classify-sentiment'

export interface CrawlResult {
  mentionsFound: number
  classified: number
  sources: string[]
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

// Derive hashtags to search from brand name: 'Kuda Bank' → ['kudabank', 'kuda']
function deriveHashtags(brandName: string): string[] {
  const slug = brandName.toLowerCase().replace(/[^a-z0-9]/g, '')
  const first = brandName.toLowerCase().split(/\s+/)[0].replace(/[^a-z0-9]/g, '')
  return [...new Set([slug, first])].filter(h => h.length > 2)
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
    .select('platform, account_id, access_token, account_name')
    .eq('brand_id', brandId)
    .eq('sync_status', 'active')

  const twitterConn = connections?.find(c => c.platform === 'twitter')
  const instagramConn = connections?.find(c => c.platform === 'instagram')

  // ── 2. Fetch mentions from all connected platforms ─────────────────────────
  const allMentions: RawMention[] = []
  const sources: string[] = []
  const platformErrors: string[] = []

  if (twitterConn?.account_id && twitterConn.access_token) {
    try {
      const tweets = await fetchTwitterUserMentions(
        twitterConn.account_id,
        twitterConn.access_token,
        since
      )
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
      platformErrors.push(`Twitter: ${msg}`)
    }
  }

  if (instagramConn?.account_id && instagramConn.access_token) {
    try {
      const hashtags = deriveHashtags(brand.name)
      const [hashtagMentions, taggedMedia] = await Promise.all([
        fetchInstagramHashtagMentions(instagramConn.account_id, instagramConn.access_token, hashtags, since),
        fetchInstagramTaggedMedia(instagramConn.account_id, instagramConn.access_token, since),
      ])
      const igMentions = [...hashtagMentions, ...taggedMedia]
      allMentions.push(...igMentions.map(m => ({
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
      platformErrors.push(`Instagram: ${msg}`)
    }
  }

  // ── 3. Dedup and insert fresh mentions ────────────────────────────────────
  let mentionsFound = 0

  if (allMentions.length) {
    // Group by platform to run efficient dedup queries
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

  // ── 5. Aggregate into sentiment_daily ─────────────────────────────────────
  const { data: scored } = await supabase
    .from('mentions').select('sentiment_label, emotion_tags')
    .eq('brand_id', brandId).not('sentiment_label', 'is', null)
    .gte('created_at', `${today}T00:00:00.000Z`)

  if (scored?.length) {
    const total        = scored.length
    const positiveCount = scored.filter(m => m.sentiment_label === 'positive').length
    const neutralCount  = scored.filter(m => m.sentiment_label === 'neutral').length
    const negativeCount = scored.filter(m => m.sentiment_label === 'negative').length
    const mixedCount    = scored.filter(m => m.sentiment_label === 'mixed').length

    const positive_pct = Number(((positiveCount / total) * 100).toFixed(2))
    const neutral_pct  = Number((((neutralCount + mixedCount) / total) * 100).toFixed(2))
    const negative_pct = Number(((negativeCount / total) * 100).toFixed(2))
    const social_score = Number(((positiveCount * 100 + (neutralCount + mixedCount) * 50) / total).toFixed(2))

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
    }, { onConflict: 'brand_id,day' })
  }

  // ── 6. Mark run complete ───────────────────────────────────────────────────
  if (runId) {
    await supabase.from('crawl_runs').update({
      status: 'done', mentions_found: mentionsFound,
      classified, completed_at: new Date().toISOString(),
    }).eq('id', runId)
  }

  return { mentionsFound, classified, sources }
}
