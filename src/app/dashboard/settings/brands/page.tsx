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

  return (
    <BrandsClient
      brands={brands}
      activeBrandId={workspace?.active_brand_id ?? null}
      plan="beta"
      brandLimit={-1}
      isDemoUser={user?.email === 'demo@jarafoods.brandpulse.ai'}
    />
  )
}
