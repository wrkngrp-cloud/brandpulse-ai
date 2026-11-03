/**
 * BrandGauge's own Meta business, for agency-style ad account access.
 *
 * A brand opens Business Settings, adds BrandGauge as a partner by our
 * Business ID, and shares its ad account with "View performance". The account
 * is then assigned to our system user, whose token reads its insights. No
 * customer login, so no OAuth screen.
 *
 *   META_BUSINESS_ID         shown to the brand, so they can add us
 *   META_SYSTEM_USER_TOKEN   reads the shared accounts. Server-side only.
 *   META_SYSTEM_USER_ID      optional: lets approval assign the account to
 *                            the system user automatically. Without it, staff
 *                            assign it by hand in Business Settings.
 */

const GRAPH = 'https://graph.facebook.com/v21.0'

export function metaBusinessId(): string | null {
  return process.env.META_BUSINESS_ID?.trim() || null
}

export function metaSystemToken(): string | null {
  return process.env.META_SYSTEM_USER_TOKEN?.trim() || null
}

/** "act_123", "123", or an Ads Manager URL with act=123 in it. Returns act_123. */
export function normaliseAdAccountId(input: string): string | null {
  const s = input.trim()
  const m = /^(?:act_)?(\d{6,20})$/.exec(s) ?? /[?&]act=(\d{6,20})/.exec(s)
  return m ? `act_${m[1]}` : null
}

export type MetaProbe =
  | { ok: true; name: string | null; currency: string | null }
  | { ok: false; reason: 'not_configured' | 'no_access' | 'error'; detail?: string }

/** Can our system user read this ad account? */
export async function probeMetaAdAccount(adAccountId: string): Promise<MetaProbe> {
  const token = metaSystemToken()
  if (!token) return { ok: false, reason: 'not_configured' }
  const url = `${GRAPH}/${adAccountId}?fields=name,currency,account_status&access_token=${encodeURIComponent(token)}`
  const res = await fetch(url, { cache: 'no-store' }).catch(() => null)
  if (!res) return { ok: false, reason: 'error' }
  const body = await res.json().catch(() => ({})) as { name?: string; currency?: string; error?: { message?: string; code?: number } }
  if (!res.ok || body.error) {
    // 100 / 200-series: the account exists but is not shared with us yet.
    const code = body.error?.code ?? 0
    return { ok: false, reason: code === 100 || (code >= 200 && code < 300) ? 'no_access' : 'error', detail: body.error?.message }
  }
  return { ok: true, name: body.name ?? null, currency: body.currency ?? null }
}

/** Assign a partner-shared ad account to our system user, so its token can
 *  read it. Needs META_SYSTEM_USER_ID. Returns false when it cannot, and the
 *  Desk then asks staff to do it in Business Settings. */
export async function assignToSystemUser(adAccountId: string): Promise<boolean> {
  const token = metaSystemToken()
  const userId = process.env.META_SYSTEM_USER_ID?.trim()
  if (!token || !userId) return false
  const res = await fetch(`${GRAPH}/${adAccountId}/assigned_users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ user: userId, tasks: '["ANALYZE"]', access_token: token }),
    cache: 'no-store',
  }).catch(() => null)
  return !!res?.ok
}
