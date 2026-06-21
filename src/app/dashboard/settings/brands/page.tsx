import { createClient } from '@/lib/supabase/server'
import { BrandsClient } from './brands-client'

export const dynamic = 'force-dynamic'

export default async function BrandsSettingsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [brandsResult, workspaceResult] = await Promise.allSettled([
    supabase.from('brands').select('id, name, category, logo_url, created_at').order('created_at', { ascending: true }),
    supabase.from('workspaces').select('plan, active_brand_id').limit(1).maybeSingle(),
  ])

  const brands = brandsResult.status === 'fulfilled' ? (brandsResult.value.data ?? []) : []
  const workspace = workspaceResult.status === 'fulfilled' ? workspaceResult.value.data : null

  let brandLimit = 1
  try {
    const { data: planRow } = await supabase
      .from('plan_limits')
      .select('brand_count')
      .eq('plan', workspace?.plan ?? 'starter')
      .maybeSingle()
    if (planRow?.brand_count != null) brandLimit = planRow.brand_count
  } catch {
    // plan_limits table not available — fall back to default
  }

  return (
    <BrandsClient
      brands={brands}
      activeBrandId={workspace?.active_brand_id ?? null}
      plan={workspace?.plan ?? 'starter'}
      brandLimit={brandLimit}
      isDemoUser={user?.email === 'demo@jarafoods.brandpulse.ai'}
    />
  )
}
