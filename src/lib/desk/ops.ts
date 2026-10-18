import { createServiceClient } from '@/lib/supabase/server'
import type { StaffSession } from './auth'

/**
 * Ops health.
 *
 * Deliberately only what we can actually read. There is no Inngest API key in
 * this app, so job history is not here and is not faked: the page says where
 * to look instead. What it does show is the two things that go wrong quietly.
 *
 * A credential that is missing turns a feature Inert, which the product does
 * not announce anywhere. And a connector that stopped syncing looks exactly
 * like a connector nobody uses, right up until a customer asks why their
 * numbers stopped moving.
 */

export interface CredentialState {
  name:     string
  gates:    string
  present:  boolean
  /** True when the whole feature is off without it, rather than degraded. */
  blocking: boolean
}

export interface StaleConnector {
  table:     string
  label:     string
  brandName: string
  workspaceName: string
  detail:    string | null
  lastSyncAt: string | null
  daysStale: number | null
}

export interface OpsReport {
  credentials: CredentialState[]
  stale:       StaleConnector[]
  aiErrors24:  { total: number; failed: number }
  seeds:       { workspaceName: string; brandName: string; lastSnapshot: string | null }[]
  scoreboard:  { scans7: number; leads7: number; toolRuns7: number }
}

/**
 * Every credential the product reads, and what it gates.
 *
 * The list is maintained by hand because there is no way to derive it: an env
 * var that is read in one route tells you nothing about what the feature is.
 * It mirrors the "Known-deferred" section of CLAUDE.md, and the two should be
 * changed together.
 */
const CREDENTIALS: { name: string; gates: string; blocking: boolean }[] = [
  { name: 'ANTHROPIC_API_KEY',      gates: 'Every AI feature in the product', blocking: true },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', gates: 'Webhooks, jobs, public endpoints and this Desk', blocking: true },
  { name: 'TOKEN_ENCRYPTION_KEY',   gates: 'Storing any connector token', blocking: true },
  { name: 'RESEND_API_KEY',         gates: 'Every email: reports, invites, support replies', blocking: true },
  { name: 'ADMIN_SECRET',           gates: 'The demo seed endpoints', blocking: true },
  { name: 'UPSTASH_REDIS_REST_URL', gates: 'Caching, rate limits and OAuth state', blocking: false },
  { name: 'DESK_HOST',              gates: 'Serving the Desk on its own hostname', blocking: false },
  { name: 'PAYSTACK_SECRET_KEY',    gates: 'Our own subscription billing webhook', blocking: false },
  { name: 'OPENAI_API_KEY',         gates: 'ChatGPT in the AI Visibility Tracker', blocking: false },
  { name: 'GOOGLE_AI_API_KEY',      gates: 'Gemini in the AI Visibility Tracker', blocking: false },
  { name: 'PERPLEXITY_API_KEY',     gates: 'Perplexity in the AI Visibility Tracker', blocking: false },
  { name: 'WHATSAPP_ACCESS_TOKEN',  gates: 'WhatsApp sends', blocking: false },
  { name: 'WHATSAPP_PHONE_NUMBER_ID', gates: 'WhatsApp sends', blocking: false },
  { name: 'META_APP_ID',            gates: 'Meta Ads and Instagram connectors', blocking: false },
  { name: 'SERPAPI_KEY',            gates: 'Search evidence in the demand finder, and Geo-Lift', blocking: false },
  { name: 'PAGESPEED_API_KEY',      gates: 'The PageSpeed quota in the campaign audit', blocking: false },
]

const SYNC_TABLES = [
  { table: 'social_connections',  label: 'Social',     detail: 'platform' },
  { table: 'digital_ad_accounts', label: 'Paid media', detail: 'platform' },
  { table: 'ga4_connections',     label: 'GA4',        detail: null },
  { table: 'hubspot_connections', label: 'HubSpot',    detail: null },
  { table: 'email_connectors',    label: 'Email',      detail: 'provider' },
]

