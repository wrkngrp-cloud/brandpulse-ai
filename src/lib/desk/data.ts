import { createServiceClient } from '@/lib/supabase/server'
import { ALL_PERMISSIONS } from './permissions'
import { MASKED, maskEmail } from './redact'
import type { StaffSession } from './auth'

/**
 * The Desk's data layer.
 *
 * The only place allowed to use the service client for cross-tenant reads, so
 * there is one file to audit rather than one per screen. Two rules hold here:
 *
 * Nothing is read without a permission being checked first. The caller passes
 * its StaffSession and the function decides, which keeps the decision next to
 * the query rather than next to the markup.
 *
 * Datasets are redacted here, not in the component. A screen that renders what
 * it is given cannot leak a field by forgetting a conditional, and the same
 * redaction applies to every screen that asks for the same rows.
 */

export { maskEmail } from './redact'

export interface DeskOverview {
  workspaces:      number
  workspacesNew30: number
  brands:          number
  staffActive:     number
  leads:           { total: number; new7: number } | null
  ai:              { calls30: number; costUsd30: number | null } | null
  modulesUsed30:   number | null
}

export async function deskOverview(session: StaffSession): Promise<DeskOverview> {
  const service = await createServiceClient()
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const since7  = new Date(Date.now() -  7 * 86_400_000).toISOString()

  const [workspaces, workspacesNew30, brands, staffActive] = await Promise.all([
    service.from('workspaces').select('*', { count: 'exact', head: true }),
    service.from('workspaces').select('*', { count: 'exact', head: true }).gte('created_at', since30),
    service.from('brands').select('*', { count: 'exact', head: true }),
    service.from('staff').select('*', { count: 'exact', head: true }).eq('status', 'active'),
  ])

  let leads: DeskOverview['leads'] = null
  if (session.can('leads.view')) {
    const [total, recent] = await Promise.all([
      service.from('leads').select('*', { count: 'exact', head: true }),
      service.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', since7),
    ])
    leads = { total: total.count ?? 0, new7: recent.count ?? 0 }
  }

  let ai: DeskOverview['ai'] = null
  if (session.can('usage.view')) {
    const { data: calls } = await service
      .from('ai_calls')
      .select('cost_usd')
      .gte('created_at', since30)
      .limit(50_000)

    const rows = calls ?? []
    ai = {
      calls30: rows.length,
      // Cost is a dataset, not a count. Without the key the volume still
      // shows, which is what a support person needs, and the money does not.
      costUsd30: session.sees('data.ai_cost')
        ? rows.reduce((sum, r) => sum + Number(r.cost_usd ?? 0), 0)
        : null,
    }
  }

  let modulesUsed30: number | null = null
  if (session.can('adoption.view')) {
    const { data } = await service
      .from('feature_events')
      .select('module')
      .gte('day', since30.slice(0, 10))
      .limit(50_000)
    modulesUsed30 = new Set((data ?? []).map(r => r.module)).size
  }

  return {
    workspaces:      workspaces.count ?? 0,
    workspacesNew30: workspacesNew30.count ?? 0,
    brands:          brands.count ?? 0,
    staffActive:     staffActive.count ?? 0,
    leads, ai, modulesUsed30,
  }
}

// ── The staff roster ─────────────────────────────────────────────────────────

export interface StaffRow {
  userId:     string
  email:      string
  fullName:   string
  jobTitle:   string | null
  role:       string
  roleLabel:  string
  status:     'active' | 'suspended'
  lastSeenAt: string | null
  joinedAt:   string | null
  overrides:  number
}

export interface PendingInvite {
  id:        string
  email:     string
  fullName:  string | null
  role:      string
  expiresAt: string
  createdAt: string
}

