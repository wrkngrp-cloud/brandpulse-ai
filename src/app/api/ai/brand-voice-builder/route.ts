import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { callAi } from '@/lib/ai/client'
import { z } from 'zod'

const Body = z.object({
  samples:   z.array(z.string().min(10)).min(1).max(20),
  brandName: z.string(),
  category:  z.string().optional(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = Body.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { samples, brandName, category } = parsed.data

  const samplesText = samples.map((s, i) => `Sample ${i + 1}:\n${s}`).join('\n\n---\n\n')

  const prompt = `You are a brand strategist analysing sample content to extract a brand voice profile.

Brand: ${brandName}
Category: ${category ?? 'unspecified'}

CONTENT SAMPLES:
${samplesText}

Analyse these samples deeply. Look for:
- Recurring adjectives and tone patterns
- How the brand addresses its audience (formal/informal, second person, etc.)
- Language patterns specific to Nigerian/West African context (local idioms, Pidgin, code-switching)
- What the brand consistently does vs. what it avoids
- Signature phrases or expressions that appear repeatedly

Return ONLY this JSON, no preamble:
{
  "adjectives": ["string", "string", "string", "string", "string"],
  "tone": "string — 1-2 sentences describing the overall voice and register",
  "dos": ["string", "string", "string"],
  "donts": ["string", "string", "string"],
  "signaturePhrases": ["string", "string"],
  "confidenceNote": "string — honest note on how many samples were analysed and confidence level"
}`

  const raw = await callAi({
    tier: 'structural',
    system: 'Brand voice strategist. Nigerian/West African market expert. Return ONLY valid JSON.',
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 1000,
    temperature: 0.3,
  })

  let result: {
    adjectives: string[]
    tone: string
    dos: string[]
    donts: string[]
    signaturePhrases: string[]
    confidenceNote: string
  }

  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    result = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response. Please try again.' }, { status: 500 })
  }

  // Save to brand_voice
  const { data: brand } = await supabase.from('brands').select('id').limit(1).maybeSingle()
  if (brand) {
    const service = await createServiceClient()
    await service.from('brands').update({
      brand_voice: {
        adjectives:       result.adjectives,
        tone:             result.tone,
        dos:              result.dos,
        donts:            result.donts,
        signaturePhrases: result.signaturePhrases,
      },
    }).eq('id', brand.id)
  }

  return NextResponse.json({ ...result, saved: !!brand })
}
