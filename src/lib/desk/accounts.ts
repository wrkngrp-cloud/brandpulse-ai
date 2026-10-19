import { createServiceClient } from '@/lib/supabase/server'
import { maskEmail } from './redact'
import type { StaffSession } from './auth'

/**
 * Accounts, for the Desk.
 *
 * A sibling of data.ts under the same rules: the service client is used here
 * and nowhere outside these modules, and dataset keys are applied before rows
 * leave the file so a screen cannot render a field its viewer is not allowed.
 *
 * Deliberately a handful of wide queries aggregated in memory rather than one
 * clever join. At this stage there are tens of workspaces, not thousands, and
 * a shape somebody can read beats a query plan nobody will revisit. The row
 * counts are capped so that stays true if it changes.
 */

const MTD_START = () => {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}

/**
 * The six tables that mean "this brand has connected something".
 *
 * `detail` and the sync columns differ per table, so each row names its own.
 * No token column appears anywhere in this list, and the query below builds
 * its select from these names only: a token is not masked or truncated here,
 * it is never read.
 */
const CONNECTOR_TABLES: {
  table: string; label: string; detail?: string; lastSync?: string; status?: string
}[] = [
  { table: 'social_connections',  label: 'Social',     detail: 'platform', lastSync: 'last_synced_at', status: 'sync_status' },
  { table: 'digital_ad_accounts', label: 'Paid media', detail: 'platform', lastSync: 'last_synced_at', status: 'sync_status' },
  { table: 'ga4_connections',     label: 'GA4',                            lastSync: 'last_synced_at' },
  { table: 'hubspot_connections', label: 'HubSpot',                        lastSync: 'last_synced_at' },
  { table: 'email_connectors',    label: 'Email',      detail: 'provider', lastSync: 'last_synced_at' },
  { table: 'webhook_configs',     label: 'Payments',   detail: 'provider' },
]

export interface AccountRow {
  workspaceId:   string
  name:          string
  plan:          string
  type:          string
  createdAt:     string
  seats:         number
  brands:        { id: string; name: string; brandType: string | null }[]
  connectors:    number
  /** Most recent module view by anyone in the workspace. Null means never. */
  lastActiveAt:  string | null
  modulesUsed30: number
  aiCallsMtd:    number
  /** Null when the viewer does not hold data.ai_cost. */
  aiCostMtd:     number | null
  openThreads:   number
  bhi:           number | null
}

