import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createHash } from 'node:crypto'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Permission } from './permissions'

/**
 * The Desk's one gate.
 *
 * Every Desk page and every Desk action starts here. It resolves the session,
 * confirms an active staff row, loads the caller's resolved permission set,
 * and hands back a record the screen can ask questions of. A screen that
 * forgets to call it renders nothing, because there is no other way to get a
 * staff record.
 *
 * The permission set comes from `staff_permissions()`, a security-definer
 * function, which is why role_permissions itself stays readable only to a
 * super admin: a person learns what they hold without being able to read what
 * everyone else holds.
 */

export interface StaffSession {
  userId:      string
  email:       string
  fullName:    string
  jobTitle:    string | null
  avatarUrl:   string | null
  role:        string
  isSuperAdmin: boolean
  permissions: Set<Permission>
  can:  (perm: Permission) => boolean
  /** Dataset gate. Reads better at a call site than `can('data.x')`. */
  sees: (dataset: Permission) => boolean
}

function buildSession(row: {
  user_id: string; email: string; full_name: string; job_title: string | null
  avatar_url: string | null; role: string
}, permissions: string[]): StaffSession {
  const set = new Set(permissions)
  const isSuperAdmin = row.role === 'super_admin'
  // A super admin holds every key, including one added to the product after
  // their row was written. staff_can() makes the same allowance in SQL.
  const can = (perm: Permission) => isSuperAdmin || set.has(perm)
  return {
    userId:    row.user_id,
    email:     row.email,
    fullName:  row.full_name,
    jobTitle:  row.job_title,
    avatarUrl: row.avatar_url,
    role:      row.role,
    isSuperAdmin,
    permissions: set,
    can,
    sees: can,
  }
}

/**
 * The staff record for the current request, or null.
 *
 * Use this where a null answer is the point (the login page, the layout
 * deciding what to render). Everywhere else use requireStaff.
 */
export async function getStaffSession(): Promise<StaffSession | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: staff } = await supabase
    .from('staff')
    .select('user_id, email, full_name, job_title, avatar_url, role, status')
    .eq('user_id', user.id)
    .maybeSingle()

  // A suspended row is not an account with a warning on it. It is no access.
  if (!staff || staff.status !== 'active') return null

  const { data: perms } = await supabase.rpc('staff_permissions')
  const list = Array.isArray(perms)
    ? (perms as unknown[]).map(p => (typeof p === 'string' ? p : String((p as { permission?: string })?.permission ?? '')))
    : []

  return buildSession(staff, list.filter(Boolean))
}

/**
 * The staff record, or a redirect.
 *
 * Pass a permission and it is checked here, so a screen cannot render a
 * module its viewer does not hold. The audit row is written for the reads as
 * well as the writes: a tool that bypasses RLS by design has to be able to
 * answer who looked at what.
 */
export async function requireStaff(
  perm?: Permission,
  audit?: { action: string; targetType?: string; targetId?: string; workspaceId?: string; summary?: string },
): Promise<StaffSession> {
  const session = await getStaffSession()
  if (!session) redirect('/desk/login')
  if (perm && !session.can(perm)) redirect('/desk?denied=' + encodeURIComponent(perm))

  if (audit) {
    await writeAudit({
      actorId:     session.userId,
      action:      audit.action,
      targetType:  audit.targetType,
      targetId:    audit.targetId,
      workspaceId: audit.workspaceId,
      summary:     audit.summary,
    })
  }

  await touchLastSeen(session.userId)
  return session
}

/** Same check, without the redirect, for a server action that returns an error. */
export async function requireStaffOrNull(perm?: Permission): Promise<StaffSession | null> {
  const session = await getStaffSession()
  if (!session) return null
  if (perm && !session.can(perm)) return null
  return session
}

export async function writeAudit(entry: {
  actorId:      string
  action:       string
  targetType?:  string | null
  targetId?:    string | null
  workspaceId?: string | null
  summary?:     string | null
  meta?:        Record<string, unknown>
}): Promise<void> {
  try {
    const service = await createServiceClient()
    await service.from('staff_audit_log').insert({
      actor_id:     entry.actorId,
      action:       entry.action,
      target_type:  entry.targetType ?? null,
      target_id:    entry.targetId ?? null,
      workspace_id: entry.workspaceId ?? null,
      summary:      entry.summary ?? null,
      meta:         entry.meta ?? {},
      ip_hash:      await requestIpHash(),
    })
  } catch {
    // A lost audit row must not take the page down with it. The gap is
    // visible in the feed, which is the honest failure mode.
  }
}

/**
 * A coarse fingerprint of where a request came from.
 *
 * Hashed, never stored raw, matching how public_scans and whatsapp_send_log
 * treat the same question. Enough to tell two sessions apart, not enough to
 * be a location record.
 */
export async function requestIpHash(): Promise<string | null> {
  try {
    const h = await headers()
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')
    if (!ip) return null
    return createHash('sha256').update(ip).digest('hex').slice(0, 32)
  } catch {
    return null
  }
}

/**
 * Presence, which the chat widget reads to decide whether to promise a live
 * reply. Throttled to five minutes so a busy session is one write, not one per
 * page.
 */
async function touchLastSeen(userId: string): Promise<void> {
  try {
    const service = await createServiceClient()
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    await service
      .from('staff')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('user_id', userId)
      .or(`last_seen_at.is.null,last_seen_at.lt.${cutoff}`)
  } catch {
    // Presence is a nicety. Never a reason to fail a page.
  }
}
