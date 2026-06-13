import Anthropic from '@anthropic-ai/sdk'

// Three-tier routing (Anthropic-only):
// cultural  (sentiment, Pidgin/Yoruba/Igbo/Hausa)    → Claude Haiku 4.5
// structural (reports, briefings, funnel diagnosis)   → Claude Sonnet 4.6
// chat       (AI Command Layer)                       → Claude Sonnet 4.6
// boardGrade (executive business cases)               → Claude Opus 4.8

export const MODELS = {
  cultural:   'claude-haiku-4-5-20251001',
  structural: 'claude-sonnet-4-6',
  chat:       'claude-sonnet-4-6',
  boardGrade: 'claude-opus-4-8',
} as const

export type ModelTier = keyof typeof MODELS

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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
