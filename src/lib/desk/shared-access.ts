import { createServiceClient } from '@/lib/supabase/server'
import type { StaffSession } from './auth'
import { maskEmail } from './redact'
import { probeGa4Property } from '@/lib/shared-access/google'
import { assignToSystemUser, probeMetaAdAccount } from '@/lib/shared-access/meta'

/**
 * Shared-access requests waiting for a person.
 *
 * BrandGauge's Google service account and Meta system user can read every
 * property and ad account shared with them, and a property ID is not a
 * secret. So a brand that says "read property 312345678" is making a claim,
 * and somebody here confirms it with the brand before any number flows: a
 * call, a message from their marketing lead, the email domain matching the
 * company. This module is the only place those rows are read across tenants
 * or made active.
 */

export type AccessKind = 'ga4' | 'meta'

export interface AccessRequest {
  kind:          AccessKind
  id:            string
  brandName:     string
  workspaceName: string
  externalId:    string
  externalName:  string | null
  requestedBy:   string
  requestedAt:   string
}

export async function pendingAccessRequests(session: StaffSession): Promise<AccessRequest[] | null> {
  if (!session.can('ops.approve_access')) return null
  const service = await createServiceClient()

  const [ga4, meta] = await Promise.all([
    service.from('ga4_connections')
      .select('id, brand_id, property_id, property_name, requested_by, created_at')
      .eq('auth_mode', 'shared').eq('access_status', 'pending').order('created_at').limit(100),
    service.from('digital_ad_accounts')
      .select('id, brand_id, ad_account_id, account_name, requested_by, created_at')
      .eq('platform', 'meta').eq('auth_mode', 'shared').eq('access_status', 'pending').order('created_at').limit(100),
  ])
  // Before the migration the columns do not exist; there is nothing pending.
  if (ga4.error && meta.error) return []

  const rows = [
    ...(ga4.data ?? []).map(r => ({ kind: 'ga4' as const, id: r.id, brand_id: r.brand_id, ext: r.property_id, name: r.property_name, by: r.requested_by, at: r.created_at })),
    ...(meta.data ?? []).map(r => ({ kind: 'meta' as const, id: r.id, brand_id: r.brand_id, ext: r.ad_account_id ?? '', name: r.account_name, by: r.requested_by, at: r.created_at })),
  ]
  if (!rows.length) return []

  const { data: brands } = await service.from('brands').select('id, name, workspace_id').in('id', [...new Set(rows.map(r => r.brand_id))])
  const { data: workspaces } = await service.from('workspaces').select('id, name').in('id', [...new Set((brands ?? []).map(b => b.workspace_id))])
  const brandById = new Map((brands ?? []).map(b => [b.id, b]))
  const wsById = new Map((workspaces ?? []).map(w => [w.id, w.name as string]))

  const emails = new Map<string, string>()
  for (const uid of new Set(rows.map(r => r.by).filter((v): v is string => !!v))) {
    const { data } = await service.auth.admin.getUserById(uid)
    if (data.user?.email) emails.set(uid, data.user.email)
  }

  return rows.map(r => {
    const brand = brandById.get(r.brand_id)
    const email = r.by ? emails.get(r.by) ?? '' : ''
    return {
      kind:          r.kind,
      id:            r.id,
      brandName:     brand?.name || 'unnamed brand',
      workspaceName: brand ? wsById.get(brand.workspace_id) ?? '' : '',
      externalId:    r.ext,
      externalName:  r.name ?? null,
      // Who asked is the main evidence for the decision, but it is still a
      // customer email and follows the same redaction as everywhere else.
      requestedBy:   session.sees('data.customer_email') ? email : maskEmail(email),
      requestedAt:   r.at,
    }
  })
}

/**
 * Approve or reject one request. Approval re-checks that we can actually read
 * the account (for Meta, after assigning it to our system user), so a
 * connection is never marked active when its first sync would fail.
 */
export async function decideAccessRequest(
  session: StaffSession,
  args: { kind: AccessKind; id: string; approve: boolean },
): Promise<{ ok: true; brandId: string } | { ok: false; error: string }> {
  if (!session.can('ops.approve_access')) return { ok: false, error: 'You do not have permission to confirm access.' }
  const service = await createServiceClient()
  const table = args.kind === 'ga4' ? 'ga4_connections' : 'digital_ad_accounts'

  const { data: row } = await service.from(table)
    .select(args.kind === 'ga4' ? 'id, brand_id, property_id, access_status' : 'id, brand_id, ad_account_id, access_status')
    .eq('id', args.id).eq('auth_mode', 'shared').maybeSingle<{ id: string; brand_id: string; property_id?: string; ad_account_id?: string; access_status: string }>()
  if (!row) return { ok: false, error: 'That request no longer exists. The brand may have withdrawn it.' }
  if (row.access_status !== 'pending') return { ok: false, error: 'Someone has already decided this one.' }

  if (args.approve) {
    if (args.kind === 'ga4') {
      const probe = await probeGa4Property(row.property_id!)
      if (!probe.ok) return { ok: false, error: probe.reason === 'not_configured' ? 'GOOGLE_SERVICE_ACCOUNT_JSON is not set.' : 'Our service account cannot read this property. Ask the brand to check it is added as a Viewer.' }
    } else {
      await assignToSystemUser(row.ad_account_id!)
      const probe = await probeMetaAdAccount(row.ad_account_id!)
      if (!probe.ok) {
        return { ok: false, error: probe.reason === 'not_configured'
          ? 'META_SYSTEM_USER_TOKEN is not set.'
          : 'Our system user cannot read this ad account yet. In Business Settings, check the partner share arrived, then assign the account to the system user with View performance.' }
      }
      await service.from(table).update({ account_name: probe.name, currency: probe.currency ?? 'NGN' }).eq('id', row.id)
    }
  }

  const { error } = await service.from(table).update({
    access_status: args.approve ? 'active' : 'rejected',
    reviewed_at:   new Date().toISOString(),
  }).eq('id', row.id).eq('access_status', 'pending')
  if (error) return { ok: false, error: 'That did not save. Try again.' }
  return { ok: true, brandId: row.brand_id }
}
