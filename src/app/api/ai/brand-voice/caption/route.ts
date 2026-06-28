import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrand } from '@/lib/active-brand'
import { callAi } from '@/lib/ai/client'
import { z } from 'zod'

const Body = z.object({
  mode:     z.enum(['retune', 'generate']),
  input:    z.string().min(5).max(2000),
  platform: z.string().optional(),
  count:    z.number().int().min(1).max(5).default(3),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{
    id: string; name: string; category: string | null
    brand_voice: Record<string, unknown> | null
  }>(supabase, 'id, name, category, brand_voice')
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const parsed = Body.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { mode, input, platform, count } = parsed.data
  const voice = brand.brand_voice as {
    adjectives?: string[]; tone?: string; dos?: string[]; donts?: string[]
    signaturePhrases?: string[]; kapferer_prism?: Record<string, string>
  } | null

  if (!voice?.tone) {
    return NextResponse.json(
      { error: 'No brand voice found. Build your voice profile first in the Voice Builder tab.' },
      { status: 422 },
    )
  }

  const voiceContext = `
Brand: ${brand.name}
Category: ${brand.category ?? 'unspecified'}
Voice tone: ${voice.tone}
Adjectives: ${voice.adjectives?.join(', ') ?? ''}
Do: ${voice.dos?.join(' | ') ?? ''}
Don't: ${voice.donts?.join(' | ') ?? ''}
Signature phrases: ${voice.signaturePhrases?.join(' | ') ?? ''}
${voice.kapferer_prism ? `Relationship style: ${voice.kapferer_prism.relationship}` : ''}
`.trim()

  const platformNote = platform ? `Platform: ${platform}. Optimise length and style for this platform.` : ''

  let prompt: string
  let schema: string

  if (mode === 'retune') {
    prompt = `You are a brand copywriter for ${brand.name}. Your job is to rewrite the given caption so it sounds exactly like this brand — without changing the meaning or call to action.

${voiceContext}
${platformNote}

ORIGINAL CAPTION:
"${input}"

Rewrite this caption to match the brand voice above. Keep the core message and any factual claims. Adjust tone, vocabulary, sentence rhythm, and personality to match. If the brand uses Nigerian English or cultural expressions naturally, apply them where they fit.

Return ONLY this JSON:
{
  "retuned": "the rewritten caption",
  "changes": ["short note on what you changed and why", "..."],
  "voice_match_score": 85
}`
    schema = '{ "retuned": string, "changes": string[], "voice_match_score": number }'
  } else {
    prompt = `You are a brand copywriter for ${brand.name}. Generate ${count} distinct caption variations for the idea below. Each must authentically reflect this brand's voice.

${voiceContext}
${platformNote}

IDEA / CONCEPT:
"${input}"

Generate ${count} caption options. Vary the angle, hook, and tone across the options — don't repeat the same formula. Options should range from punchy/short to richer/storytelling. Use the brand's voice naturally throughout.

Return ONLY this JSON:
{
  "captions": [
    { "caption": "...", "angle": "short label for this angle, e.g. 'Emotional hook'", "why": "1 sentence on why this works for the brand" }
  ]
}`
    schema = '{ "captions": [{ "caption": string, "angle": string, "why": string }] }'
  }

  const raw = await callAi({
    tier: 'cultural',
    system: `Expert brand copywriter for Nigerian/West African consumer brands. Return ONLY valid JSON matching ${schema}. Never add commentary outside the JSON.`,
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 1000,
    temperature: 0.6,
  })

  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    return NextResponse.json(JSON.parse(cleaned))
  } catch {
    return NextResponse.json({ error: 'AI response could not be parsed. Please try again.' }, { status: 500 })
  }
}
