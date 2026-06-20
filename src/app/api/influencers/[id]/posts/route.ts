import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAi } from '@/lib/ai/client'

export const runtime  = 'nodejs'
export const maxDuration = 60

// ── helpers ────────────────────────────────────────────────────────────────────

function detectPlatform(url: string): string {
  if (url.includes('instagram.com'))                           return 'instagram'
  if (url.includes('tiktok.com'))                             return 'tiktok'
  if (url.includes('twitter.com') || url.includes('x.com'))  return 'twitter'
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (url.includes('facebook.com'))                           return 'facebook'
  return 'other'
}

function detectPostType(url: string, platform: string): string {
  if (platform === 'instagram') {
    if (url.includes('/reel/'))    return 'reel'
    if (url.includes('/p/'))       return 'feed'
    if (url.includes('/stories/')) return 'story'
    return 'feed'
  }
  if (platform === 'youtube') {
    if (url.includes('/shorts/')) return 'short'
    return 'video'
  }
  if (platform === 'tiktok')  return 'video'
  if (platform === 'twitter') return 'tweet'
  return 'post'
}

function computeEngagementRate(
  likes: number | null, comments: number | null, shares: number | null, saves: number | null,
  reach: number | null, followers: number | null
): string {
  const total = (likes ?? 0) + (comments ?? 0) + (shares ?? 0) + (saves ?? 0)
  const base  = reach ?? followers
  if (!base || !total) return 'not computable'
  return `${((total / base) * 100).toFixed(2)}% (${reach ? 'by reach' : 'by followers'})`
}

// ── GET — list posts for influencer ───────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: brand } = await supabase
    .from('brands').select('id').limit(1).single()
  if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 })

  const { data: posts, error } = await supabase
    .from('influencer_posts')
    .select('*')
    .eq('influencer_id', id)
    .eq('brand_id', brand.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ posts: posts ?? [] })
}

