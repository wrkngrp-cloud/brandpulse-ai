import { buildBrandContext } from './brand-context'

export interface PrePostInput {
  content: string
  platform: string
  funnelStage: string
  targetSegment?: string
}

export async function buildPrePostSystemPrompt(brandId: string): Promise<string> {
  const ctx = await buildBrandContext(brandId)

  const voice = ctx.brandVoice as {
    adjectives?: string[]
    tone?: string
    dos?: string[]
    donts?: string[]
    signaturePhrases?: string[]
  }

  const voiceBlock = [
    voice.adjectives?.length ? `Adjectives: ${voice.adjectives.join(', ')}` : null,
    voice.tone               ? `Tone: ${voice.tone}`                         : null,
    voice.dos?.length        ? `Dos: ${voice.dos.join('; ')}`                : null,
    voice.donts?.length      ? `Don'ts: ${voice.donts.join('; ')}`           : null,
    voice.signaturePhrases?.length ? `Signature phrases: ${voice.signaturePhrases.join(', ')}` : null,
  ].filter(Boolean).join('\n') || 'Not configured yet'

  const culturalProfile = Object.keys(ctx.culturalProfile).length
    ? JSON.stringify(ctx.culturalProfile)
    : 'Not configured yet'

  const today = new Date().toISOString().slice(0, 10)

  return `You are BrandPulse, a brand intelligence analyst with deep, lived knowledge of Nigerian and West African culture, language, and social media behaviour. You interpret Pidgin, Yoruba, Igbo, and Hausa expressions in their real cultural meaning, never their literal English translation. You understand code-switching, Nigerian online humour, sarcasm patterns, and the difference between how content lands in Lagos versus the North versus the South-East.

You are analysing content for this brand:
- Brand: ${ctx.brandName}
- Category: ${ctx.category || 'Not specified'}
- Brand values: ${ctx.brandValues.length ? ctx.brandValues.join(', ') : 'Not specified'}
- Brand voice: ${voiceBlock}
- Cultural profile: ${culturalProfile}
- Today's date: ${today}
- Active cultural moments: No live events loaded yet — score based on general Nigerian/West African cultural calendar awareness.

You score honestly. A polished but culturally hollow post should score low on Cultural Resonance even if it scores high on Clarity. You never invent risks that are not present, and you never miss a real cultural tripwire.

You MUST return ONLY valid JSON in this exact shape — no markdown fences, no preamble:
{
  "engagement": {"score": 0, "reasoning": ""},
  "cultural":   {"score": 0, "reasoning": ""},
  "tone":       {"score": 0, "reasoning": ""},
  "clarity":    {"score": 0, "reasoning": ""},
  "risk":       {"score": 0, "flags": [
                  {"title":"","offending_text":"","reason":"","replacement":""}
                ]},
  "verdict": "",
  "improvements": [],
  "suggested_rewrite": ""
}`
}

export function buildPrePostUserMessage(input: PrePostInput, brandSegments: unknown[]): string {
  const segments = Array.isArray(brandSegments) && brandSegments.length
    ? JSON.stringify(brandSegments)
    : input.targetSegment || 'General Nigerian audience'

  return `Analyse this content before it is published.
Platform: ${input.platform}
Funnel goal: ${input.funnelStage}
Target audience segment: ${segments}
Content:
"""
${input.content}
"""

Score each dimension 0-100 with specific, evidence-based reasoning:

1. PREDICTED ENGAGEMENT (0-100): likelihood of active response (comment, share, save) vs scroll-past. Consider hook strength, relatability, shareability, conversation triggers for THIS segment on THIS platform.
2. CULTURAL RESONANCE (0-100): authentic alignment with the target audience's culture. Consider language authenticity, cultural references, values fit, community feel. If below 65, state the specific cultural improvement.
3. TONE MATCH (0-100): fit between the content's tone and the brand voice profile AND the audience's preference. Name any line that breaks the brand voice.
4. MESSAGE CLARITY (0-100): will the core message land on first read for this audience? Consider simplicity, jargon, assumed knowledge, language level.
5. RISK FLAG (0-100): risk of misunderstanding, offence, or cultural backfire. 0 = none, 100 = high. For every risk above 0, return a flag object.

Also return:
- verdict: one plain-English sentence on overall prediction.
- improvements: up to 3 specific, actionable suggestions.
- suggested_rewrite: an improved version that keeps the same message but executes better for this audience, platform, and cultural moment.`
}
