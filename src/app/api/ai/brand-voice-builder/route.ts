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

  const prompt = `You are a brand strategist applying Jean-Noël Kapferer's Brand Identity Prism to extract a brand voice profile.

Brand: ${brandName}
Category: ${category ?? 'unspecified'}

CONTENT SAMPLES:
${samplesText}

Analyse these samples through Kapferer's six prism facets:

PRISM FACETS — read each sample against each of these:

1. PHYSIQUE — What tangible, visible cues appear? (product attributes, packaging language, visual references)
2. PERSONALITY — What character traits does the brand project? (tone, adjectives, how it speaks)
3. CULTURE — What values and beliefs underpin the brand? (origin, principles, what it stands for)
4. RELATIONSHIP — How does the brand interact with its consumer? (formal/informal, advice-giving, peer-like, authority figure)
5. REFLECTION — Who does the brand portray as its ideal customer? (who appears in content, aspirational archetype)
6. SELF-IMAGE — How does using/following this brand make the consumer feel about themselves?

Nigerian/West African lens: note any Pidgin, Yoruba, Igbo, or Hausa patterns. Note code-switching as a deliberate relationship signal.

Based on this Kapferer analysis, derive the practical brand voice profile.

Return ONLY this JSON, no preamble:
{
  "adjectives": ["string", "string", "string", "string", "string"],
  "tone": "string — 1-2 sentences: the Personality + Relationship facets expressed as a voice register",
  "dos": ["string", "string", "string"],
  "donts": ["string", "string", "string"],
  "signaturePhrases": ["string", "string"],
  "confidenceNote": "string — honest note on sample count and confidence",
  "kapferer_prism": {
    "physique": "string — concrete physical/visual cues the brand uses",
    "personality": "string — character traits the brand projects",
    "culture": "string — underlying values and belief system",
    "relationship": "string — how the brand engages its audience",
    "reflection": "string — the type of person the brand portrays",
    "self_image": "string — how the brand makes its user feel about themselves"
  }
}`

  const raw = await callAi({
    tier: 'structural',
    system: 'Brand strategist applying Kapferer Brand Identity Prism. Nigerian/West African market expert. Return ONLY valid JSON.',
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 1200,
    temperature: 0.3,
  })

  let result: {
    adjectives: string[]
    tone: string
    dos: string[]
    donts: string[]
    signaturePhrases: string[]
    confidenceNote: string
    kapferer_prism?: {
      physique: string; personality: string; culture: string
      relationship: string; reflection: string; self_image: string
    }
  }

  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    result = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response. Please try again.' }, { status: 500 })
  }

  // Save to brand_voice (store prism data in existing jsonb field alongside core fields)
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
        kapferer_prism:   result.kapferer_prism ?? null,
      },
    }).eq('id', brand.id)
  }

  return NextResponse.json({ ...result, saved: !!brand })
}