const STALE_AFTER_DAYS = 3

export async function opsReport(session: StaffSession): Promise<OpsReport | null> {
  if (!session.can('ops.view')) return null

  const service = await createServiceClient()
  const since24 = new Date(Date.now() - 86_400_000).toISOString()
  const since7  = new Date(Date.now() - 7 * 86_400_000).toISOString()

  const credentials: CredentialState[] = CREDENTIALS.map(c => ({
    ...c,
    // Only ever whether it is set. Never the value, never a prefix, never a
    // length: a Desk screen that hints at a secret is a Desk screen that
    // leaks one.
    present: Boolean(process.env[c.name]),
  }))

  const [{ data: brands }, { data: workspaces }, { data: calls }] = await Promise.all([
    service.from('brands').select('id, name, workspace_id').limit(2000),
    service.from('workspaces').select('id, name').limit(2000),
    service.from('ai_calls').select('ok').gte('created_at', since24).limit(20_000),
  ])

  const brandById = new Map((brands ?? []).map(b => [b.id, b]))
  const wsName    = new Map((workspaces ?? []).map(w => [w.id, w.name]))

  const stale: StaleConnector[] = []
  for (const t of SYNC_TABLES) {
    const columns = ['brand_id', 'last_synced_at', t.detail].filter(Boolean).join(', ')
    const { data } = await service.from(t.table).select(columns).limit(2000)

    for (const row of (data ?? []) as unknown as Record<string, string | null>[]) {
      const last = row.last_synced_at
      const days = last
        ? Math.floor((Date.now() - new Date(last).getTime()) / 86_400_000)
        : null
      if (days !== null && days < STALE_AFTER_DAYS) continue

      const brand = brandById.get(String(row.brand_id))
      stale.push({
        table:     t.table,
        label:     t.label,
        brandName: brand?.name || 'unnamed brand',
        workspaceName: brand ? wsName.get(brand.workspace_id) ?? 'unknown' : 'unknown',
        detail:    t.detail ? row[t.detail] ?? null : null,
        lastSyncAt: last,
        daysStale: days,
      })
    }
  }
  stale.sort((a, b) => (b.daysStale ?? 1e6) - (a.daysStale ?? 1e6))

  // The demo accounts, and whether their seeded history is still there. Seeds
  // go live by being run, not by being deployed, so a demo login showing an
  // empty dashboard is the thing this catches.
  const demoWorkspaces = (workspaces ?? []).filter(w =>
    /jara|pocketpay|pinnacle|bridger/i.test(w.name))

  const seeds: OpsReport['seeds'] = []
  for (const ws of demoWorkspaces) {
    const demoBrands = (brands ?? []).filter(b => b.workspace_id === ws.id)
    for (const brand of demoBrands) {
      const { data: snapshot } = await service
        .from('brand_health_snapshots')
        .select('snapshot_date')
        .eq('brand_id', brand.id)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .maybeSingle()
      seeds.push({
        workspaceName: ws.name,
        brandName:     brand.name || 'unnamed',
        lastSnapshot:  snapshot?.snapshot_date ?? null,
      })
    }
  }

  const [{ count: scans7 }, { count: leads7 }, { count: toolRuns7 }] = await Promise.all([
    service.from('public_scans').select('*', { count: 'exact', head: true }).gte('created_at', since7),
    service.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', since7),
    service.from('tool_runs').select('*', { count: 'exact', head: true }).gte('created_at', since7),
  ])

  const callRows = (calls ?? []) as { ok: boolean }[]

  return {
    credentials,
    stale: stale.slice(0, 60),
    aiErrors24: {
      total:  callRows.length,
      failed: callRows.filter(c => !c.ok).length,
    },
    seeds,
    scoreboard: {
      scans7:    scans7 ?? 0,
      leads7:    leads7 ?? 0,
      toolRuns7: toolRuns7 ?? 0,
    },
  }
}
