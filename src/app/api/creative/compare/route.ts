import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { callAi } from '@/lib/ai/client'

export const runtime = 'nodejs'

const ratelimit = new Ratelimit({
  redis: new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  }),
  limiter: Ratelimit.slidingWindow(10, '1 m'),
})

const schema = z.object({
  brandId:      z.string().uuid(),
  creativeA:    z.string().min(1),
  creativeB:    z.string().min(1),
  platform:     z.string().min(1),
  imageUrlA:    z.string().optional(),
  imageUrlB:    z.string().optional(),
  imageBase64A: z.string().optional(),
  imageBase64B: z.string().optional(),
})

const JSON_SCHEMA = `{
  "winner": "A" or "B",
  "why_winner": "1-2 sentence explanation of why this creative is stronger for this platform and market",
  "creative_a": {
    "engagement": 0-100,
    "cultural_resonance": 0-100,
    "tone": 0-100,
    "clarity": 0-100,
    "risk": 0-100,
    "summary": "1 sentence summary of this creative's main strength and weakness"
  },
  "creative_b": {
    "engagement": 0-100,
    "cultural_resonance": 0-100,
    "tone": 0-100,
    "clarity": 0-100,
    "risk": 0-100,
    "summary": "1 sentence summary of this creative's main strength and weakness"
  }
}`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success } = await ratelimit.limit(`creative-compare:${user.id}`)
  if (!success) return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

  const { brandId, creativeA, creativeB, platform, imageUrlA, imageUrlB, imageBase64A, imageBase64B } = parsed.data

  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, category, brand_values')
    .eq('id', brandId)
    .single()
  if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 })

  const brandValues = Array.isArray(brand.brand_values) ? (brand.brand_values as string[]).join(', ') : ''

  const systemPrompt = `You are a creative performance analyst for Nigerian/West African brands. Score creatives honestly and return only valid JSON.`

  const promptText = `Compare these two ${platform} creatives for ${brand.name} (${brand.category ?? 'brand'}).
Brand values: ${brandValues || 'not specified'}

${imageBase64A ? 'Creative A (image above):' : `Creative A:\n${creativeA}${imageUrlA ? `\nImage reference: ${imageUrlA}` : ''}`}
${imageBase64A ? creativeA || '(image only)' : ''}

${imageBase64B ? 'Creative B (image above):' : `Creative B:\n${creativeB}${imageUrlB ? `\nImage reference: ${imageUrlB}` : ''}`}
${imageBase64B ? creativeB || '(image only)' : ''}

Score each creative from 0 to 100 on five dimensions relevant to the Nigerian/West African market. Be specific and honest — one creative must score higher than the other overall.

Return ONLY this JSON, no markdown fences, no preamble:
${JSON_SCHEMA}`

  try {
    let raw: string

    if (imageBase64A || imageBase64B) {
      // Vision call with actual images
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const contentParts: Anthropic.MessageParam['content'] = []

      if (imageBase64A) {
        contentParts.push({ type: 'text', text: 'Creative A image:' })
        contentParts.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64A } })
      }
      if (imageBase64B) {
        contentParts.push({ type: 'text', text: 'Creative B image:' })
        contentParts.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64B } })
      }
      contentParts.push({ type: 'text', text: promptText })

      const resp = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        temperature: 0.2,
        system: systemPrompt,
        messages: [{ role: 'user', content: contentParts }],
      })
      raw = resp.content.find(c => c.type === 'text')?.text ?? ''
    } else {
      raw = await callAi({
        tier: 'structural',
        system: systemPrompt,
        messages: [{ role: 'user', content: promptText }],
        maxTokens: 1000,
        temperature: 0.2,
      })
    }

    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    const result = JSON.parse(cleaned)

    await supabase.from('creative_analyses').insert({
      brand_id:      brandId,
      analysis_type: 'compare',
      input_data:    { creativeA, creativeB, platform, imageUrlA, imageUrlB },
      result,
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[creative/compare] error:', err)
    return NextResponse.json({ error: 'Analysis failed. Try again.' }, { status: 500 })
  }
}
