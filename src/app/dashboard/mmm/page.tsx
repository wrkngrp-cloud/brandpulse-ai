import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MmmClient } from './mmm-client'

export default async function MmmPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: brand } = await supabase.from('brands').select('id, name, category').limit(1).single()
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
