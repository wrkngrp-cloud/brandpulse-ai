import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LeadDesk, type Lead } from './lead-desk'

export const metadata = { title: 'Leads | BrandGauge' }
export const dynamic = 'force-dynamic'

/**
 * The lead desk.
 *
 * Everything the public scoreboard captures lands here: the address, the
 * brand they scanned, the rivals they named, and the share they were staring
 * at when they gave it to us. That last part is the follow-up. "I saw you
 * checked yourself against Moniepoint and PalmPay and came out at 8%" is a
 * different opening line from "just following up".
 *
 * Access is an explicit allowlist, not a workspace role. A lead belongs to
 * BrandGauge rather than to a tenant, so `is_lead_desk()` guards the rows in
 * the database and this page checks the same table before rendering. Both,
 * deliberately: the page check is the redirect, the policy is the guarantee.
 */
export default async function LeadsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: admin } = await supabase
    .from('lead_desk_admins').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!admin) redirect('/dashboard')

  // RLS returns nothing to anyone not on the allowlist, so this is the same
  // answer the policy would give, read through the signed-in user.
  const { data: leads } = await supabase
    .from('leads')
    .select('id, email, name, company, status, notes, wants_weekly, signed_up, contacted_at, created_at, scan_id, public_scans(brand_name, competitors, category, share_of_reach, mentions_found)')
    .order('created_at', { ascending: false })
    .limit(500)

  return <LeadDesk leads={(leads ?? []) as unknown as Lead[]} />
}
