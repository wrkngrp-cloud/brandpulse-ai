import { Redis } from '@upstash/redis'
import { createServiceClient } from '@/lib/supabase/server'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const TTL_SECONDS = 3600 // 1 hour

export interface BrandContext {
  brandId: string
  brandName: string
  category: string
  industry: string
  brandValues: string[]
  targetSegments: unknown[]
  culturalProfile: Record<string, unknown>
  brandVoice: Record<string, unknown>
}

export async function buildBrandContext(brandId: string): Promise<BrandContext> {
  const cacheKey = `brand_context:${brandId}`
  const cached = await redis.get<BrandContext>(cacheKey)
  if (cached) return cached

  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('brands')
    .select(`
      id,
      name,
      category,
      brand_values,
      target_segments,
      cultural_profile,
      brand_voice,
      workspace:workspaces(industry)
    `)
    .eq('id', brandId)
    .single()

  if (error || !data) throw new Error(`Brand not found: ${brandId}`)

  const ws = Array.isArray(data.workspace) ? data.workspace[0] : data.workspace

  const ctx: BrandContext = {
    brandId: data.id,
    brandName: data.name,
    category: data.category ?? '',
    industry: (ws as { industry?: string })?.industry ?? '',
    brandValues: data.brand_values ?? [],
    targetSegments: data.target_segments ?? [],
    culturalProfile: data.cultural_profile ?? {},
    brandVoice: data.brand_voice ?? {},
  }

  await redis.set(cacheKey, ctx, { ex: TTL_SECONDS })
  return ctx
}

export function formatBrandContextBlock(ctx: BrandContext): string {
  const voice = ctx.brandVoice as {
    adjectives?: string[]
    tone?: string
    dos?: string[]
    donts?: string[]
  }

  const lines = [
    `Brand: ${ctx.brandName}`,
    ctx.category ? `Category: ${ctx.category}` : null,
    ctx.industry ? `Industry: ${ctx.industry}` : null,
    ctx.brandValues.length
      ? `Brand values: ${ctx.brandValues.join(', ')}`
      : null,
    ctx.targetSegments.length
      ? `Target segments: ${JSON.stringify(ctx.targetSegments)}`
      : null,
    Object.keys(ctx.culturalProfile).length
      ? `Cultural profile: ${JSON.stringify(ctx.culturalProfile)}`
      : null,
    voice.adjectives?.length
      ? `Brand voice: ${voice.adjectives.join(', ')}`
      : null,
  ].filter(Boolean)

  return lines.join('\n')
}
