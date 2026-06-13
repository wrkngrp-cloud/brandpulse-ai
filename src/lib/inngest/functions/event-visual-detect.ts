import { inngest } from '../client'
import { createServiceClient } from '@/lib/supabase/server'

export const eventVisualDetect = inngest.createFunction(
  { id: 'event-visual-detect', name: 'Event Visual Brand Detection (E6)', triggers: [{ event: 'brandpulse/event.live' }] },
  async ({ event, step }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { eventId } = (event as any).data as { eventId: string }

    return await step.run('check-prerequisites', async () => {
      const service = await createServiceClient()

      const { data: ev } = await service
        .from('events')
        .select('id, brand_id, name, hashtags')
        .eq('id', eventId)
        .single()

      if (!ev) return { skipped: 'Event not found' }
      if (!ev.hashtags?.length) return { skipped: 'No hashtags configured — set event hashtags to enable visual detection' }

      const { data: igConnection } = await service
        .from('social_connections')
        .select('id, account_name, sync_status')
        .eq('brand_id', ev.brand_id)
        .eq('platform', 'instagram')
        .eq('sync_status', 'active')
        .maybeSingle()

      if (!igConnection) return { skipped: 'No active Instagram connection — connect Instagram to enable visual detection' }

      console.log(`[E6] Visual detection ready for event "${ev.name}" (${eventId}). Hashtags: ${ev.hashtags.join(', ')}. IG: @${igConnection.account_name}`)

      return {
        status:   'prerequisites_met',
        eventId,
        hashtags: ev.hashtags,
        igHandle: igConnection.account_name,
      }
    })
  },
)
