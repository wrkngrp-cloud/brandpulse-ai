import { createClient } from '@/lib/supabase/server'
import { BillingClient } from './billing-client'
import { PLAN_DISPLAY } from '@/lib/stripe'

export default async function BillingPage() {
  const supabase = await createClient()

  const [{ data: workspace }, { data: usageThisMonth }] = await Promise.all([
    supabase.from('workspaces').select('plan, subscription_status, trial_ends_at, current_period_end').limit(1).maybeSingle(),
    supabase.from('usage_events')
      .select('event_type', { count: 'exact', head: false })
      .gte('occurred_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
  ])

  const { data: planRow } = await supabase
    .from('plan_limits')
    .select('*')
    .eq('plan', workspace?.plan ?? 'starter')
    .maybeSingle()

  const { count: brandCount } = await supabase.from('brands').select('id', { count: 'exact', head: true })
  const { count: portalCount } = await supabase.from('portal_tokens').select('id', { count: 'exact', head: true })

  const aiCallsThisMonth   = (usageThisMonth ?? []).filter(u => u.event_type === 'ai_call').length
  const surveyRespThisMonth = (usageThisMonth ?? []).filter(u => u.event_type === 'survey_response').length

  return (
    <BillingClient
      currentPlan={workspace?.plan ?? 'starter'}
      subscriptionStatus={workspace?.subscription_status ?? 'trialing'}
      trialEndsAt={workspace?.trial_ends_at ?? null}
      currentPeriodEnd={workspace?.current_period_end ?? null}
      planLimits={planRow ?? { brand_count: 1, user_count: 3, survey_mo: 500, ai_calls_mo: 100, portal_links: 0, white_label: false, price_ngn_mo: 0 }}
      usage={{ brands: brandCount ?? 0, portalLinks: portalCount ?? 0, aiCalls: aiCallsThisMonth, surveyResponses: surveyRespThisMonth }}
      planDisplay={PLAN_DISPLAY}
    />
  )
}
