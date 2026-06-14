import Anthropic from '@anthropic-ai/sdk'
import { MODELS } from '@/lib/ai/client'
import type { InstagramImage } from '@/lib/social/instagram'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface DetectionResult {
  brand_visible:     boolean
  confidence:        'high' | 'medium' | 'low' | null
  detected_elements: string[]
  visual_sentiment:  'positive' | 'neutral' | 'negative'
  ai_description:    string
}

interface VisualMentionRow {
  event_id:          string
  brand_id:          string
  source_platform:   string
  post_id:           string
  post_url:          string
  media_url:         string
  hashtag:           string
  creator_username:  string
  post_caption:      string
  post_likes:        number
  post_comments:     number
  brand_visible:     boolean
  confidence:        string | null
  detected_elements: string[]
  visual_sentiment:  string
  ai_description:    string
}

const SYSTEM = `You are a brand visibility analyst. You analyze event and social media photos for brand presence.
Your job: detect whether a specific brand's visual identity appears in the image.
Brand indicators to look for: logos, wordmarks, product packaging, branded merchandise (T-shirts, caps, bags, lanyards),
branded signage or banners, brand color schemes used prominently, branded display stands or booths.
You respond only with valid JSON — no markdown, no explanation outside the JSON.`

async function analyzeImage(
  mediaUrl:  string,
  brandName: string,
): Promise<DetectionResult> {
  try {
    const resp = await anthropic.messages.create({
      model:      MODELS.cultural,
      max_tokens: 512,
      temperature: 0,
      system:     SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            {
              type:   'image',
              source: { type: 'url', url: mediaUrl },
            },
            {
              type: 'text',
              text: `Analyze this image for the presence of brand "${brandName}".

Return a JSON object with exactly these fields:
{
  "brand_visible": true | false,
  "confidence": "high" | "medium" | "low" | null,
  "detected_elements": ["logo" | "merch" | "signage" | "product" | "banner" | "uniform"],
  "visual_sentiment": "positive" | "neutral" | "negative",
  "ai_description": "one sentence describing what brand-related content is visible, or 'No brand presence detected'"
}

Set brand_visible to true only if you can clearly see the brand's identity. Set confidence null when brand_visible is false.`,
            },
          ],
        },
      ],
    })

    const text = resp.content[0].type === 'text' ? resp.content[0].text.trim() : '{}'
    const parsed = JSON.parse(text) as DetectionResult
    return {
      brand_visible:     Boolean(parsed.brand_visible),
      confidence:        parsed.brand_visible ? (parsed.confidence ?? 'low') : null,
      detected_elements: Array.isArray(parsed.detected_elements) ? parsed.detected_elements : [],
      visual_sentiment:  parsed.visual_sentiment ?? 'neutral',
      ai_description:    parsed.ai_description ?? '',
    }
  } catch {
    return {
      brand_visible:     false,
      confidence:        null,
      detected_elements: [],
      visual_sentiment:  'neutral',
      ai_description:    'Analysis unavailable',
    }
  }
}

export async function runVisualDetection(
  images:    InstagramImage[],
  brandId:   string,
  eventId:   string,
  brandName?: string,
): Promise<{ rows: VisualMentionRow[] }> {
  // Fetch brand name if not provided
  let name = brandName ?? 'the brand'
  if (!brandName) {
    try {
      const { createServiceClient } = await import('@/lib/supabase/server')
      const service = await createServiceClient()
      const { data: brand } = await service.from('brands').select('name').eq('id', brandId).single()
      if (brand?.name) name = brand.name
    } catch { /* use default */ }
  }

  const rows: VisualMentionRow[] = []

  for (const img of images) {
    const detection = await analyzeImage(img.mediaUrl, name)
    rows.push({
      event_id:          eventId,
      brand_id:          brandId,
      source_platform:   'instagram',
      post_id:           img.postId,
      post_url:          img.postUrl,
      media_url:         img.mediaUrl,
      hashtag:           img.hashtag,
      creator_username:  img.creatorUsername,
      post_caption:      img.caption.slice(0, 500),
      post_likes:        img.likes,
      post_comments:     img.comments,
      brand_visible:     detection.brand_visible,
      confidence:        detection.confidence,
      detected_elements: detection.detected_elements,
      visual_sentiment:  detection.visual_sentiment,
      ai_description:    detection.ai_description,
    })
  }

  return { rows }
}
