'use server'
import { createClient } from '@/lib/supabase/server'

// Every shared demo account logs in as the same auth user_id no matter who's
// actually at the keyboard, so user_tours (keyed by user_id) can only ever
// remember "seen" for the first person who tried it — everyone after that
// silently never sees the tour. Demo accounts all follow the same seed
// pattern: demo@{brand}.brandpulse.ai.
function isDemoEmail(email: string | null | undefined): boolean {
  return !!email && email.startsWith('demo@') && email.endsWith('.brandpulse.ai')
}

export async function markTourStatus(module: string, status: 'completed' | 'skipped') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('user_tours').upsert(
    { user_id: user.id, module, status, seen_at: new Date().toISOString(), version: 1 },
    { onConflict: 'user_id,module' }
  )
}

export async function getTourStatuses(
  modules: string[],
): Promise<{ statuses: Record<string, string>; isDemo: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { statuses: {}, isDemo: false }

  const isDemo = isDemoEmail(user.email)

  // For demo accounts, skip the shared DB row entirely — TourTrigger decides
  // "seen" per browser via localStorage instead, so a new person on a new
  // device/browser always gets a fresh tour regardless of who used the same
  // demo login before them.
  if (isDemo) return { statuses: {}, isDemo: true }

  const { data } = await supabase
    .from('user_tours')
    .select('module, status')
    .eq('user_id', user.id)
    .in('module', modules)
  return { statuses: Object.fromEntries((data ?? []).map(r => [r.module, r.status])), isDemo: false }
}
