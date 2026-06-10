import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

// Three-tier routing per CLAUDE.md:
// cultural (sentiment, Pidgin/Yoruba/Igbo/Hausa)  → Claude Haiku 4.5
// structural (reports, briefings, funnel diagnosis) → NIM Llama 4 Maverick
// board-grade business cases only                   → Claude Opus 4.8
// fallback if NIM credits exhausted                 → zhipu/glm-4

export const MODELS = {
  cultural: 'claude-haiku-4-5-20251001',
  structural: 'meta/llama-4-maverick-17b-128e-instruct',
  boardGrade: 'claude-opus-4-8',
  nimFallback: 'zhipu/glm-4',
} as const

export type ModelTier = keyof typeof MODELS

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const nim = new OpenAI({
  baseURL: 'https://integrate.api.nvidia.com/v1',
  apiKey: process.env.NIM_API_KEY ?? '',
})

export interface AiMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AiCallOptions {
  tier: ModelTier
  system: string
  messages: AiMessage[]
  maxTokens?: number
  temperature?: number
}

export async function callAi(opts: AiCallOptions): Promise<string> {
  const { tier, system, messages, maxTokens = 2048, temperature = 0 } = opts

  if (tier === 'cultural' || tier === 'boardGrade') {
    const resp = await anthropic.messages.create({
      model: MODELS[tier],
      max_tokens: maxTokens,
      temperature,
      system,
      messages,
    })
    const block = resp.content[0]
    if (block.type !== 'text') throw new Error('Unexpected content type from Claude')
    return block.text
  }

  // NIM / GLM-4 via OpenAI-compatible endpoint
  const resp = await nim.chat.completions.create({
    model: MODELS[tier],
    max_tokens: maxTokens,
    temperature,
    messages: [{ role: 'system', content: system }, ...messages],
  })
  return resp.choices[0].message.content ?? ''
}
