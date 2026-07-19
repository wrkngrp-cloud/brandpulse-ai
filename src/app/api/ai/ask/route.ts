import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getActiveBrandId } from '@/lib/active-brand'
import { callAi } from '@/lib/ai/client'
import { buildAskSystemPrompt, AskSource } from '@/lib/ai/ask-context'

export const runtime    = 'nodejs'
export const maxDuration = 60

interface AskRequest {
  question: string
  conversationId?: string | null
}

interface AiAnswer {
  answer: string
  sources: AskSource[]
  confidence: 'High' | 'Medium' | 'Low'
  collectionRecommendation: string | null
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No active brand' }, { status: 404 })
  const brand = { id: brandId }

  const body = await request.json() as AskRequest
  const question = body.question?.trim()
  if (!question) return NextResponse.json({ error: 'Question is required' }, { status: 400 })

  // With no data connected there is nothing to answer from — skip the AI call
  // and tell the user exactly what to set up, with links to the fix.
  const [
    { count: connectionCount },
    { count: mentionCount },
    { count: brandSurveyCount },
    { count: campaignCount },
  ] = await Promise.all([
    supabase.from('social_connections').select('id', { count: 'exact', head: true }).eq('brand_id', brandId),
    supabase.from('mentions').select('id', { count: 'exact', head: true }).eq('brand_id', brandId),
    supabase.from('surveys').select('id', { count: 'exact', head: true }).eq('brand_id', brandId),
    supabase.from('campaigns').select('id', { count: 'exact', head: true }).eq('brand_id', brandId),
  ])

  if (!connectionCount && !mentionCount && !brandSurveyCount && !campaignCount) {
    return NextResponse.json({
      error: 'We do not have any of your brand data yet, so there is nothing to answer from. Connect a social account and we start reading your mentions tonight, or launch a survey to hear from your customers directly.',
      ctas: [
        { label: 'Connect a data source', href: '/dashboard/connectors' },
        { label: 'Launch a survey',       href: '/dashboard/surveys' },
      ],
    }, { status: 422 })
  }

  const service = await createServiceClient()

  // Load prior conversation if continuing
  let priorMessages: Array<{ role: 'user' | 'assistant'; content: string }> = []
  if (body.conversationId) {
    const { data: conv } = await service
      .from('ai_conversations')
      .select('messages')
      .eq('id', body.conversationId)
      .eq('brand_id', brand.id)
      .single()
    if (conv?.messages) {
      priorMessages = (conv.messages as typeof priorMessages).slice(-10) // last 5 turns
    }
  }

  // Build system prompt with live data snapshot
  const { systemPrompt } = await buildAskSystemPrompt(brand.id)

  // Call Claude Sonnet 4.6
  const messages = [
    ...priorMessages,
    { role: 'user' as const, content: question },
  ]

  let parsed: AiAnswer
  try {
    const raw = await callAi({
      tier: 'chat',
      system: systemPrompt,
      messages,
      maxTokens: 1500,
      temperature: 0.2,
    })

    // Strip markdown fences if Claude wraps the JSON
    const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
    parsed = JSON.parse(cleaned) as AiAnswer
  } catch {
    return NextResponse.json({ error: 'AI response could not be parsed. Please try again.' }, { status: 502 })
  }

  // Persist conversation
  const assistantContent = parsed.answer
  const updatedMessages = [
    ...priorMessages,
    { role: 'user', content: question },
    { role: 'assistant', content: assistantContent },
  ]

  let conversationId = body.conversationId
  if (conversationId) {
    await service.from('ai_conversations').update({
      messages: updatedMessages,
      sources_cited: parsed.sources,
      updated_at: new Date().toISOString(),
    }).eq('id', conversationId)
  } else {
    const { data: newConv } = await service.from('ai_conversations').insert({
      brand_id: brand.id,
      user_id: user.id,
      messages: updatedMessages,
      sources_cited: parsed.sources,
    }).select('id').single()
    conversationId = newConv?.id ?? null
  }

  return NextResponse.json({
    answer: parsed.answer,
    sources: parsed.sources ?? [],
    confidence: parsed.confidence ?? 'Low',
    collectionRecommendation: parsed.collectionRecommendation ?? null,
    conversationId,
  })
}
