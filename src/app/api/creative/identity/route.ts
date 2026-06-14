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
  brandId:     z.string().uuid(),
  captions:    z.array(z.string().min(1)).min(1).max(3),
  brandValues: z.array(z.string()).optional(),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success } = await ratelimit.limit(`creative-identity:${user.id}`)
  if (!success) return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

  const { brandId, captions, brandValues = [] } = parsed.data

  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, category')
    .eq('id', brandId)
    .single()
  if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 })

  const valuesBlock = brandValues.length > 0
    ? `Brand values: ${brandValues.join(', ')}`
    : 'Brand values: not specified'

  const captionsBlock = captions
    .map((c, i) => `Caption ${i + 1}:\n${c}`)
    .join('\n\n')

  const systemPrompt = `You are a brand voice analyst specialising in Nigerian and West African consumer brands. You identify when a brand's written voice is drifting from its core identity. Return only valid JSON.`

  const userPrompt = `Analyse these recent social media captions from ${brand.name} (${brand.category ?? 'brand'}) for brand voice consistency.

${valuesBlock}

${captionsBlock}

Check whether the captions are consistent with each other and with the stated brand values. Look for tone drift, vocabulary inconsistencies, and messaging that conflicts with the brand's identity.

Return ONLY this JSON, no markdown fences, no preamble:
{
  "consistency_score": 0-100,
  "strengths": ["what the brand voice is doing well — up to 4 items"],
  "drift_warnings": ["specific ways the voice is inconsistent or drifting — up to 4 items"],
  "adjustments": ["concrete recommendations to tighten brand voice — up to 4 items"]
}`

  try {
    const raw = await callAi({
      tier: 'structural',
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 900,
      temperature: 0.2,
    })

    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    const result = JSON.parse(cleaned)

    await supabase.from('creative_analyses').insert({
      brand_id:      brandId,
      analysis_type: 'identity',
      input_data:    { captions, brandValues },
      result,
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[creative/identity] error:', err)
    return NextResponse.json({ error: 'Analysis failed. Try again.' }, { status: 500 })
  }
}
