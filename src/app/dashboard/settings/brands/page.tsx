import { createClient } from '@/lib/supabase/server'
import { BrandsClient } from './brands-client'

export default async function BrandsSettingsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: brands },
    { data: workspace },
  ] = await Promise.all([
    supabase.from('brands').select('id, name, category, logo_url, created_at').order('created_at', { ascending: true }),
    supabase.from('workspaces').select('plan, active_brand_id, type').limit(1).maybeSingle(),
  ])

  const { data: planRow } = await supabase
    .from('plan_limits')
    .select('brand_count')
    .eq('plan', workspace?.plan ?? 'starter')
    .maybeSingle()

  return (
    <BrandsClient
      brands={brands ?? []}
      activeBrandId={workspace?.active_brand_id ?? null}
      plan={workspace?.plan ?? 'starter'}
      brandLimit={planRow?.brand_count ?? 1}
      isDemoUser={user?.email === 'demo@jarafoods.brandpulse.ai'}
    />
  )
}
