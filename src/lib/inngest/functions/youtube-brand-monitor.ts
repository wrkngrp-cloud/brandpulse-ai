import { inngest } from '../client'
import { createServiceClient } from '@/lib/supabase/server'
import { callAi } from '@/lib/ai/client'
import { decrypt } from '@/lib/crypto'

interface YtSearchItem {
  id: { videoId: string }
  snippet: {
    title: string
    channelTitle: string
    channelId: string
    publishedAt: string
  }
}

interface YtVideoStats {
  id: string
  statistics: {
    viewCount:    string
    likeCount:    string
    commentCount: string
  }
}

interface YtCommentThread {
  snippet: {
    topLevelComment: {
      snippet: {
        textDisplay:  string
        likeCount:    number
        publishedAt:  string
      }
    }
  }
}

async function fetchYt<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export const youtubeBrandMonitor = inngest.createFunction(
  {
    id:   'youtube-brand-monitor',
    name: 'YouTube Brand Monitor',
    triggers: [
      { cron: 'TZ=Africa/Lagos 0 9 * * *' },
      { event: 'brandpulse/youtube.monitor.requested' },
    ],
    retries: 1,
  },
  async ({ step, logger }) => {
    const supabase = await createServiceClient()

    const brands = await step.run('fetch-brands-with-yt-key', async () => {
      const { data: configs } = await supabase
        .from('youtube_api_configs')
        .select('brand_id, workspace_id, api_key')
      return configs ?? []
    })

    if (!brands.length) {
      logger.info('[youtube-brand-monitor] no brands with YouTube API key configured')
      return { processed: 0 }
    }

    let processed = 0

    for (const cfg of brands) {
      await step.run(`monitor-brand-${cfg.brand_id}`, async () => {
        try {
          const svc = await createServiceClient()

          const apiKey = decrypt(cfg.api_key)

          const { data: brand } = await svc
            .from('brands')
            .select('id, name')
            .eq('id', cfg.brand_id)
            .single()
          if (!brand) return { skipped: 'brand not found' }

          const sevenDaysAgo = new Date()
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
          const publishedAfter = sevenDaysAgo.toISOString()

          const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(brand.name)}&type=video&maxResults=20&order=viewCount&publishedAfter=${publishedAfter}&key=${apiKey}`

          const searchResult = await fetchYt<{ items: YtSearchItem[] }>(searchUrl)
          if (!searchResult?.items?.length) {
            logger.info(`[youtube-brand-monitor] no videos found for brand ${brand.name}`)
            return { found: 0 }
          }

          const videoIds = searchResult.items.map(i => i.id.videoId).join(',')
          const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}&key=${apiKey}`
          const statsResult = await fetchYt<{ items: YtVideoStats[] }>(statsUrl)

          const statsMap: Record<string, YtVideoStats['statistics']> = {}
          for (const v of statsResult?.items ?? []) {
            statsMap[v.id] = v.statistics
          }

          // Sort by view count, take top 5 for comment analysis
          const sorted = searchResult.items
            .map(item => ({
              ...item,
              views: parseInt(statsMap[item.id.videoId]?.viewCount ?? '0'),
            }))
            .sort((a, b) => b.views - a.views)

          const top5 = sorted.slice(0, 5)

          for (const video of sorted) {
            const stats = statsMap[video.id.videoId]
            let commentSample: { text: string; like_count: number }[] = []
            let sentimentScore: number | null = null

            if (top5.some(v => v.id.videoId === video.id.videoId)) {
              const commentsUrl = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${video.id.videoId}&maxResults=20&key=${apiKey}`
              const commentsResult = await fetchYt<{ items: YtCommentThread[] }>(commentsUrl)

              if (commentsResult?.items?.length) {
                commentSample = commentsResult.items.map(c => ({
                  text:       c.snippet.topLevelComment.snippet.textDisplay,
                  like_count: c.snippet.topLevelComment.snippet.likeCount,
                }))

                const commentText = commentSample.map(c => c.text).join('\n---\n')

                const systemPrompt = `You are a brand sentiment analyst for Nigerian / West African brands.
Analyse YouTube comments about the brand "${brand.name}" and return a sentiment score from 0 (very negative) to 100 (very positive).
Return ONLY a JSON object: { "score": number }. No markdown, no extra text.`

                try {
                  const raw = await callAi({
                    tier:      'cultural',
                    system:    systemPrompt,
                    messages:  [{ role: 'user', content: `Comments:\n${commentText}` }],
                    maxTokens: 50,
                  })
                  const cleaned = raw.replace(/```[a-z]*\n?/g, '').trim()
                  const parsed = JSON.parse(cleaned)
                  sentimentScore = typeof parsed.score === 'number' ? parsed.score : null
                } catch {
                  logger.warn(`[youtube-brand-monitor] sentiment parse failed for ${video.id.videoId}`)
                }
              }
            }

            await svc.from('youtube_mentions').upsert(
              {
                brand_id:       cfg.brand_id,
                workspace_id:   cfg.workspace_id,
                video_id:       video.id.videoId,
                video_title:    video.snippet.title,
                channel_name:   video.snippet.channelTitle,
                channel_id:     video.snippet.channelId,
                view_count:     parseInt(stats?.viewCount ?? '0'),
                like_count:     parseInt(stats?.likeCount ?? '0'),
                comment_count:  parseInt(stats?.commentCount ?? '0'),
                published_at:   video.snippet.publishedAt,
                sentiment_score: sentimentScore,
                comment_sample: commentSample.length > 0 ? commentSample : null,
                found_at:       new Date().toISOString(),
              },
              { onConflict: 'brand_id,video_id' }
            )
          }

          // Update last_synced_at
          await svc
            .from('youtube_api_configs')
            .update({ last_synced_at: new Date().toISOString() })
            .eq('brand_id', cfg.brand_id)

          return { found: sorted.length }
        } catch (err) {
          logger.error(`[youtube-brand-monitor] error for brand ${cfg.brand_id}:`, err)
          return { error: String(err) }
        }
      })

      processed++
    }

    return { processed }
  },
)
