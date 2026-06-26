import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getActiveBrand } from '@/lib/active-brand'
import { MmmClient } from './mmm-client'

export default async function MmmPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const brand = await getActiveBrand<{ id: string; name: string; category: string | null }>(supabase, 'id, name, category')
  const { data: lastRun } = await supabase
    .from('mmm_runs')
    .select('*')
    .eq('brand_id', brand?.id ?? '')
    .order('ran_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <MmmClient
      brandName={brand?.name ?? 'Your brand'}
      lastRun={lastRun ?? null}
    />
  )
}
