'use server'
import { createClient } from '@/lib/supabase/server'

export async function markTourStatus(module: string, status: 'completed' | 'skipped') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('user_tours').upsert(
    { user_id: user.id, module, status, seen_at: new Date().toISOString(), version: 1 },
    { onConflict: 'user_id,module' }
  )
}

export async function getTourStatuses(modules: string[]): Promise<Record<string, string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}
  const { data } = await supabase
    .from('user_tours')
    .select('module, status')
    .eq('user_id', user.id)
    .in('module', modules)
  return Object.fromEntries((data ?? []).map(r => [r.module, r.status]))
}