// ── POST — submit a post and analyse it ───────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body?.post_url) {
    return NextResponse.json({ error: 'post_url is required' }, { status: 400 })
  }

  // Fetch brand context
  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, category, brand_values, target_segments')
    .limit(1)
    .single()
  if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 })

  // Fetch influencer (RLS enforces brand ownership)
  const { data: influencer } = await supabase
    .from('influencers')
    .select('id, brand_id, name, handle, platform, category, followers, cultural_iq, campaign_id')
    .eq('id', id)
    .eq('brand_id', brand.id)
    .single()
  if (!influencer) return NextResponse.json({ error: 'Influencer not found' }, { status: 404 })

  // Fetch campaign context if linked
  let campaign: { id: string; name: string; objective: string | null; start_date: string | null; end_date: string | null } | null = null
  const campaignId = body.campaign_id ?? influencer.campaign_id
  if (campaignId) {
    const { data: c } = await supabase
      .from('campaigns')
      .select('id, name, objective, start_date, end_date')
      .eq('id', campaignId)
      .eq('brand_id', brand.id)
      .single()
    campaign = c
  }

  // Detect platform and post type
  const platform = detectPlatform(body.post_url)
  const postType = detectPostType(body.post_url, platform)

  // Engagement metrics from body
  const views    = body.views    ? Number(body.views)    : null
  const likes    = body.likes    ? Number(body.likes)    : null
  const comments = body.comments ? Number(body.comments) : null
  const shares   = body.shares   ? Number(body.shares)   : null
  const saves    = body.saves    ? Number(body.saves)    : null
  const reach    = body.reach    ? Number(body.reach)    : null

  // Save the post record first so we have an ID
  const { data: post, error: insertErr } = await supabase
    .from('influencer_posts')
    .insert({
      brand_id:        brand.id,
      influencer_id:   id,
      campaign_id:     campaignId ?? null,
      post_url:        body.post_url,
      platform,
      post_type:       postType,
      views,
      likes,
      comments,
      shares,
      saves,
      reach,
      comment_samples: body.comment_samples ?? null,
    })
    .select()
    .single()

  if (insertErr || !post) {
    return NextResponse.json({ error: 'Failed to save post.' }, { status: 500 })
  }

  // ── Build Claude prompt ────────────────────────────────────────────────────

  const brandCategory  = brand.category ?? null
  const brandValues    = Array.isArray(brand.brand_values) && brand.brand_values.length > 0
    ? (brand.brand_values as string[]).join(', ')
    : null
  const brandDesc      = [brandCategory, brandValues ? `Values: ${brandValues}` : null].filter(Boolean).join('. ')
  const followersText  = influencer.followers ? influencer.followers.toLocaleString('en-NG') : 'unknown'
  const engagementRate = computeEngagementRate(likes, comments, shares, saves, reach, influencer.followers)

  const metricsLines = [
    views    != null ? `Views: ${views.toLocaleString('en-NG')}`    : null,
    likes    != null ? `Likes: ${likes.toLocaleString('en-NG')}`    : null,
    comments != null ? `Comments: ${comments.toLocaleString('en-NG')}` : null,
    shares   != null ? `Shares: ${shares.toLocaleString('en-NG')}`  : null,
    saves    != null ? `Saves: ${saves.toLocaleString('en-NG')}`    : null,
    reach    != null ? `Reach: ${reach.toLocaleString('en-NG')}`    : null,
    `Engagement rate: ${engagementRate}`,
  ].filter(Boolean).join('\n')

  const hasMetrics      = [views, likes, comments, shares, saves, reach].some(v => v != null)
  const hasComments     = !!body.comment_samples?.trim()
  const commentSection  = hasComments
    ? `COMMENT SAMPLES (for sentiment analysis):\n${body.comment_samples.trim()}`
    : 'COMMENT SAMPLES: Not provided — infer sentiment from engagement pattern and platform norms.'

  const campaignSection = campaign
    ? `CAMPAIGN\n- Name: ${campaign.name}\n- Objective: ${campaign.objective ?? 'not specified'}\n- Dates: ${campaign.start_date ?? '?'} to ${campaign.end_date ?? '?'}`
    : 'CAMPAIGN: Not linked to a specific campaign (always-on content).'

  const system = `You are a senior Nigerian influencer marketing strategist. Given engagement data and context for a brand-sponsored post, produce a comprehensive performance and brand fit assessment. Your analysis must be grounded in Nigerian and West African market norms for the brand's industry. Return ONLY valid JSON — no markdown, no explanation.`

  const userPrompt = `Assess the following brand collaboration post.

BRAND
- Name: ${brand.name}
- ${brandDesc || 'Category: not specified'}

${campaignSection}

INFLUENCER
- Name: ${influencer.name} (@${influencer.handle})
- Platform: ${influencer.platform}
- Content category: ${influencer.category ?? 'not specified'}
- Followers: ${followersText}
- Cultural IQ score: ${influencer.cultural_iq != null ? `${influencer.cultural_iq}/100` : 'not scored'}

POST
- URL: ${body.post_url}
- Detected type: ${postType} on ${platform}

ENGAGEMENT METRICS${hasMetrics ? '' : ' (none provided — base assessment on influencer profile and platform context)'}:
${hasMetrics ? metricsLines : 'No metrics provided.'}

${commentSection}

Return this exact JSON structure — no other text:
{
  "performance_score": <0-100: post engagement vs Nigerian ${platform} benchmark for ${influencer.category ?? 'this'} content>,
  "brand_integration_score": <0-100: how naturally and effectively ${brand.name} was integrated — is it authentic or feels like an ad?>,
  "community_fit_score": <0-100: how well the influencer's community matches ${brand.name}'s target audience in the ${brandCategory ?? 'brand'} space>,
  "content_authenticity_score": <0-100: does the post feel genuine and on-brand for the creator, or forced?>,
  "campaign_alignment": {
    "objective": "${campaign?.objective ?? 'general awareness'}",
    "met": <true|false>,
    "confidence": "<high|medium|low>",
    "notes": "<1-2 sentences on how well the post served the campaign objective>"
  },
  "sentiment_analysis": {
    "overall": "<positive|neutral|negative>",
    "positive_pct": <0-100>,
    "neutral_pct": <0-100>,
    "negative_pct": <0-100>,
    "brand_mention_sentiment": "<positive|neutral|negative|mixed>",
    "key_themes": ["<theme from audience response, e.g. trust, curiosity, aspiration>"],
    "conversion_signals": ["<signals of purchase intent or brand discovery, e.g. 'audience asking where to buy', 'link clicks mentioned'>"],
    "concern_signals": ["<any warning signs, e.g. scepticism about authenticity, negative brand associations>"]
  },
  "brand_association": {
    "score": <0-100: strength of positive brand association this post is building>,
    "community_receptivity": "<high|medium|low>",
    "naturalness": "<organic|moderate|forced>",
    "audience_intent_signals": ["<specific behaviours showing the community is receptive, e.g. asking follow-up questions, tagging others>"]
  },
  "fit_verdict": {
    "overall": "<strong_fit|good_fit|moderate_fit|poor_fit>",
    "score": <0-100: overall influencer-brand fit score based on this post evidence>,
    "recommendation": "<renew|consider|discontinue>",
    "rationale": "<2-3 sentences: was this influencer the right choice, and why — be direct and specific>",
    "strengths": ["<what worked well about this partnership>"],
    "weaknesses": ["<what underperformed or misaligned>"],
    "risks": ["<any ongoing risks if the partnership continues>"]
  },
  "executive_summary": "<2-3 sentences: what happened, what it means for ${brand.name}'s brand health, key take-away>",
  "action_items": [
    "<specific, actionable next step 1>",
    "<specific, actionable next step 2>",
    "<specific, actionable next step 3>",
    "<specific, actionable next step 4>"
  ]
}`

  let analysis: Record<string, unknown> | null = null
  let overallScore: number | null = null

  try {
    const raw = await callAi({
      tier:        'structural',
      system,
      messages:    [{ role: 'user', content: userPrompt }],
      maxTokens:   1200,
      temperature: 0.2,
    })

    const cleaned = raw
      .replace(/^```(?:json)?\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim()

    analysis     = JSON.parse(cleaned)
    overallScore = typeof (analysis?.fit_verdict as Record<string, unknown>)?.score === 'number'
      ? Math.min(100, Math.max(0, Math.round((analysis!.fit_verdict as Record<string, unknown>).score as number)))
      : null
  } catch (aiErr) {
    console.error('[influencer_posts] AI analysis failed:', aiErr)
    // Save the post without analysis rather than failing the whole request
  }

  // Update post with analysis results
  const { data: updated, error: updateErr } = await supabase
    .from('influencer_posts')
    .update({
      analysis:     analysis,
      overall_score: overallScore,
      analyzed_at:  analysis ? new Date().toISOString() : null,
    })
    .eq('id', post.id)
    .select()
    .single()

  if (updateErr) {
    console.error('[influencer_posts] update error:', updateErr)
    return NextResponse.json({ post })  // return the unanalysed post rather than failing
  }

  return NextResponse.json({ post: updated })
}
