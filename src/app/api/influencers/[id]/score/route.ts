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

  // Get brand for ownership check
  const { data: brand } = await supabase
    .from('brands')
    .select('id, name')
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

  const systemPrompt = `You are a brand safety and cultural intelligence analyst for Nigerian brands. Score influencers for cultural fit and brand safety risk. Return ONLY valid JSON.`

  const userPrompt = `Score the following influencer for a Nigerian brand called "${brand.name}".

Influencer details:
- Name: ${influencer.name}
- Handle: @${influencer.handle}
- Platform: ${influencer.platform}
- Category: ${influencer.category ?? 'not specified'}
- Audience size: ${followersText}

Scoring criteria:
1. cultural_iq (0-100): How culturally resonant this creator is likely to be for Nigerian audiences. Consider language, content style, local relevance, audience demographics, and engagement patterns typical for their category on ${influencer.platform} in Nigeria.
2. risk_score (0-100): Brand safety risk score (0 = very safe, 100 = very risky). Consider the platform's controversy history for this content category, typical content risks, audience fit with a reputable brand, and any known patterns in the category.
3. ai_notes: 2-3 sentences summarising your assessment. Be specific about what makes them culturally relevant (or not) and what drives the risk score.

Return exactly this JSON shape with no other text:
{
  "cultural_iq": <number 0-100>,
  "risk_score": <number 0-100>,
  "ai_notes": "<2-3 sentence assessment>"
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

    parsed = JSON.parse(text)

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
