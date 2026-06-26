import { inngest } from '../client'
import { createServiceClient } from '@/lib/supabase/server'
import { callAi } from '@/lib/ai/client'

interface Brand {
  id: string
  name: string
  category: string | null
  cultural_profile: Record<string, unknown>
}

interface CheckResult {
  platform: string
  question: string
  brand_mentioned: boolean
  mention_position: 'early' | 'mid' | 'late' | null
  tone: 'positive' | 'neutral' | 'negative' | null
  competitors_mentioned: string[]
  response_excerpt: string
}

function mondayOf(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

async function generateQuestions(brand: Brand): Promise<string[]> {
  const category = brand.category ?? 'consumer brand'
  const raw = await callAi({
    tier: 'structural',
    system: 'You generate realistic Nigerian consumer questions that people might type into an AI assistant. Return JSON only.',
    messages: [{
      role: 'user',
      content: `Generate 5 natural questions a Nigerian consumer might ask an AI assistant that would logically surface a recommendation for a brand in the "${category}" category. The brand is: ${brand.name}.

Questions should be:
- General enough that the brand isn't name-dropped in the question
- Specific to the Nigerian/West African market context
- The kind of question where a recommendation for this brand category would be natural

Return ONLY this JSON (no preamble):
{ "questions": ["question1", "question2", "question3", "question4", "question5"] }`,
    }],
    maxTokens: 400,
    temperature: 0.4,
  })

  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(cleaned) as { questions: string[] }
    return parsed.questions.slice(0, 5)
  } catch {
    return [
      `What are the best ${category} brands in Nigeria?`,
      `Which ${category} should I use in Lagos?`,
      `Top recommended ${category} options in West Africa`,
      `How do I choose a good ${category} in Nigeria?`,
      `Best ${category} for Nigerians — what do you recommend?`,
    ]
  }
}

async function queryPlatform(
  platform: 'chatgpt' | 'gemini' | 'perplexity',
  question: string,
): Promise<string | null> {
  try {
    if (platform === 'chatgpt') {
      const key = process.env.OPENAI_API_KEY
      if (!key) return null
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: question }],
          max_tokens: 400,
        }),
      })
      if (!res.ok) return null
      const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
      return data.choices?.[0]?.message?.content ?? null
    }

    if (platform === 'gemini') {
      const key = process.env.GOOGLE_AI_API_KEY
      if (!key) return null
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: question }] }],
            generationConfig: { maxOutputTokens: 400 },
          }),
        }
      )
      if (!res.ok) return null
      const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null
    }

    if (platform === 'perplexity') {
      const key = process.env.PERPLEXITY_API_KEY
      if (!key) return null
      const res = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: 'sonar',
          messages: [{ role: 'user', content: question }],
          max_tokens: 400,
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

async function analyzeResponse(
  brandName: string,
  question: string,
  response: string,
): Promise<Omit<CheckResult, 'platform' | 'question'>> {
  const excerpt = response.slice(0, 500)
  const raw = await callAi({
    tier: 'structural',
    system: 'Brand visibility analyst. Analyze AI responses for brand mentions. Return JSON only.',
    messages: [{
      role: 'user',
      content: `Analyze this AI response for mentions of the brand "${brandName}".

Question asked: ${question}

AI response:
${response}

Determine:
1. brand_mentioned: Is "${brandName}" explicitly mentioned (true/false)?
2. mention_position: If mentioned, is it in the first third (early), middle third (mid), or last third (late) of the response? null if not mentioned.
3. tone: If mentioned, what is the tone of the mention — positive (recommended/praised), neutral (just listed), or negative (warned against)? null if not mentioned.
4. competitors_mentioned: List any competitor brand names mentioned in the response (empty array if none).

Return ONLY this JSON:
{
  "brand_mentioned": boolean,
  "mention_position": "early" | "mid" | "late" | null,
  "tone": "positive" | "neutral" | "negative" | null,
  "competitors_mentioned": ["BrandA", "BrandB"]
}`,
    }],
    maxTokens: 300,
    temperature: 0,
  })

  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(cleaned) as {
      brand_mentioned: boolean
      mention_position: 'early' | 'mid' | 'late' | null
      tone: 'positive' | 'neutral' | 'negative' | null
      competitors_mentioned: string[]
    }
    return {
      brand_mentioned:      parsed.brand_mentioned ?? false,
      mention_position:     parsed.mention_position ?? null,
      tone:                 parsed.tone ?? null,
      competitors_mentioned: parsed.competitors_mentioned ?? [],
      response_excerpt:     excerpt,
    }
  } catch {
    return {
      brand_mentioned: false,
      mention_position: null,
      tone: null,
      competitors_mentioned: [],
      response_excerpt: excerpt,
    }
  }
}

