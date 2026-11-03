import { createClient } from '@/lib/supabase/server'
import { getActiveBrand } from '@/lib/active-brand'
import { isGoalId, type GoalId } from '@/lib/goals'
import { ModulesForm } from './modules-form'

export const dynamic = 'force-dynamic'

type FocusRow = { name: string | null; focus_goals: unknown; show_all_modules: boolean | null }

export default async function ModulesSettingsPage() {
  const supabase = await createClient()
  const brand = await getActiveBrand<FocusRow>(supabase, 'name, focus_goals, show_all_modules')

  // Null here means the focus columns are not on this database yet, or there
  // is no brand. Either way the sidebar is showing everything.
  const ready = brand !== null
  const goals: GoalId[] = Array.isArray(brand?.focus_goals) ? brand.focus_goals.filter(isGoalId) : []
  const showAll = brand?.show_all_modules !== false

  return (
    <ModulesForm
      brandName={brand?.name ?? 'your brand'}
      initialGoals={goals}
      initialShowAll={showAll}
      ready={ready}
    />
  )
}
