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
When reference images are provided (logo or creative assets), use them as the ground truth for what the brand looks like.
You respond only with valid JSON — no markdown, no explanation outside the JSON.`

async function analyzeImage(
  mediaUrl:       string,
  brandName:      string,
  logoUrl?:       string | null,
  brandColors?:   string[],
  creativeUrls?:  string[],
): Promise<DetectionResult> {
  try {
    // Build the message content — reference images first, then the photo to scan
    const content: Anthropic.MessageParam['content'] = []

    // Logo reference
    if (logoUrl) {
      content.push({
        type: 'image',
        source: { type: 'url', url: logoUrl },
      })
      content.push({
        type: 'text',
        text: `This is the official logo for "${brandName}". Use it as the visual reference when scanning.`,
      })
    }

    // Campaign creative references (max 3 to keep token cost reasonable)
    const creatives = (creativeUrls ?? []).slice(0, 3)
    for (const url of creatives) {
      content.push({
        type: 'image',
        source: { type: 'url', url },
      })
      content.push({
        type: 'text',
        text: `This is a campaign creative for "${brandName}". Look for matching visual elements in the photo below.`,
      })
    }

    // The actual photo to scan
    content.push({
      type: 'image',
      source: { type: 'url', url: mediaUrl },
    })

    const colorHint = (brandColors ?? []).length > 0
      ? ` The brand's primary colors are: ${brandColors!.join(', ')}. Also flag prominently color-matched materials.`
      : ''

    content.push({
      type: 'text',
      text: `Analyze this photo for the presence of brand "${brandName}".${colorHint}

Return a JSON object with exactly these fields:
{
  "brand_visible": true | false,
  "confidence": "high" | "medium" | "low" | null,
  "detected_elements": ["logo" | "merch" | "signage" | "product" | "banner" | "uniform" | "creative"],
  "visual_sentiment": "positive" | "neutral" | "negative",
  "ai_description": "one sentence describing what brand-related content is visible, or 'No brand presence detected'"
}

Set brand_visible to true only if you can clearly see the brand's identity. Set confidence null when brand_visible is false.`,
    })

    const resp = await anthropic.messages.create({
      model:       MODELS.cultural,
      max_tokens:  512,
      temperature: 0,
      system:      SYSTEM,
      messages: [{ role: 'user', content }],
    })

    const text   = resp.content[0].type === 'text' ? resp.content[0].text.trim() : '{}'
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

interface BrandAssets {
  logoUrl?:      string | null
  brandColors?:  string[]
  creativeUrls?: string[]
}

export async function runVisualDetection(
  images:    InstagramImage[],
  brandId:   string,
  eventId:   string,
  brandName?: string,
  assets?:    BrandAssets,
): Promise<{ rows: VisualMentionRow[] }> {
  // Fetch brand name + visual assets if not provided
  let name    = brandName ?? 'the brand'
  let logoUrl = assets?.logoUrl
  let colors  = assets?.brandColors ?? []

  if (!brandName || !assets) {
    try {
      const { createServiceClient } = await import('@/lib/supabase/server')
      const service = await createServiceClient()
      const { data: brand } = await service
        .from('brands')
        .select('name, logo_url, brand_colors')
        .eq('id', brandId)
        .single()
      if (brand?.name)        name    = brand.name
      if (brand?.logo_url)    logoUrl = brand.logo_url
      if (brand?.brand_colors) colors = brand.brand_colors as string[]
    } catch { /* use defaults */ }
  }

  const creativeUrls = assets?.creativeUrls ?? []

  const rows: VisualMentionRow[] = []

  for (const img of images) {
    const detection = await analyzeImage(img.mediaUrl, name, logoUrl, colors, creativeUrls)
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
