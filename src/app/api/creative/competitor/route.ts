import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { callAi } from '@/lib/ai/client'

const ratelimit = new Ratelimit({
  redis: new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  }),
  limiter: Ratelimit.slidingWindow(10, '1 m'),
})

const schema = z.object({
  brandId:        z.string().uuid(),
  competitorName: z.string().min(1),
  content:        z.string().min(1),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success } = await ratelimit.limit(`creative-competitor:${user.id}`)
  if (!success) return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

  const { brandId, competitorName, content } = parsed.data

  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, category, brand_values')
    .eq('id', brandId)
    .single()
  if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 })

  const brandValues = Array.isArray(brand.brand_values) ? (brand.brand_values as string[]).join(', ') : ''

  const systemPrompt = `You are a brand strategist specialising in Nigerian and West African consumer markets. You analyse competitor creative to find strategic gaps and counter-positioning opportunities. Return only valid JSON.`

  const userPrompt = `Analyse this competitor creative for ${brand.name} (${brand.category ?? 'brand'}).

Our brand values: ${brandValues || 'not specified'}

Competitor: ${competitorName}
Their content:
${content}

Assess the competitor's creative for the Nigerian/West African market. Then identify specific ways ${brand.name} can counter-position.

Return ONLY this JSON, no markdown fences, no preamble:
{
  "tone": "one word or short phrase describing the competitor's overall tone",
  "cultural_fit": 0-100,
  "engagement_potential": 0-100,
  "strategic_insights": [
    "3-4 specific observations about what this competitor is doing — strengths, weaknesses, gaps"
  ],
  "counter_positions": [
    "3 concrete counter-positioning ideas for ${brand.name} based on gaps in the competitor's approach"
  ]
}`

  try {
    const raw = await callAi({
      tier: 'cultural',
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 900,
      temperature: 0.3,
    })

    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    const result = JSON.parse(cleaned)

    await supabase.from('creative_analyses').insert({
      brand_id:      brandId,
      analysis_type: 'competitor',
      input_data:    { competitorName, content },
      result,
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[creative/competitor] error:', err)
    return NextResponse.json({ error: 'Analysis failed. Try again.' }, { status: 500 })
  }
}