export async function accountList(session: StaffSession): Promise<AccountRow[]> {
  const service = await createServiceClient()
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
  const mtd     = MTD_START()

  const [
    { data: workspaces }, { data: brands }, { data: members },
    { data: events }, { data: calls }, { data: threads }, { data: snapshots },
  ] = await Promise.all([
    service.from('workspaces').select('id, name, plan, type, created_at')
      .order('created_at', { ascending: false }).limit(500),
    service.from('brands').select('id, workspace_id, name, brand_type').limit(2000),
    service.from('workspace_members').select('workspace_id, user_id').limit(5000),
    service.from('feature_events')
      .select('workspace_id, module, count, last_seen_at')
      .gte('day', since30).limit(50_000),
    service.from('ai_calls').select('workspace_id, cost_usd')
      .gte('created_at', mtd).limit(50_000),
    service.from('support_conversations').select('workspace_id, status')
      .in('status', ['open', 'pending']).limit(2000),
    service.from('brand_health_snapshots').select('brand_id, bhi, snapshot_date')
      .order('snapshot_date', { ascending: false }).limit(5000),
  ])

  const brandsByWorkspace = new Map<string, AccountRow['brands']>()
  const workspaceOfBrand  = new Map<string, string>()
  for (const b of brands ?? []) {
    workspaceOfBrand.set(b.id, b.workspace_id)
    const list = brandsByWorkspace.get(b.workspace_id) ?? []
    list.push({ id: b.id, name: b.name, brandType: b.brand_type })
    brandsByWorkspace.set(b.workspace_id, list)
  }

  // The newest snapshot per brand. The query is already ordered, so the first
  // row seen for a brand is its latest.
  const bhiByBrand = new Map<string, number | null>()
  for (const s of snapshots ?? []) {
    if (!bhiByBrand.has(s.brand_id)) bhiByBrand.set(s.brand_id, s.bhi)
  }

  const seats = new Map<string, number>()
  for (const m of members ?? []) seats.set(m.workspace_id, (seats.get(m.workspace_id) ?? 0) + 1)

  const lastActive = new Map<string, string>()
  const modules    = new Map<string, Set<string>>()
  for (const e of events ?? []) {
    const seen = modules.get(e.workspace_id) ?? new Set<string>()
    seen.add(e.module)
    modules.set(e.workspace_id, seen)
    const prev = lastActive.get(e.workspace_id)
    if (!prev || e.last_seen_at > prev) lastActive.set(e.workspace_id, e.last_seen_at)
  }

  const callCount = new Map<string, number>()
  const callCost  = new Map<string, number>()
  for (const c of calls ?? []) {
    if (!c.workspace_id) continue
    callCount.set(c.workspace_id, (callCount.get(c.workspace_id) ?? 0) + 1)
    callCost.set(c.workspace_id, (callCost.get(c.workspace_id) ?? 0) + Number(c.cost_usd ?? 0))
  }

  const openThreads = new Map<string, number>()
  for (const t of threads ?? []) {
    if (!t.workspace_id) continue
    openThreads.set(t.workspace_id, (openThreads.get(t.workspace_id) ?? 0) + 1)
  }

  const connectors = await connectorCounts(workspaceOfBrand)

  return (workspaces ?? []).map(ws => {
    const wsBrands = brandsByWorkspace.get(ws.id) ?? []
    const bhis = wsBrands
      .map(b => bhiByBrand.get(b.id))
      .filter((v): v is number => typeof v === 'number')

    return {
      workspaceId:   ws.id,
      name:          ws.name,
      plan:          ws.plan,
      type:          ws.type,
      createdAt:     ws.created_at,
      seats:         seats.get(ws.id) ?? 0,
      brands:        wsBrands,
      connectors:    connectors.get(ws.id) ?? 0,
      lastActiveAt:  lastActive.get(ws.id) ?? null,
      modulesUsed30: modules.get(ws.id)?.size ?? 0,
      aiCallsMtd:    callCount.get(ws.id) ?? 0,
      aiCostMtd:     session.sees('data.ai_cost') ? (callCost.get(ws.id) ?? 0) : null,
      openThreads:   openThreads.get(ws.id) ?? 0,
      // The highest brand in a multi-brand workspace, because the list is for
      // spotting trouble and an average hides it.
      bhi: bhis.length ? Math.max(...bhis) : null,
    }
  })
}

async function connectorCounts(workspaceOfBrand: Map<string, string>): Promise<Map<string, number>> {
  const service = await createServiceClient()
  const counts = new Map<string, number>()

  const results = await Promise.all(
    CONNECTOR_TABLES.map(c => service.from(c.table).select('brand_id').limit(5000)),
  )

  for (const { data } of results) {
    for (const row of data ?? []) {
      const ws = workspaceOfBrand.get((row as { brand_id: string }).brand_id)
      if (ws) counts.set(ws, (counts.get(ws) ?? 0) + 1)
    }
  }
  return counts
}

// ── One account ──────────────────────────────────────────────────────────────

export interface ConnectorState {
  label:      string
  detail:     string | null
  connectedAt: string | null
  lastSyncAt: string | null
  status:     string | null
  brandName:  string
}

export interface TimelineEvent {
  at:     string
  kind:   string
  label:  string
}

export interface PersonRow {
  userId:   string
  email:    string
  role:     string
  joinedAt: string
  lastSeenAt: string | null
}