function computeScore(checks: CheckResult[]): { total: number; byPlatform: Record<string, number> } {
  const posWeight = { early: 1.0, mid: 0.7, late: 0.4 }
  const toneMultiplier = { positive: 1.1, neutral: 1.0, negative: 0.9 }

  const platforms = [...new Set(checks.map(c => c.platform))]
  const byPlatform: Record<string, number> = {}

  for (const platform of platforms) {
    const pChecks = checks.filter(c => c.platform === platform)
    if (!pChecks.length) { byPlatform[platform] = 0; continue }
    let score = 0
    for (const c of pChecks) {
      if (!c.brand_mentioned) continue
      const pw = posWeight[c.mention_position ?? 'mid'] ?? 0.7
      const tm = toneMultiplier[c.tone ?? 'neutral'] ?? 1.0
      score += pw * tm
    }
    byPlatform[platform] = Math.round((score / pChecks.length) * 100)
  }

  const totalScore = checks.length === 0 ? 0 : Math.round(
    Object.values(byPlatform).reduce((a, b) => a + b, 0) / Math.max(platforms.length, 1)
  )

  return { total: totalScore, byPlatform }
}

async function runVisibilityCheck(brandId: string) {
  const service = await createServiceClient()

  const { data: brand } = await service
    .from('brands')
    .select('id, name, category, cultural_profile')
    .eq('id', brandId)
    .single()

  if (!brand) return { error: 'Brand not found' }

  const weekOf = mondayOf(new Date())
  const PLATFORMS: Array<'chatgpt' | 'gemini' | 'perplexity'> = ['chatgpt', 'gemini', 'perplexity']

  const questions = await generateQuestions(brand as Brand)
  const checks: CheckResult[] = []
  const activePlatforms: string[] = []

  for (const platform of PLATFORMS) {
    let platformActive = false
    for (const question of questions) {
      const response = await queryPlatform(platform, question)
      if (response === null) continue
      platformActive = true

      const analysis = await analyzeResponse(brand.name, question, response)
      checks.push({ platform, question, ...analysis })
    }
    if (platformActive && !activePlatforms.includes(platform)) activePlatforms.push(platform)
  }

  if (checks.length === 0) {
    return { error: 'No platforms configured. Add OPENAI_API_KEY, GOOGLE_AI_API_KEY, or PERPLEXITY_API_KEY.' }
  }

  // Collect top competitors
  const competitorCounts: Record<string, number> = {}
  for (const c of checks) {
    for (const comp of c.competitors_mentioned) {
      competitorCounts[comp] = (competitorCounts[comp] ?? 0) + 1
    }
  }
  const topCompetitors = Object.entries(competitorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name)

  const { total: visibilityScore, byPlatform } = computeScore(checks)

  // Generate AI recommendation
  const mentionRate = Math.round((checks.filter(c => c.brand_mentioned).length / checks.length) * 100)
  const recommendation = await callAi({
    tier: 'structural',
    system: 'Brand strategist. Give concise, actionable advice for improving AI platform visibility. 2-3 sentences max.',
    messages: [{
      role: 'user',
      content: `Brand: ${brand.name} (${brand.category ?? 'consumer brand'})
AI Visibility Score: ${visibilityScore}/100
Mention rate: ${mentionRate}% across ${checks.length} checks on ${activePlatforms.join(', ')}
Top competitors surfaced: ${topCompetitors.join(', ') || 'none'}

What is the single most important action this brand should take to improve its visibility in AI assistant responses? Focus on content, positioning, or digital footprint.`,
    }],
    maxTokens: 200,
    temperature: 0.3,
  })

  // Save check records
  await service.from('ai_visibility_checks').insert(
    checks.map(c => ({
      brand_id:             brandId,
      platform:             c.platform,
      question:             c.question,
      response_excerpt:     c.response_excerpt,
      brand_mentioned:      c.brand_mentioned,
      mention_position:     c.mention_position,
      tone:                 c.tone,
      competitors_mentioned: c.competitors_mentioned,
      week_of:              weekOf,
    }))
  )

  // Upsert score
  await service.from('ai_visibility_scores').upsert({
    brand_id:          brandId,
    week_of:           weekOf,
    visibility_score:  visibilityScore,
    chatgpt_score:     byPlatform['chatgpt'] ?? null,
    gemini_score:      byPlatform['gemini']  ?? null,
    perplexity_score:  byPlatform['perplexity'] ?? null,
    questions_asked:   questions.length,
    total_mentions:    checks.filter(c => c.brand_mentioned).length,
    platforms_active:  activePlatforms,
    top_competitors:   topCompetitors,
    ai_recommendation: recommendation.trim(),
  }, { onConflict: 'brand_id,week_of' })

  return { visibilityScore, totalChecks: checks.length, activePlatforms }
}

export const aiVisibilityWeeklyCron = inngest.createFunction(
  {
    id: 'ai-visibility-weekly-cron',
    name: 'AI Visibility Weekly Check',
    triggers: [{ cron: '0 9 * * 1' }],
  },
  async ({ step }: { step: any }) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const service = await createServiceClient()
    const { data: brands } = await service.from('brands').select('id')
    if (!brands?.length) return { processed: 0 }

    let processed = 0
    for (const brand of brands) {
      await step.run(`check-brand-${brand.id}`, () => runVisibilityCheck(brand.id))
      processed++
    }
    return { processed }
  }
)

export const aiVisibilityOnDemand = inngest.createFunction(
  {
    id: 'ai-visibility-on-demand',
    name: 'AI Visibility On-Demand Check',
    triggers: [{ event: 'ai-visibility/check' }],
    concurrency: { limit: 3 },
  },
  async ({ event, step }: { event: any; step: any }) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const { brandId } = event.data as { brandId: string }
    return step.run('run-check', () => runVisibilityCheck(brandId))
  }
)
