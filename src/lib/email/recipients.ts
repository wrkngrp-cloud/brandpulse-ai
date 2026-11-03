import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Who a brand's email goes to: the people in that brand's own workspace.
 *
 * Two jobs used to look for a user whose profile carried the brand's id,
 * which nothing ever writes, and then fell back to the first user in the
 * whole system. So every brand's weekly competitive briefing and every
 * campaign alert went to one BrandGauge inbox and never to the brand. The
 * report jobs did resolve the workspace, then matched it against
 * `listUsers()`, which returns one page of 50, so past 50 users some owners
 * silently stopped getting reports.
 *
 * This reads the members of the brand's workspace and looks each one up by
 * id. Staff on a read-only consented session sit in workspace_members as
 * `viewer`, so viewers are never emailed.
 */
export type RecipientRole = 'owner' | 'admin' | 'member' | 'analyst' | 'field'

export async function brandRecipients(
  svc: SupabaseClient,
  brandId: string,
  roles: RecipientRole[] = ['owner', 'admin'],
): Promise<string[]> {
  const { data: brand } = await svc.from('brands').select('workspace_id').eq('id', brandId).maybeSingle()
  if (!brand?.workspace_id) return []
  return workspaceRecipients(svc, brand.workspace_id as string, roles)
}

export async function workspaceRecipients(
  svc: SupabaseClient,
  workspaceId: string,
  roles: RecipientRole[] = ['owner', 'admin'],
): Promise<string[]> {
  const { data: members } = await svc
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .in('role', roles)
  const emails = await Promise.all((members ?? []).map(async m => {
    const { data } = await svc.auth.admin.getUserById(m.user_id as string)
    return data.user?.email ?? null
  }))
  return [...new Set(emails.filter((e): e is string => !!e))]
}
