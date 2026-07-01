import { NextRequest, NextResponse } from 'next/server'
import { z }                         from 'zod'
import { createClient }              from '@/lib/supabase/server'
import { createServiceClient }       from '@/lib/supabase/server'
import { decrypt }                   from '@/lib/crypto'
import { fetchInstagramHashtagImages } from '@/lib/social/instagram'
import { runVisualDetection }         from '@/lib/vision/brand-detector'

const BodySchema = z.object({ eventId: z.string().uuid() })

const MAX_IMAGES_PER_HASHTAG = 8
const MAX_HASHTAGS           = 4

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = BodySchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const { eventId } = body.data
  const service = await createServiceClient()

  // Fetch event + brand — include creative_url for vision reference
  const { data: ev } = await service
    .from('events')
    .select('id, brand_id, name, hashtags, creative_url')
    .eq('id', eventId)
    .single()

  if (!ev) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  if (!ev.hashtags?.length)
    return NextResponse.json({ error: 'No hashtags configured for this event. Add hashtags in event settings.' }, { status: 422 })

  const { data: ig } = await service
    .from('social_connections')
    .select('account_id, access_token')
    .eq('brand_id', ev.brand_id)
    .eq('platform', 'instagram')
    .eq('sync_status', 'active')
    .maybeSingle()

  if (!ig)
    return NextResponse.json({ error: 'No active Instagram connection. Connect Instagram in settings.' }, { status: 422 })

  const igToken  = decrypt(ig.access_token as string)
  const igUserId = ig.account_id as string

  // Fetch images from all event hashtags
  const seen  = new Set<string>()
  const images: import('@/lib/social/instagram').InstagramImage[] = []
  for (const tag of (ev.hashtags as string[]).slice(0, MAX_HASHTAGS)) {
    const imgs = await fetchInstagramHashtagImages(igUserId, igToken, tag, MAX_IMAGES_PER_HASHTAG)
    for (const img of imgs) {
      if (!seen.has(img.postId)) {
        seen.add(img.postId)
        images.push(img)
      }
    }
  }

  if (!images.length)
    return NextResponse.json({ error: 'No image posts found for these hashtags yet.' }, { status: 200, statusText: 'ok' })

  // Build creative reference list: event flyer/photobooth + brand creative_urls
  const eventCreativeUrls: string[] = ev.creative_url ? [ev.creative_url as string] : []

  // Run vision detection — passes event creative as visual reference
  const { rows } = await runVisualDetection(images, ev.brand_id as string, eventId, undefined, {
    creativeUrls: eventCreativeUrls,
  })

  // Upsert into visual_mentions (deduplicate by event_id + post_id)
  if (rows.length) {
    await service
      .from('visual_mentions')
      .upsert(rows, { onConflict: 'event_id,post_id' })
  }

  const brandDetected = rows.filter(r => r.brand_visible).length
  return NextResponse.json({ processed: images.length, brandDetected, mentions: rows })
}
