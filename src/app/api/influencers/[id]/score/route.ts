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

  // Fetch brand with enough context to score accurately for this specific brand
  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, category, brand_values, target_segments')
    .limit(1)
    .single()

  if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 })

  // Fetch influencer, verify it belongs to this brand (RLS also enforces this)
  const { data: influencer } = await supabase
    .from('influencers')
    .select('id, brand_id, name, handle, platform, category, followers')
    .eq('id', id)
    .eq('brand_id', brand.id)
    .single()

  if (!influencer) return NextResponse.json({ error: 'Influencer not found' }, { status: 404 })

  const followersText = influencer.followers
    ? `${influencer.followers.toLocaleString('en-NG')} followers`
    : 'unknown follower count'

  // Build brand context so the model evaluates within the correct industry
  const brandCategory = brand.category ?? null
  const brandValues   = Array.isArray(brand.brand_values) && brand.brand_values.length > 0
    ? (brand.brand_values as string[]).join(', ')
    : null

  const industryClause = brandCategory
    ? `The brand operates in the ${brandCategory} industry.`
    : 'The brand industry is not specified — do not assume any industry from the brand name.'

  const systemPrompt = `You are a brand safety and cultural intelligence analyst for Nigerian brands. Score influencers for cultural fit and brand safety risk within the explicitly provided industry of the client brand.

CRITICAL RULE: The brand name is irrelevant to industry classification. "Sweetness" could be a fintech, "Lion" could be a beauty brand. Evaluate ONLY based on the explicitly stated industry/category field, never from the brand name. If no industry is stated, acknowledge that and base your scoring on general brand safety, not any assumed industry.`

  const userPrompt = `Score this influencer for a Nigerian brand.

BRAND DETAILS:
- Brand name: ${brand.name}
- ${industryClause}${brandValues ? `\n- Brand values: ${brandValues}` : ''}

INFLUENCER DETAILS:
- Name: ${influencer.name}
- Handle: @${influencer.handle}
- Platform: ${influencer.platform}
- Content category: ${influencer.category ?? 'not specified'}
- Audience size: ${followersText}

SCORING INSTRUCTIONS:
Do NOT make assumptions about the brand's industry from its name. Use ONLY the explicitly provided industry above.

1. cultural_iq (0-100): How culturally resonant is this creator for Nigerian audiences in the ${brandCategory ? `${brandCategory} space` : "brand's context"}? Consider language/tone, content style, Nigerian cultural relevance, and audience demographics on ${influencer.platform}.
2. risk_score (0-100): Brand safety risk (0 = very safe, 100 = very risky). Consider content controversies, audience misalignment, and reputational risks specific to the ${brandCategory ?? 'brand'} context. Do not bring in food/FMCG/unrelated industry risks unless the brand is explicitly in that space.
3. ai_notes: 2-3 sentences. Explain the cultural fit and risk assessment in the context of ${brandCategory ? `the ${brandCategory} industry` : 'this brand'}. Do not reference food, FMCG, or any other industry unless it is explicitly stated above.

Return ONLY this JSON — no markdown, no explanation:
{
  "cultural_iq": <number 0-100>,
  "risk_score": <number 0-100>,
  "ai_notes": "<2-3 sentences specific to the stated industry>"
}`

  let parsed: { cultural_iq: number; risk_score: number; ai_notes: string }

  try {
    const text = await callAi({
      tier:        'structural',
      system:      systemPrompt,
      messages:    [{ role: 'user', content: userPrompt }],
      maxTokens:   400,
      temperature: 0.2,
    })

    parsed = JSON.parse(text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim())

    // Clamp values to valid range
    const cultural_iq = Math.min(100, Math.max(0, Math.round(parsed.cultural_iq)))
    const risk_score  = Math.min(100, Math.max(0, Math.round(parsed.risk_score)))
    const ai_notes    = String(parsed.ai_notes).trim()

    const { data: updated, error } = await supabase
      .from('influencers')
      .update({ cultural_iq, risk_score, ai_notes, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('brand_id', brand.id)
      .select()
      .single()

    if (error) {
      console.error('[influencers/score] update error', error)
      return NextResponse.json({ error: 'Failed to save scores.' }, { status: 500 })
    }

    return NextResponse.json({ influencer: updated })
  } catch (err) {
    console.error('[influencers/score] AI or parse error', err)
    return NextResponse.json({ error: 'Scoring failed — please try again.' }, { status: 500 })
  }
}
