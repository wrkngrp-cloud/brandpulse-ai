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

  const brandDesc = [
    brandCategory ? `a Nigerian ${brandCategory} brand` : 'a Nigerian brand',
    brandValues   ? `Brand values: ${brandValues}`      : null,
  ].filter(Boolean).join('. ')

  const system = `You are a Nigerian brand intelligence analyst specialising in influencer marketing.
When given social media handles, you produce a realistic, data-driven profile estimate for each influencer.
You understand Nigerian social media culture: Lagos/Abuja/Port Harcourt audience demographics, Pidgin English content,
local culture and community dynamics, and typical engagement benchmarks for Nigerian creators.
The client brand is ${brand.name} — ${brandDesc}.
Evaluate influencer fit strictly within the context of ${brand.name}'s industry and audience — do not assume food, FMCG, or any other category unless it matches the brand's actual category.
Always respond with valid JSON only. No markdown fences, no explanation — just the raw JSON object.`

  const handlesDesc = handles
    .map(h => `Platform: ${h.platform}, Handle: ${h.handle}${h.url ? `, URL: ${h.url}` : ''}`)
    .join('\n')

  const userPrompt = `Analyse the following Nigerian social media influencer profile(s) and provide a realistic estimate for ${brand.name} brand partnership consideration.

Brand context: ${brand.name} is ${brandDesc}.

Social handles provided:
${handlesDesc}

Return a single JSON object with this exact shape:
{
  "name": "auto-detected full name or null if unknown",
  "category": "content niche that matches the influencer's actual content (e.g. Beauty & Lifestyle, Fashion, Tech, Finance, Comedy, etc.)",
  "estimated_followers": {
    "instagram": <number>,
    "tiktok": <number>,
    "twitter": <number>,
    "youtube": <number>,
    "total": <number>
  },
  "profile_data": {
    "bio": "realistic estimated bio based on the influencer's actual niche",
    "content_types": ["array of content types relevant to the influencer's actual niche"],
    "posting_frequency": "e.g. 4-5x per week",
    "audience_demographics": {
      "age_range": "e.g. 18-34",
      "primary_location": "e.g. Lagos, Nigeria",
      "interests": ["array of interests relevant to the influencer's actual niche"]
    },
    "engagement_rate_estimate": <number between 0.01 and 0.15>,
    "online_reputation": {
      "positive_signals": ["array of positive signals"],
      "negative_signals": ["array of negative signals or empty array"],
      "controversy_flags": ["array of controversy flags or empty array"],
      "summary": "brief reputation summary"
    }
  },
  "brand_fit": {
    "score": <integer 0-100>,
    "audience_overlap": <integer 0-100>,
    "value_alignment": "how the influencer's content and audience align with ${brand.name}'s industry and values",
    "risk_factors": ["array of risk factors relevant to ${brand.name}"],
    "positive_indicators": ["array of positive indicators specific to ${brand.name}'s industry"],
    "recommendation": "strong_fit or potential_fit or poor_fit",
    "recommendation_notes": "actionable recommendation for ${brand.name} — be specific about why this creator fits or doesn't fit the ${brandCategory ?? 'brand'} space"
  }
}

Base all estimates on realistic Nigerian influencer benchmarks. Evaluate brand fit based on ${brand.name}'s actual industry (${brandCategory ?? 'as described above'}), not on generic food or FMCG assumptions.`

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
