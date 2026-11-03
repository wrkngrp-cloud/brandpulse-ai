import type { IndustryId } from './industry-config'

/**
 * What a brand came to BrandGauge to do, and the modules that do it.
 *
 * A new customer met 38 modules on day one and did not know where to start.
 * Onboarding now asks one question, "what do you want to do first?", and the
 * sidebar shows only the modules for the answers. The rest are hidden, never
 * locked: a direct link still opens, and Settings > Modules brings them all
 * back with one switch.
 *
 * Plain data, no React, so the layout, the nav, onboarding and settings all
 * read the same map. Paths are matched by prefix, so a goal that includes
 * /dashboard/surveys also includes /dashboard/surveys/nps.
 */

export const GOAL_IDS = ['brand_health', 'prove_campaigns', 'competitors', 'customers', 'report_up', 'creative'] as const
export type GoalId = typeof GOAL_IDS[number]

export interface GoalDef {
  id:     GoalId
  label:  string
  /** One line, in the marketer's words, of what they get. */
  line:   string
  paths:  string[]
}

export const GOALS: GoalDef[] = [
  {
    id: 'brand_health', label: 'See how my brand is doing',
    line: 'One brand health score, what people say about you, and where customers drop off.',
    paths: ['/dashboard/brand-equity', '/dashboard/sentiment', '/dashboard/funnel', '/dashboard/surveys', '/dashboard/pr'],
  },
  {
    id: 'prove_campaigns', label: 'Prove my campaigns worked',
    line: 'Track every campaign, online and offline, against what it was meant to do.',
    paths: [
      '/dashboard/campaigns', '/dashboard/digital', '/dashboard/influencers', '/dashboard/ooh',
      '/dashboard/offline-tracker', '/dashboard/campaign-audit', '/dashboard/events',
      '/dashboard/radio', '/dashboard/tv', '/dashboard/print', '/dashboard/budget',
      '/dashboard/mmm', '/dashboard/geo-lift',
    ],
  },
  {
    id: 'competitors', label: 'Keep an eye on competitors',
    line: 'What competitors launched, said and spent, and where you can win.',
    paths: ['/dashboard/competitive', '/dashboard/pr', '/dashboard/ai-visibility', '/dashboard/opportunities', '/dashboard/marketplace'],
  },
  {
    id: 'customers', label: 'Hear what customers say',
    line: 'Surveys, social conversation and field reports, in one place.',
    paths: ['/dashboard/sentiment', '/dashboard/surveys', '/dashboard/cultural', '/dashboard/field-intelligence', '/dashboard/advocacy', '/dashboard/retention',
      '/dashboard/loyalty', '/dashboard/cdp'],
  },
  {
    id: 'report_up', label: 'Report results to my boss',
    line: 'Board-ready reports and the business case for your budget.',
    paths: ['/dashboard/board-pack', '/dashboard/business-case', '/dashboard/brand-equity', '/dashboard/funnel', '/dashboard/methodology'],
  },
  {
    id: 'creative', label: 'Test my ads and content',
    line: 'Check creative before it runs, and spot it wearing out after.',
    paths: [
      '/dashboard/content', '/dashboard/voice-builder', '/dashboard/pre-post', '/dashboard/creative',
      '/dashboard/creative-library', '/dashboard/creative-fatigue', '/dashboard/experiments',
    ],
  },
]

/** Shown whatever the goals: home, connecting data, and settings. YouTube
 *  and WhatsApp are in no goal on purpose: both are "coming soon" in the
 *  nav, and a focused sidebar should not open on things that do not work. */
const ALWAYS = ['/dashboard', '/dashboard/connectors', '/dashboard/settings']

export interface ModuleFocus {
  goals:   GoalId[]
  showAll: boolean
}

export function isGoalId(v: unknown): v is GoalId {
  return typeof v === 'string' && (GOAL_IDS as readonly string[]).includes(v)
}

/** Read the two brand columns into a focus. Null, unknown values, or no goals
 *  all mean the full sidebar: hiding modules has to be something a brand
 *  chose, never something a bad row does to it. */
export function focusFrom(row: { focus_goals?: unknown; show_all_modules?: unknown } | null | undefined): ModuleFocus | null {
  if (!row) return null
  const goals = Array.isArray(row.focus_goals) ? row.focus_goals.filter(isGoalId) : []
  const showAll = row.show_all_modules !== false
  if (showAll || goals.length === 0) return null
  return { goals, showAll: false }
}

function under(path: string, base: string): boolean {
  return path === base || path.startsWith(base + '/')
}

/** Whether a nav path shows for this focus. No focus means everything. */
export function isPathInFocus(path: string, focus: ModuleFocus | null): boolean {
  if (!focus) return true
  if (ALWAYS.some(a => a === path || (a !== '/dashboard' && under(path, a)))) return true
  return GOALS.some(g => focus.goals.includes(g.id) && g.paths.some(p => under(path, p)))
}

/** A sensible first pick for each kind of brand, preselected in onboarding.
 *  The marketer changes it in one tap; it only decides where the cursor
 *  starts. Every brand is asked; no vertical is assumed to be FMCG. */
export const SUGGESTED_GOALS: Record<IndustryId, GoalId[]> = {
  fmcg:        ['brand_health', 'prove_campaigns'],
  fintech:     ['brand_health', 'competitors'],
  telco:       ['brand_health', 'competitors'],
  qsr:         ['prove_campaigns', 'customers'],
  ecommerce:   ['prove_campaigns', 'competitors'],
  b2b_saas:    ['competitors', 'report_up'],
  media:       ['brand_health', 'creative'],
  healthcare:  ['brand_health', 'customers'],
  real_estate: ['prove_campaigns', 'report_up'],
  insurance:   ['brand_health', 'customers'],
  fashion:     ['prove_campaigns', 'creative'],
  agency:      ['prove_campaigns', 'report_up'],
  other:       ['brand_health'],
}

export function suggestedGoals(industry: string | null | undefined): GoalId[] {
  return SUGGESTED_GOALS[(industry ?? '') as IndustryId] ?? ['brand_health']
}
