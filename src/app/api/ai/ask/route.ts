import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
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

  const { data: brand } = await supabase.from('brands').select('id').limit(1).single()
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const body = await request.json() as AskRequest
  const question = body.question?.trim()
  if (!question) return NextResponse.json({ error: 'Question is required' }, { status: 400 })

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
