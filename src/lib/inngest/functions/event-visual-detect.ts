import { inngest }              from '../client'
import { createServiceClient }  from '@/lib/supabase/server'
import { decrypt }              from '@/lib/crypto'
import { fetchInstagramHashtagImages } from '@/lib/social/instagram'
import { runVisualDetection }   from '@/lib/vision/brand-detector'

export const eventVisualDetect = inngest.createFunction(
  {
    id: 'event-visual-detect',
    name: 'Event Visual Brand Detection (E6)',
    triggers: [
      { event: 'brandpulse/event.live' },
      { event: 'brandpulse/event.visual-scan' },
    ],
  },
  async ({ event, step }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { eventId } = (event as any).data as { eventId: string }

    const prereqs = await step.run('check-prerequisites', async () => {
      const service = await createServiceClient()

      const { data: ev } = await service
        .from('events')
        .select('id, brand_id, name, hashtags')
        .eq('id', eventId)
        .single()

      if (!ev)              return { skipped: 'Event not found' }
      if (!ev.hashtags?.length) return { skipped: 'No hashtags configured' }

      const { data: ig } = await service
        .from('social_connections')
        .select('account_id, access_token, account_name')
        .eq('brand_id', ev.brand_id)
        .eq('platform', 'instagram')
        .eq('sync_status', 'active')
        .maybeSingle()

      if (!ig) return { skipped: 'No active Instagram connection' }

      return {
        ok: true,
        eventId:    ev.id,
        brandId:    ev.brand_id as string,
        eventName:  ev.name as string,
        hashtags:   ev.hashtags as string[],
        igUserId:   ig.account_id as string,
        igToken:    decrypt(ig.access_token as string),
      }
    })

    if (!('ok' in prereqs)) {
      return { skipped: prereqs.skipped }
    }

    const { brandId, hashtags, igUserId, igToken } = prereqs

    const images = await step.run('fetch-hashtag-images', async () => {
      const results: import('@/lib/social/instagram').InstagramImage[] = []
      for (const tag of hashtags.slice(0, 5)) {
        const imgs = await fetchInstagramHashtagImages(igUserId, igToken, tag, 10)
        results.push(...imgs)
      }
      // deduplicate by postId
      const seen = new Set<string>()
      return results.filter(i => seen.has(i.postId) ? false : (seen.add(i.postId), true))
    })

    if (!images.length) return { processed: 0, brandDetected: 0 }

    const results = await step.run('analyze-images', async () =>
      runVisualDetection(images, brandId, eventId)
    )

    await step.run('store-results', async () => {
      const service = await createServiceClient()
      if (results.rows.length) {
        await service.from('visual_mentions').upsert(results.rows, { onConflict: 'event_id,post_id' })
      }
    })

    return {
      processed:     images.length,
      brandDetected: results.rows.filter(r => r.brand_visible).length,
    }
  },
)
