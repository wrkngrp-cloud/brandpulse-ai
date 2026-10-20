/**
 * Asking the external assistants what they say.
 *
 * This is the one place CLAUDE.md allows a non-Anthropic generation call, and
 * only for the reason stated there: these models are the thing being measured,
 * never the thing producing our output. The AI Visibility Tracker measures
 * whether a brand gets mentioned; the Brand Perception Gap measures how a
 * brand gets described. Both are readings of a third party, so both read the
 * same way, and the code lives here once rather than twice.
 *
 * Each platform is conditional on its own key and returns null without one, so
 * a deployment with two keys set measures two assistants and says so. Never
 * name the platform in any UI: the finding is "an AI assistant describes you
 * this way", not an endorsement or a comparison of models.
 */

export type AssistantPlatform = 'chatgpt' | 'gemini' | 'perplexity'

export const ASSISTANT_PLATFORMS: AssistantPlatform[] = ['chatgpt', 'gemini', 'perplexity']

const KEY_FOR: Record<AssistantPlatform, string> = {
  chatgpt:    'OPENAI_API_KEY',
  gemini:     'GOOGLE_AI_API_KEY',
  perplexity: 'PERPLEXITY_API_KEY',
}

/** Which assistants this deployment can actually reach. */
export function configuredAssistants(): AssistantPlatform[] {
  return ASSISTANT_PLATFORMS.filter(p => Boolean(process.env[KEY_FOR[p]]))
}

// Every call here runs inside Promise.all alongside its sibling platforms, so
// one stalled provider must not be able to hang the whole batch past the
// route's maxDuration — a plain fetch with no signal can hang indefinitely on
// a dead connection, and a function killed by the platform's time limit never
// reaches its own catch block, so the caller gets a closed connection instead
// of a JSON error. Mirrors the timeout fetchPublic already applies.
const ASSISTANT_TIMEOUT_MS = 20_000

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ASSISTANT_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export async function queryAssistant(
  platform: AssistantPlatform,
  question: string,
  opts?: { maxTokens?: number },
): Promise<string | null> {
  const maxTokens = opts?.maxTokens ?? 400
  try {
    if (platform === 'chatgpt') {
      const key = process.env.OPENAI_API_KEY
      if (!key) return null
      const res = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: question }],
          max_tokens: maxTokens,
        }),
      })
      if (!res.ok) return null
      const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
      return data.choices?.[0]?.message?.content ?? null
    }

    if (platform === 'gemini') {
      const key = process.env.GOOGLE_AI_API_KEY
      if (!key) return null
      const res = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: question }] }],
            generationConfig: { maxOutputTokens: maxTokens },
          }),
        },
      )
      if (!res.ok) return null
      const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null
    }

    if (platform === 'perplexity') {
      const key = process.env.PERPLEXITY_API_KEY
      if (!key) return null
      const res = await fetchWithTimeout('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: 'sonar',
          messages: [{ role: 'user', content: question }],
          max_tokens: maxTokens,
        }),
      })
      if (!res.ok) return null
      const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
      return data.choices?.[0]?.message?.content ?? null
    }
  } catch {
    return null
  }
  return null
}
