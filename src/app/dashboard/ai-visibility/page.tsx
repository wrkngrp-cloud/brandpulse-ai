import { createClient } from '@/lib/supabase/server'
import { getActiveBrand } from '@/lib/active-brand'
import { AiVisibilityClient } from './ai-visibility-client'

export interface VisibilityScore {
  id: string
  week_of: string
  visibility_score: number
  chatgpt_score: number | null
  gemini_score: number | null
  perplexity_score: number | null
  questions_asked: number
  total_mentions: number
  platforms_active: string[]
  top_competitors: string[]
  ai_recommendation: string | null
}

export interface VisibilityCheck {
  platform: string
  question: string
  brand_mentioned: boolean
  mention_position: string | null
  tone: string | null
  competitors_mentioned: string[]
  checked_at: string
}

export default async function AiVisibilityPage() {
  const supabase = await createClient()

  const brand = await getActiveBrand<{ id: string; name: string; category: string | null }>(
    supabase,
    'id, name, category'
  )

  if (!brand) {
    return (
      <div className="border rounded-xl p-8 bg-card text-sm text-muted-foreground">
        No brand found. Complete onboarding first.
      </div>
    )
  }

  const [{ data: scores }, { data: checks }] = await Promise.all([
    supabase
      .from('ai_visibility_scores')
      .select('*')
      .eq('brand_id', brand.id)
      .order('week_of', { ascending: false })
      .limit(12),
    supabase
      .from('ai_visibility_checks')
      .select('platform, question, brand_mentioned, mention_position, tone, competitors_mentioned, checked_at')
      .eq('brand_id', brand.id)
      .order('checked_at', { ascending: false })
      .limit(50),
  ])

  const hasKeys =
    !!(process.env.OPENAI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.PERPLEXITY_API_KEY)

  return (
    <AiVisibilityClient
      brandName={brand.name}
      brandCategory={brand.category}
      scores={(scores ?? []) as VisibilityScore[]}
      checks={(checks ?? []) as VisibilityCheck[]}
      hasApiKeys={hasKeys}
    />
  )
}
