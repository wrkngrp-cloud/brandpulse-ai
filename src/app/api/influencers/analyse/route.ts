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

const SYSTEM = `You are a Nigerian brand intelligence analyst specialising in influencer marketing for FMCG food brands.
When given social media handles, you produce a realistic, data-driven profile estimate for each influencer.
You understand Nigerian social media culture: Lagos/Abuja/Port Harcourt audience demographics, Pidgin English content,
food culture (jollof, suya, puff-puff, rice dishes), ethnic community dynamics, and typical engagement benchmarks.
The client brand is Jara Foods — a Nigerian FMCG food brand selling rice, spices, and oats.
Always respond with valid JSON only. No markdown fences, no explanation — just the raw JSON object.`

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { handles } = parsed.data

  const handlesDesc = handles
    .map(h => `Platform: ${h.platform}, Handle: ${h.handle}${h.url ? `, URL: ${h.url}` : ''}`)
    .join('\n')

  const userPrompt = `Analyse the following Nigerian social media influencer profile(s) and provide a realistic estimate for Jara Foods brand partnership consideration.

Social handles provided:
${handlesDesc}

Return a single JSON object with this exact shape:
{
  "name": "auto-detected full name or null if unknown",
  "category": "content niche (e.g. Food & Lifestyle, Chef / Food Creator, etc.)",
  "estimated_followers": {
    "instagram": <number>,
    "tiktok": <number>,
    "twitter": <number>,
    "youtube": <number>,
    "total": <number>
  },
  "profile_data": {
    "bio": "realistic estimated bio",
    "content_types": ["array of content types e.g. Recipe videos, Product reviews"],
    "posting_frequency": "e.g. 4-5x per week",
    "audience_demographics": {
      "age_range": "e.g. 18-34",
      "primary_location": "e.g. Lagos, Nigeria",
      "interests": ["array of interests"]
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
    "value_alignment": "brief value alignment description",
    "risk_factors": ["array of risk factors or empty array"],
    "positive_indicators": ["array of positive indicators"],
    "recommendation": "strong_fit or potential_fit or poor_fit",
    "recommendation_notes": "actionable recommendation for Jara Foods"
  }
}

Base your estimates on realistic Nigerian influencer benchmarks. For food/lifestyle creators with handles suggesting Nigerian food content, assume stronger brand fit scores.`

  let raw: string
  try {
    raw = await callAi({
      tier: 'structural',
      system: SYSTEM,
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