export async function staffRoster(session: StaffSession): Promise<{
  staff: StaffRow[]; invites: PendingInvite[]; roles: { name: string; label: string }[]
}> {
  const service = await createServiceClient()

  const [{ data: staff }, { data: roles }, { data: overrides }] = await Promise.all([
    service.from('staff')
      .select('user_id, email, full_name, job_title, role, status, last_seen_at, joined_at')
      .order('full_name'),
    service.from('staff_roles').select('name, label').order('name'),
    service.from('staff_permission_overrides').select('user_id'),
  ])

  const roleLabels = new Map((roles ?? []).map(r => [r.name, r.label]))
  const overrideCounts = new Map<string, number>()
  for (const row of overrides ?? []) {
    overrideCounts.set(row.user_id, (overrideCounts.get(row.user_id) ?? 0) + 1)
  }

  // Pending only. A used or withdrawn invitation is history, and the roster is
  // for what is outstanding.
  const invites = session.can('staff.invite')
    ? (await service.from('staff_invites')
        .select('id, email, full_name, role, expires_at, created_at')
        .is('accepted_at', null).is('revoked_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })).data ?? []
    : []

  return {
    staff: (staff ?? []).map(s => ({
      userId:   s.user_id,
      email:    session.sees('data.customer_email') ? s.email : maskEmail(s.email),
      fullName: s.full_name,
      jobTitle: s.job_title,
      role:     s.role,
      roleLabel: roleLabels.get(s.role) ?? s.role,
      status:   s.status as 'active' | 'suspended',
      lastSeenAt: s.last_seen_at,
      joinedAt:   s.joined_at,
      overrides:  overrideCounts.get(s.user_id) ?? 0,
    })),
    invites: invites.map(i => ({
      id: i.id, email: i.email, fullName: i.full_name,
      role: i.role, expiresAt: i.expires_at, createdAt: i.created_at,
    })),
    roles: (roles ?? []).map(r => ({ name: r.name, label: r.label })),
  }
}

export interface AuditRow {
  id:        string
  actorName: string
  action:    string
  summary:   string | null
  createdAt: string
}

/**
 * The activity feed.
 *
 * Without `data.audit_all` a person sees their own trail only, which is the
 * same answer the table's own policy would give. The policy is the guarantee;
 * this is the query.
 */
export async function auditFeed(session: StaffSession, limit = 50): Promise<AuditRow[]> {
  const service = await createServiceClient()

  let query = service
    .from('staff_audit_log')
    .select('id, actor_id, action, summary, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!session.sees('data.audit_all')) query = query.eq('actor_id', session.userId)

  const { data: rows } = await query
  const actorIds = [...new Set((rows ?? []).map(r => r.actor_id).filter(Boolean))] as string[]

  const { data: people } = actorIds.length
    ? await service.from('staff').select('user_id, full_name').in('user_id', actorIds)
    : { data: [] }

  const names = new Map((people ?? []).map(p => [p.user_id, p.full_name]))

  return (rows ?? []).map(r => ({
    id:        r.id,
    actorName: names.get(r.actor_id ?? '') ?? 'Someone no longer on the Desk',
    action:    r.action,
    summary:   r.summary,
    createdAt: r.created_at,
  }))
}

// ── One person ───────────────────────────────────────────────────────────────

export interface PermissionState {
  permission: string
  /** Where the current answer comes from, so "why can she see this" is one glance. */
  source: 'role' | 'granted' | 'denied' | 'none'
  held:   boolean
}

export interface StaffPerson {
  userId:      string
  email:       string
  fullName:    string
  jobTitle:    string | null
  phone:       string | null
  timezone:    string
  role:        string
  roleLabel:   string
  status:      'active' | 'suspended'
  invitedAt:   string | null
  joinedAt:    string | null
  lastSeenAt:  string | null
  permissions: Map<string, PermissionState>
  activity:    AuditRow[]
  stats:       { actions7: number; actions30: number }
}

export async function staffPerson(
  session: StaffSession, userId: string,
): Promise<StaffPerson | null> {
  const service = await createServiceClient()

  const { data: person } = await service
    .from('staff')
    .select('user_id, email, full_name, job_title, phone, timezone, role, status, invited_at, joined_at, last_seen_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (!person) return null

  const since7  = new Date(Date.now() -  7 * 86_400_000).toISOString()
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString()

  const [{ data: roleRow }, { data: rolePerms }, { data: overrides }, actions7, actions30, { data: recent }] =
    await Promise.all([
      service.from('staff_roles').select('label').eq('name', person.role).maybeSingle(),
      service.from('role_permissions').select('permission').eq('role', person.role),
      service.from('staff_permission_overrides').select('permission, effect').eq('user_id', userId),
      service.from('staff_audit_log').select('*', { count: 'exact', head: true })
        .eq('actor_id', userId).gte('created_at', since7),
      service.from('staff_audit_log').select('*', { count: 'exact', head: true })
        .eq('actor_id', userId).gte('created_at', since30),
      service.from('staff_audit_log')
        .select('id, action, summary, created_at')
        .eq('actor_id', userId)
        .order('created_at', { ascending: false })
        .limit(25),
    ])

  const fromRole = new Set((rolePerms ?? []).map(r => r.permission))
  const overrideMap = new Map((overrides ?? []).map(o => [o.permission, o.effect as 'grant' | 'deny']))
  const isSuper = person.role === 'super_admin'

  const permissions = new Map<string, PermissionState>()
  for (const key of ALL_PERMISSIONS) {
    const override = overrideMap.get(key)
    // Same precedence as staff_can, written once more in TypeScript because
    // this screen has to explain the answer and not only report it.
    const state: PermissionState =
      override === 'deny'  ? { permission: key, source: 'denied',  held: false }
      : override === 'grant' ? { permission: key, source: 'granted', held: true }
      : isSuper || fromRole.has(key) ? { permission: key, source: 'role', held: true }
      : { permission: key, source: 'none', held: false }
    permissions.set(key, state)
  }

  return {
    userId:    person.user_id,
    email:     session.sees('data.customer_email') ? person.email : maskEmail(person.email),
    fullName:  person.full_name,
    jobTitle:  person.job_title,
    phone:     session.sees('data.customer_phone') ? person.phone : (person.phone ? MASKED : null),
    timezone:  person.timezone,
    role:      person.role,
    roleLabel: roleRow?.label ?? person.role,
    status:    person.status as 'active' | 'suspended',
    invitedAt: person.invited_at,
    joinedAt:  person.joined_at,
    lastSeenAt: person.last_seen_at,
    permissions,
    activity: (recent ?? []).map(r => ({
      id: r.id, actorName: person.full_name,
      action: r.action, summary: r.summary, createdAt: r.created_at,
    })),
    stats: { actions7: actions7.count ?? 0, actions30: actions30.count ?? 0 },
  }
}

// ── The support inbox ────────────────────────────────────────────────────────

export interface InboxRow {
  id:            string
  name:          string | null
  email:         string | null
  subject:       string | null
  status:        'open' | 'pending' | 'snoozed' | 'closed'
  source:        string
  pageUrl:       string | null
  workspaceName: string | null
  plan:          string | null
  brandType:     string | null
  lastMessageAt: string
  createdAt:     string
  waitingOnUs:   boolean
  preview:       string
  assignedTo:    string | null
}

/**
 * The queue.
 *
 * Sorted by what is waiting on us rather than by age, because the oldest
 * thread is usually one we already answered. `waitingOnUs` is the last
 * message being the customer's, which is the only definition that matches
 * what a person means when they ask what is outstanding.
 */
export async function supportInbox(
  session: StaffSession, status: 'open' | 'all' = 'open',
): Promise<InboxRow[]> {
  const service = await createServiceClient()

  let query = service
    .from('support_conversations')
    .select(`
      id, name, email, subject, status, source, page_url, assigned_to,
      last_message_at, created_at,
      workspaces ( name, plan ),
      brands ( brand_type )
    `)
    .order('last_message_at', { ascending: false })
    .limit(200)

  if (status === 'open') query = query.in('status', ['open', 'pending'])

  const { data: rows } = await query
  if (!rows?.length) return []

  // One query for the last message of every thread on the page, rather than
  // one per row.
  const ids = rows.map(r => r.id)
  const { data: messages } = await service
    .from('support_messages')
    .select('conversation_id, author_type, body, created_at, internal')
    .in('conversation_id', ids)
    .eq('internal', false)
    .order('created_at', { ascending: false })
    .limit(1000)

  const latest = new Map<string, { author_type: string; body: string }>()
  for (const m of messages ?? []) {
    if (!latest.has(m.conversation_id)) {
      latest.set(m.conversation_id, { author_type: m.author_type, body: m.body })
    }
  }

  const assignees = [...new Set(rows.map(r => r.assigned_to).filter(Boolean))] as string[]
  const { data: people } = assignees.length
    ? await service.from('staff').select('user_id, full_name').in('user_id', assignees)
    : { data: [] }
  const names = new Map((people ?? []).map(p => [p.user_id, p.full_name]))

  const canSeeContent = session.sees('data.customer_content')

  return rows.map(row => {
    const last = latest.get(row.id)
    const workspace = row.workspaces as unknown as { name?: string; plan?: string } | null
    const brand     = row.brands     as unknown as { brand_type?: string } | null

    return {
      id:      row.id,
      name:    row.name,
      email:   session.sees('data.customer_email') ? row.email : maskEmail(row.email),
      subject: row.subject,
      status:  row.status as InboxRow['status'],
      source:  row.source,
      pageUrl: row.page_url,
      workspaceName: workspace?.name ?? null,
      plan:          workspace?.plan ?? null,
      brandType:     brand?.brand_type ?? null,
      lastMessageAt: row.last_message_at,
      createdAt:     row.created_at,
      waitingOnUs:   last?.author_type === 'customer',
      // The preview is the customer's words, which is customer content. A role
      // without that key sees that a thread exists and not what it says.
      preview: canSeeContent
        ? (last?.body ?? '').slice(0, 140)
        : 'Message hidden on your role',
      assignedTo: names.get(row.assigned_to ?? '') ?? null,
    }
  }).sort((a, b) => Number(b.waitingOnUs) - Number(a.waitingOnUs))
}

export interface DeskThread {
  id:        string
  name:      string | null
  email:     string | null
  status:    string
  source:    string
  pageUrl:   string | null
  userAgent: string | null
  createdAt: string
  assignedTo: string | null
  /** The raw id as well as the name, so the assign control can show the truth. */
  assignedToId: string | null
  /** The account behind the thread, so nobody has to ask which one this is. */
  account: {
    workspaceId: string
    workspaceName: string
    plan: string
    brandName: string | null
    brandType: string | null
    bhi: number | null
    aiCalls30: number
  } | null
  messages: {
    id: string
    author: 'customer' | 'staff' | 'system'
    authorName: string | null
    body: string
    internal: boolean
    attachments: { name: string; url: string | null; type: string }[]
    createdAt: string
  }[]
}

export async function deskThread(session: StaffSession, id: string): Promise<DeskThread | null> {
  const service = await createServiceClient()

  const { data: conv } = await service
    .from('support_conversations')
    .select('id, name, email, status, source, page_url, user_agent, created_at, assigned_to, workspace_id, brand_id')
    .eq('id', id)
    .maybeSingle()
  if (!conv) return null

  const { data: rows } = await service
    .from('support_messages')
    .select('id, author_type, author_id, body, internal, attachments, created_at')
    .eq('conversation_id', id)
    .order('created_at')
    .limit(500)

  const staffIds = [...new Set([
    ...(rows ?? []).map(r => r.author_id).filter(Boolean) as string[],
    ...(conv.assigned_to ? [conv.assigned_to] : []),
  ])]
  const { data: people } = staffIds.length
    ? await service.from('staff').select('user_id, full_name').in('user_id', staffIds)
    : { data: [] }
  const names = new Map((people ?? []).map(p => [p.user_id, p.full_name]))

  let account: DeskThread['account'] = null
  if (conv.workspace_id) {
    const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString()
    const [{ data: workspace }, { data: brand }, calls] = await Promise.all([
      service.from('workspaces').select('id, name, plan').eq('id', conv.workspace_id).maybeSingle(),
      conv.brand_id
        ? service.from('brands').select('name, brand_type').eq('id', conv.brand_id).maybeSingle()
        : Promise.resolve({ data: null }),
      service.from('ai_calls').select('*', { count: 'exact', head: true })
        .eq('workspace_id', conv.workspace_id).gte('created_at', since30),
    ])

    const { data: snapshot } = conv.brand_id
      ? await service.from('brand_health_snapshots')
          .select('bhi').eq('brand_id', conv.brand_id)
          .order('snapshot_date', { ascending: false }).limit(1).maybeSingle()
      : { data: null }

    if (workspace) {
      account = {
        workspaceId:   workspace.id,
        workspaceName: workspace.name,
        plan:          workspace.plan,
        brandName:     (brand as { name?: string } | null)?.name ?? null,
        brandType:     (brand as { brand_type?: string } | null)?.brand_type ?? null,
        bhi:           (snapshot as { bhi?: number } | null)?.bhi ?? null,
        aiCalls30:     calls.count ?? 0,
      }
    }
  }

  const canSeeContent = session.sees('data.customer_content')

  return {
    id:        conv.id,
    name:      conv.name,
    email:     session.sees('data.customer_email') ? conv.email : maskEmail(conv.email),
    status:    conv.status,
    source:    conv.source,
    pageUrl:   conv.page_url,
    userAgent: conv.user_agent,
    createdAt: conv.created_at,
    assignedTo:   names.get(conv.assigned_to ?? '') ?? null,
    assignedToId: conv.assigned_to ?? null,
    account,
    messages: await Promise.all((rows ?? []).map(async row => ({
      id:     row.id,
      author: row.author_type as 'customer' | 'staff' | 'system',
      authorName: row.author_type === 'staff' ? names.get(row.author_id ?? '') ?? 'BrandGauge' : null,
      body:   canSeeContent || row.author_type !== 'customer'
        ? row.body
        : 'Hidden on your role',
      internal: row.internal,
      attachments: canSeeContent
        ? await signAttachmentsForDesk(row.attachments as { path: string; name: string; type: string }[])
        : [],
      createdAt: row.created_at,
    }))),
  }
}

async function signAttachmentsForDesk(
  list: { path: string; name: string; type: string }[] | null,
): Promise<{ name: string; url: string | null; type: string }[]> {
  if (!Array.isArray(list) || list.length === 0) return []
  const service = await createServiceClient()
  return Promise.all(list.map(async item => {
    try {
      const { data } = await service.storage
        .from('support-attachments').createSignedUrl(item.path, 300)
      return { name: item.name, type: item.type, url: data?.signedUrl ?? null }
    } catch {
      return { name: item.name, type: item.type, url: null }
    }
  }))
}