export interface AccountDetail extends AccountRow {
  connectorList: ConnectorState[]
  timeline:      TimelineEvent[]
  people:        PersonRow[]
  /** Calls and cost by tier for the current month. Cost is null without the key. */
  usageByTier:   { tier: string; calls: number; costUsd: number | null }[]
  usageByFeature:{ feature: string; calls: number }[]
  planLimits:    { aiCallsMo: number; surveyMo: number; brandCount: number; userCount: number } | null
  notes:         { id: string; body: string; authorName: string; createdAt: string }[]
}

export async function accountDetail(
  session: StaffSession, workspaceId: string,
): Promise<AccountDetail | null> {
  const list = await accountList(session)
  const base = list.find(a => a.workspaceId === workspaceId)
  if (!base) return null

  const service = await createServiceClient()
  const mtd = MTD_START()
  const brandIds = base.brands.map(b => b.id)
  const nameOfBrand = new Map(base.brands.map(b => [b.id, b.name]))

  const [
    { data: members }, { data: calls }, { data: limits }, { data: notes },
    { data: surveys }, { data: threads }, { data: snapshots },
  ] = await Promise.all([
    service.from('workspace_members')
      .select('user_id, role, created_at').eq('workspace_id', workspaceId),
    service.from('ai_calls').select('tier, feature, cost_usd, created_at')
      .eq('workspace_id', workspaceId).gte('created_at', mtd).limit(20_000),
    service.from('plan_limits')
      .select('ai_calls_mo, survey_mo, brand_count, user_count').eq('plan', base.plan).maybeSingle(),
    service.from('staff_notes')
      .select('id, body, author_id, created_at').eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false }).limit(50),
    brandIds.length
      ? service.from('surveys').select('id, title, created_at').in('brand_id', brandIds).limit(200)
      : Promise.resolve({ data: [] }),
    service.from('support_conversations')
      .select('id, created_at, source').eq('workspace_id', workspaceId).limit(200),
    brandIds.length
      ? service.from('brand_health_snapshots').select('brand_id, bhi, snapshot_date')
          .in('brand_id', brandIds).order('snapshot_date').limit(2000)
      : Promise.resolve({ data: [] }),
  ])

  // People. Emails live in the auth schema, which PostgREST cannot see, so
  // they come back through a security-definer function that only the service
  // role may execute. One call for the whole workspace.
  const memberIds = (members ?? []).map(m => m.user_id)
  const { data: identities } = memberIds.length
    ? await service.rpc('auth_emails_for_user_ids', { p_ids: memberIds })
    : { data: [] }

  const identityRows = (identities ?? []) as unknown as
    { user_id: string; email: string | null; last_sign_in_at: string | null }[]
  const identityOf = new Map(identityRows.map(r => [r.user_id, r]))

  const people: PersonRow[] = (members ?? []).map(m => {
    const address = identityOf.get(m.user_id)?.email ?? ''
    return {
      userId:   m.user_id,
      email:    session.sees('data.customer_email') ? address : maskEmail(address),
      role:     m.role,
      joinedAt: m.created_at,
      lastSeenAt: identityOf.get(m.user_id)?.last_sign_in_at ?? null,
    }
  })

  const tierMap    = new Map<string, { calls: number; cost: number }>()
  const featureMap = new Map<string, number>()
  for (const c of calls ?? []) {
    const t = tierMap.get(c.tier) ?? { calls: 0, cost: 0 }
    t.calls += 1
    t.cost  += Number(c.cost_usd ?? 0)
    tierMap.set(c.tier, t)
    featureMap.set(c.feature, (featureMap.get(c.feature) ?? 0) + 1)
  }

  const noteAuthorIds = [...new Set((notes ?? []).map(n => n.author_id).filter(Boolean))] as string[]
  const { data: noteAuthors } = noteAuthorIds.length
    ? await service.from('staff').select('user_id, full_name').in('user_id', noteAuthorIds)
    : { data: [] }
  const authorNames = new Map((noteAuthors ?? []).map(a => [a.user_id, a.full_name]))

  const connectorList = await connectorStates(brandIds, nameOfBrand)

  // The timeline. Everything that already existed, read in one pass and sorted
  // once, which is what turns support from guessing into reading.
  const timeline: TimelineEvent[] = [
    { at: base.createdAt, kind: 'signup', label: 'Workspace created' },
    ...(members ?? []).map(m => ({
      at: m.created_at, kind: 'member', label: `Someone joined as ${m.role}`,
    })),
    ...base.brands.map(b => ({
      at: base.createdAt, kind: 'brand',
      label: `Brand ${b.name || 'unnamed'}${b.brandType ? ` (${b.brandType})` : ''}`,
    })),
    ...connectorList.filter(c => c.connectedAt).map(c => ({
      at: c.connectedAt!, kind: 'connector', label: `Connected ${c.label}${c.detail ? `: ${c.detail}` : ''}`,
    })),
    ...(surveys ?? []).map(s => ({
      at: s.created_at, kind: 'survey',
      label: session.sees('data.customer_content') ? `Survey: ${s.title}` : 'A survey was created',
    })),
    ...(threads ?? []).map(t => ({
      at: t.created_at, kind: 'support', label: `Support conversation from ${t.source}`,
    })),
    ...firstSnapshot(snapshots as { brand_id: string; bhi: number | null; snapshot_date: string }[] | null, nameOfBrand),
  ].filter(e => e.at).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 120)

  return {
    ...base,
    connectorList,
    timeline,
    people,
    usageByTier: [...tierMap.entries()].map(([tier, v]) => ({
      tier, calls: v.calls, costUsd: session.sees('data.ai_cost') ? v.cost : null,
    })).sort((a, b) => b.calls - a.calls),
    usageByFeature: [...featureMap.entries()]
      .map(([feature, calls]) => ({ feature, calls }))
      .sort((a, b) => b.calls - a.calls).slice(0, 15),
    planLimits: limits
      ? {
          aiCallsMo:  limits.ai_calls_mo,
          surveyMo:   limits.survey_mo,
          brandCount: limits.brand_count,
          userCount:  limits.user_count,
        }
      : null,
    notes: (notes ?? []).map(n => ({
      id: n.id, body: n.body,
      authorName: authorNames.get(n.author_id ?? '') ?? 'Someone no longer on the Desk',
      createdAt: n.created_at,
    })),
  }
}

