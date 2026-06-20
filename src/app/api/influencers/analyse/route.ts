import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAi } from '@/lib/ai/client'
import { z } from 'zod'

const bodySchema = z.object({
  handles: z.array(
    z.object({
      platform: z.string().min(1),
      handle:   z.string().min(1),
      url:      z.string().optional(),
    })
  ).min(1),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch the actual brand so analysis is specific to this workspace
  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, category, brand_values, target_segments')
    .limit(1)
    .single()

  if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 })

  const parsed = bodySchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { handles } = parsed.data

  // Build brand context lines for the prompt
  const brandCategory = brand.category ?? null
  const brandValues   = Array.isArray(brand.brand_values) && brand.brand_values.length > 0
    ? (brand.brand_values as string[]).join(', ')
    : null

  const industryClause = brandCategory
    ? `The brand operates in the ${brandCategory} industry.`
    : 'The brand industry is NOT specified. Do NOT infer industry from the brand name under any circumstances.'

  const brandDesc = [
    brandCategory ? `a Nigerian ${brandCategory} brand` : 'a Nigerian brand (industry unspecified)',
    brandValues   ? `Values: ${brandValues}` : null,
  ].filter(Boolean).join('. ')

  const system = `You are a Nigerian brand intelligence analyst specialising in influencer marketing.
When given social media handles, you produce a realistic, data-driven profile estimate for each influencer.
You understand Nigerian social media culture: Lagos/Abuja/Port Harcourt audience demographics, Pidgin English content,
local culture and community dynamics, and typical engagement benchmarks for Nigerian creators.

CRITICAL RULE — INDUSTRY INFERENCE:
Brand names NEVER indicate industry. "Sweetness" is NOT food. "Lion" is NOT beverages. "Bloom" is NOT agriculture.
You MUST use ONLY the explicitly provided industry field below. If no industry is given, evaluate on general brand safety and audience quality — never fabricate an industry from the name.
Always respond with valid JSON only. No markdown fences, no explanation — just the raw JSON object.`

  const handlesDesc = handles
    .map(h => `Platform: ${h.platform}, Handle: ${h.handle}${h.url ? `, URL: ${h.url}` : ''}`)
    .join('\n')

  const userPrompt = `Analyse the following Nigerian social media influencer(s) for brand partnership consideration.

BRAND DETAILS (use ONLY these facts — do not infer anything else from the brand name):
- Brand name: ${brand.name}
- ${industryClause}${brandValues ? `\n- Brand values: ${brandValues}` : ''}

INFLUENCER HANDLES:
${handlesDesc}

Return a single JSON object with this exact shape:
{
  "name": "auto-detected full name or null if unknown",
  "category": "the influencer's actual content niche based on their handle/content (e.g. Beauty & Lifestyle, Fashion, Tech, Finance, Comedy, Food — based on THEIR content, not the brand)",
  "estimated_followers": {
    "instagram": <number>,
    "tiktok": <number>,
    "twitter": <number>,
    "youtube": <number>,
    "total": <number>
  },
  "profile_data": {
    "bio": "realistic estimated bio based on the influencer's own niche, not the brand",
    "content_types": ["content types the influencer actually creates"],
    "posting_frequency": "e.g. 4-5x per week",
    "audience_demographics": {
      "age_range": "e.g. 18-34",
      "primary_location": "e.g. Lagos, Nigeria",
      "interests": ["interests of the influencer's actual audience"]
    },
    "engagement_rate_estimate": <number between 0.01 and 0.15>,
    "online_reputation": {
      "positive_signals": ["actual positive signals about this influencer"],
      "negative_signals": ["actual negative signals or empty array"],
      "controversy_flags": ["actual controversy flags or empty array"],
      "summary": "brief, factual reputation summary — no industry assumptions from brand name"
    }
  },
  "brand_fit": {
    "score": <integer 0-100>,
    "audience_overlap": <integer 0-100>,
    "value_alignment": "how the influencer's content and audience align with ${brand.name} given the EXPLICITLY STATED industry: ${brandCategory ?? 'unspecified — evaluate on general fit only'}",
    "risk_factors": ["risk factors relevant to ${brandCategory ? `the ${brandCategory} industry` : 'general brand safety'} — do NOT mention food, FMCG, or any industry not stated above"],
    "positive_indicators": ["positive indicators for ${brandCategory ? `the ${brandCategory} space` : 'this brand partnership'}"],
    "recommendation": "strong_fit or potential_fit or poor_fit",
    "recommendation_notes": "specific recommendation for ${brand.name} in the ${brandCategory ?? 'stated'} context — no food/FMCG references unless ${brandCategory ?? 'x'} === 'food' or 'fmcg'"
  }
}

IMPORTANT: risk_factors, positive_indicators, value_alignment, and recommendation_notes must all be written for the ${brandCategory ? `${brandCategory} industry` : 'brand as described (no assumed industry)'}. Never reference food, beverages, FMCG, or flavors unless the brand category explicitly says so.`

  let raw: string
  try {
    raw = await callAi({
      tier: 'structural',
      system,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 1500,
      temperature: 0.3,
    })
  } catch {
    return NextResponse.json({ error: 'Analysis failed — please try again.' }, { status: 500 })
  }

  const cleaned = raw
    .replace(/^```(?:json)?\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim()

  try {
    const result = JSON.parse(cleaned)
    return NextResponse.json(result)
  } catch {
    console.error('[influencers/analyse] JSON parse error. Raw:', raw.slice(0, 300))
    return NextResponse.json({ error: 'Analysis failed — please try again.' }, { status: 500 })
  }
}
