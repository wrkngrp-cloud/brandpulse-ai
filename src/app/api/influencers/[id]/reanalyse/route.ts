/**
 * POST /api/influencers/[id]/reanalyse
 *
 * Re-runs the AI analysis for an existing influencer and updates
 * profile_data and brand_fit in the database.
 * Useful when the stored analysis was generated with an incorrect industry inference.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAi } from '@/lib/ai/client'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, category, brand_values, target_segments')
    .limit(1)
    .single()
  if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 })

  const { data: influencer } = await supabase
    .from('influencers')
    .select('id, brand_id, name, handle, platform, category, followers, social_urls')
    .eq('id', id)
    .eq('brand_id', brand.id)
    .single()
  if (!influencer) return NextResponse.json({ error: 'Influencer not found' }, { status: 404 })

  const brandCategory = brand.category ?? null
  const brandValues   = Array.isArray(brand.brand_values) && brand.brand_values.length > 0
    ? (brand.brand_values as string[]).join(', ')
    : null

  const industryClause = brandCategory
    ? `The brand operates in the ${brandCategory} industry.`
    : 'The brand industry is NOT specified. Do NOT infer industry from the brand name under any circumstances.'

  const brandDesc = [
    brandCategory ? `a Nigerian ${brandCategory} brand` : 'a Nigerian brand (industry unspecified)',
    brandValues ? `Values: ${brandValues}` : null,
  ].filter(Boolean).join('. ')

  const socialUrls = (influencer.social_urls as Record<string, string> | null) ?? {}
  const primaryUrl = socialUrls[influencer.platform] ?? null

  const system = `You are a Nigerian brand intelligence analyst specialising in influencer marketing.
You produce realistic, data-driven profile estimates for Nigerian social media influencers.
You understand Nigerian social media culture, Pidgin English content, Lagos/Abuja/Port Harcourt audience dynamics.

CRITICAL RULE — INDUSTRY INFERENCE:
Brand names NEVER indicate industry. "Sweetness" is NOT food. "Lion" is NOT beverages. "Bloom" is NOT agriculture.
Use ONLY the explicitly stated industry below. If none given, evaluate on general brand safety — never fabricate.
Respond with valid JSON only. No markdown, no explanation.`

  const userPrompt = `Re-analyse this Nigerian influencer for a brand partnership review.

BRAND DETAILS (use ONLY these — do not infer anything from the brand name):
- Brand name: ${brand.name}
- ${industryClause}${brandValues ? `\n- Brand values: ${brandValues}` : ''}

INFLUENCER:
- Name: ${influencer.name}
- Handle: @${influencer.handle}
- Platform: ${influencer.platform}
- Content category: ${influencer.category ?? 'not specified'}
- Followers: ${influencer.followers?.toLocaleString('en-NG') ?? 'unknown'}${primaryUrl ? `\n- Profile URL: ${primaryUrl}` : ''}

Return ONLY this JSON shape:
{
  "profile_data": {
    "bio": "realistic bio for this influencer's actual niche",
    "content_types": ["content types based on the influencer's actual niche"],
    "posting_frequency": "e.g. 3-4x per week",
    "audience_demographics": {
      "age_range": "e.g. 18-34",
      "primary_location": "e.g. Lagos, Nigeria",
      "interests": ["interests relevant to the influencer's actual audience"]
    },
    "engagement_rate_estimate": <number 0.01-0.15>,
    "online_reputation": {
      "positive_signals": ["actual positive reputation signals"],
      "negative_signals": ["actual negative signals or empty array"],
      "controversy_flags": ["actual controversy flags or empty array"],
      "summary": "brief factual reputation summary — no industry assumptions from brand name"
    }
  },
  "brand_fit": {
    "score": <integer 0-100>,
    "audience_overlap": <integer 0-100>,
    "value_alignment": "how this influencer's audience aligns with ${brand.name} in the ${brandCategory ?? 'stated'} context",
    "risk_factors": ["risks relevant to ${brandCategory ? `the ${brandCategory} industry` : 'general brand safety'} — NO food/FMCG references unless brand category is food/fmcg"],
    "positive_indicators": ["strengths for ${brandCategory ? `the ${brandCategory} space` : 'this brand partnership'}"],
    "recommendation": "strong_fit or potential_fit or poor_fit",
    "recommendation_notes": "specific recommendation for ${brand.name} — reference the ${brandCategory ?? 'brand'} context, never food or FMCG unless explicitly stated"
  }
}

IMPORTANT: All brand_fit fields must reflect the ${brandCategory ? `${brandCategory} industry` : 'brand context as stated above'}. Never mention food, beverages, FMCG, flavors, or tastes unless brand category explicitly includes them.`

  let raw: string
  try {
    raw = await callAi({
      tier:        'structural',
      system,
      messages:    [{ role: 'user', content: userPrompt }],
      maxTokens:   1200,
      temperature: 0.2,
    })
  } catch {
    return NextResponse.json({ error: 'Analysis failed — please try again.' }, { status: 500 })
  }

  const cleaned = raw
    .replace(/^```(?:json)?\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim()

  let result: { profile_data?: unknown; brand_fit?: unknown }
  try {
    result = JSON.parse(cleaned) as typeof result
  } catch {
    console.error('[influencers/reanalyse] JSON parse error:', raw.slice(0, 300))
    return NextResponse.json({ error: 'Analysis failed — please try again.' }, { status: 500 })
  }

  const { data: updated, error } = await supabase
    .from('influencers')
    .update({
      profile_data: result.profile_data ?? {},
      brand_fit:    result.brand_fit    ?? {},
      updated_at:   new Date().toISOString(),
    })
    .eq('id', id)
    .eq('brand_id', brand.id)
    .select()
    .single()

  if (error) {
    console.error('[influencers/reanalyse] update error:', error)
    return NextResponse.json({ error: 'Failed to save analysis.' }, { status: 500 })
  }

  return NextResponse.json({ influencer: updated })
}