/** The first BHI each brand ever computed, which is the onboarding milestone. */
function firstSnapshot(
  snapshots: { brand_id: string; bhi: number | null; snapshot_date: string }[] | null,
  nameOfBrand: Map<string, string>,
): TimelineEvent[] {
  const seen = new Set<string>()
  const out: TimelineEvent[] = []
  for (const s of snapshots ?? []) {
    if (seen.has(s.brand_id) || s.bhi === null) continue
    seen.add(s.brand_id)
    out.push({
      at: new Date(s.snapshot_date).toISOString(),
      kind: 'bhi',
      label: `First brand health reading for ${nameOfBrand.get(s.brand_id) ?? 'a brand'}: ${s.bhi}`,
    })
  }
  return out
}

async function connectorStates(
  brandIds: string[], nameOfBrand: Map<string, string>,
): Promise<ConnectorState[]> {
  if (!brandIds.length) return []
  const service = await createServiceClient()
  const out: ConnectorState[] = []

  for (const c of CONNECTOR_TABLES) {
    const columns = ['brand_id', 'created_at', c.detail, c.lastSync, c.status]
      .filter(Boolean).join(', ')

    const { data } = await service.from(c.table).select(columns).in('brand_id', brandIds)
    for (const row of (data ?? []) as unknown as Record<string, string | null>[]) {
      out.push({
        label:       c.label,
        detail:      c.detail ? row[c.detail] ?? null : null,
        connectedAt: row.created_at ?? null,
        lastSyncAt:  c.lastSync ? row[c.lastSync] ?? null : null,
        status:      c.status   ? row[c.status]   ?? null : null,
        brandName:   nameOfBrand.get(String(row.brand_id)) ?? 'a brand',
      })
    }
  }

  return out.sort((a, b) => a.label.localeCompare(b.label))
}
