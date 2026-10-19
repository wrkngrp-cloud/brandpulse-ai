import { createClient, createServiceClient } from '@/lib/supabase/server'
import { writeAudit } from './auth'
import type { StaffSession } from './auth'

/**
 * Impersonation, read-only and with the customer's consent.
 *
 * The session length is deliberately short and nothing extends it. Asking
 * again is cheap; a session that quietly stays open is the failure this
 * feature exists to avoid.
 */
export const SESSION_MINUTES = 30

export interface ImpersonationRow {
  id:         string
  staffId:    string
  staffName:  string
  workspaceId: string
  workspaceName: string
  reason:     string
  status:     'pending' | 'approved' | 'declined' | 'active' | 'ended' | 'expired'
  approvedAt: string | null
  expiresAt:  string | null
  endedAt:    string | null
  endedBy:    string | null
  pagesViewed: number
  createdAt:  string
}

/**
 * The workspace a signed-in user is currently looking inside, or null.
 *
 * Called on the customer host for every request, so it is one indexed query
 * answered by a security-definer function that also checks the clock. A
 * session past its expiry answers as over even if no sweep has run.
 */
export async function activeImpersonationFor(userId: string): Promise<string | null> {
  try {
    const supabase = await createClient()
    const { data } = await supabase.rpc('active_impersonation', { p_staff: userId })
    return (data as string | null) ?? null
  } catch {
    // If we cannot tell, assume nobody is impersonating. The alternative is
    // locking a real customer out of their own account on a transient error.
    return null
  }
}

export async function sessionsForWorkspace(
  session: StaffSession, workspaceId: string,
): Promise<ImpersonationRow[]> {
  const service = await createServiceClient()

  const { data: rows } = await service
    .from('impersonation_sessions')
    .select('id, staff_id, workspace_id, reason, status, approved_at, expires_at, ended_at, ended_by, pages_viewed, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (!rows?.length) return []

  const staffIds = [...new Set(rows.map(r => r.staff_id))]
  const [{ data: people }, { data: workspace }] = await Promise.all([
    service.from('staff').select('user_id, full_name').in('user_id', staffIds),
    service.from('workspaces').select('name').eq('id', workspaceId).maybeSingle(),
  ])
  const names = new Map((people ?? []).map(p => [p.user_id, p.full_name]))

  return rows.map(r => ({
    id:        r.id,
    staffId:   r.staff_id,
    staffName: names.get(r.staff_id) ?? 'Someone no longer on the Desk',
    workspaceId: r.workspace_id,
    workspaceName: workspace?.name ?? 'this account',
    reason:    r.reason,
    status:    r.status as ImpersonationRow['status'],
    approvedAt: r.approved_at,
    expiresAt: r.expires_at,
    endedAt:   r.ended_at,
    endedBy:   r.ended_by,
    pagesViewed: r.pages_viewed,
    createdAt: r.created_at,
  }))
}

/** What the customer needs to answer, and the history they are entitled to see. */
export async function sessionsForCustomer(workspaceId: string): Promise<ImpersonationRow[]> {
  const service = await createServiceClient()
  const { data: rows } = await service
    .from('impersonation_sessions')
    .select('id, staff_id, workspace_id, reason, status, approved_at, expires_at, ended_at, ended_by, pages_viewed, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (!rows?.length) return []
  const staffIds = [...new Set(rows.map(r => r.staff_id))]
  const { data: people } = await service
    .from('staff').select('user_id, full_name').in('user_id', staffIds)
  const names = new Map((people ?? []).map(p => [p.user_id, p.full_name]))

  return rows.map(r => ({
    id: r.id, staffId: r.staff_id,
    staffName: names.get(r.staff_id) ?? 'A BrandGauge staff member',
    workspaceId: r.workspace_id, workspaceName: '',
    reason: r.reason, status: r.status as ImpersonationRow['status'],
    approvedAt: r.approved_at, expiresAt: r.expires_at,
    endedAt: r.ended_at, endedBy: r.ended_by,
    pagesViewed: r.pages_viewed, createdAt: r.created_at,
  }))
}

/**
 * The banner's facts, for whoever is looking at a page.
 *
 * Both sides see the same session, named the same way, for as long as it runs.
 * Nobody should be in any doubt about what is happening.
 */
export async function bannerFor(userId: string): Promise<{
  sessionId: string
  staffName: string
  workspaceName: string
  expiresAt: string
  viewerIsStaff: boolean
} | null> {
  const service = await createServiceClient()

  const { data: row } = await service
    .from('impersonation_sessions')
    .select('id, staff_id, workspace_id, expires_at, status')
    .or(`staff_id.eq.${userId}`)
    .in('status', ['approved', 'active'])
    .gt('expires_at', new Date().toISOString())
    .order('approved_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (row) {
    const [{ data: staff }, { data: workspace }] = await Promise.all([
      service.from('staff').select('full_name').eq('user_id', row.staff_id).maybeSingle(),
      service.from('workspaces').select('name').eq('id', row.workspace_id).maybeSingle(),
    ])
    return {
      sessionId: row.id,
      staffName: staff?.full_name ?? 'A BrandGauge staff member',
      workspaceName: workspace?.name ?? 'this account',
      expiresAt: row.expires_at as string,
      viewerIsStaff: true,
    }
  }

  // Not the staff member, so: is somebody inside a workspace this person
  // belongs to? The customer gets the same banner.
  const supabase = await createClient()
  const { data: memberships } = await supabase.from('brands').select('workspace_id').limit(50)
  const workspaceIds = [...new Set((memberships ?? []).map(b => b.workspace_id))]
  if (!workspaceIds.length) return null

  const { data: theirs } = await service
    .from('impersonation_sessions')
    .select('id, staff_id, workspace_id, expires_at')
    .in('workspace_id', workspaceIds)
    .in('status', ['approved', 'active'])
    .gt('expires_at', new Date().toISOString())
    .order('approved_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!theirs) return null

  const [{ data: staff }, { data: workspace }] = await Promise.all([
    service.from('staff').select('full_name').eq('user_id', theirs.staff_id).maybeSingle(),
    service.from('workspaces').select('name').eq('id', theirs.workspace_id).maybeSingle(),
  ])

  return {
    sessionId: theirs.id,
    staffName: staff?.full_name ?? 'A BrandGauge staff member',
    workspaceName: workspace?.name ?? 'your account',
    expiresAt: theirs.expires_at as string,
    viewerIsStaff: false,
  }
}

/** Every page view inside a session, counted, so the history has a number. */
export async function countPageView(sessionId: string): Promise<void> {
  try {
    const service = await createServiceClient()
    const { data: row } = await service
      .from('impersonation_sessions').select('pages_viewed').eq('id', sessionId).maybeSingle()
    if (!row) return
    await service.from('impersonation_sessions')
      .update({ pages_viewed: (row.pages_viewed ?? 0) + 1, status: 'active', started_at: new Date().toISOString() })
      .eq('id', sessionId).in('status', ['approved', 'active'])
  } catch {
    // A missed count is a worse log, not a worse guarantee.
  }
}

export async function endSession(
  sessionId: string, endedBy: 'staff' | 'customer' | 'expiry' | 'sweep', actorId?: string,
): Promise<void> {
  const service = await createServiceClient()
  await service.rpc('end_impersonation', { p_session: sessionId, p_ended_by: endedBy })

  if (actorId) {
    await writeAudit({
      actorId,
      action: 'impersonation.ended',
      targetType: 'impersonation', targetId: sessionId,
      summary: `Impersonation session ended by ${endedBy}`,
    })
  }
}
