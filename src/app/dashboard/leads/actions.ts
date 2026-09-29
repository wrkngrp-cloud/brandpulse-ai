'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * Work the pipeline.
 *
 * Deliberately the RLS client, not the service role. `leads_update` only
 * passes for a user on the lead-desk allowlist, so the database is the gate
 * and this action cannot be turned into one by a caller who finds it.
 */
export async function updateLead(id: string, changes: { status?: string; notes?: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }

  const patch: Record<string, unknown> = {}
  if (changes.status) {
    patch.status = changes.status
    // The first move off "new" is when someone was actually reached.
    if (changes.status === 'contacted') patch.contacted_at = new Date().toISOString()
  }
  if (changes.notes !== undefined) patch.notes = changes.notes

  const { error } = await supabase.from('leads').update(patch).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/leads')
  return { ok: true }
}
