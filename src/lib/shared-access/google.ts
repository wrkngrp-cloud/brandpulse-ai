import { createSign } from 'crypto'

/**
 * BrandGauge's own Google identity, for agency-style GA4 access.
 *
 * A brand adds this service account's email as a Viewer on its GA4 property,
 * the same way it would add an agency. We then read the property as that
 * service account. No OAuth screen, so no Google app verification is needed
 * for it.
 *
 * GOOGLE_SERVICE_ACCOUNT_JSON holds the key file Google issues, either as the
 * raw JSON or base64 of it. Server-side only. Without it the feature is Inert
 * and the connectors page says so.
 */

interface KeyFile { client_email: string; private_key: string }

let parsed: KeyFile | null | undefined

function keyFile(): KeyFile | null {
  if (parsed !== undefined) return parsed
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()
  if (!raw) return (parsed = null)
  try {
    const text = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
    const json = JSON.parse(text) as Partial<KeyFile>
    parsed = json.client_email && json.private_key
      ? { client_email: json.client_email, private_key: json.private_key.replace(/\\n/g, '\n') }
      : null
  } catch {
    parsed = null
  }
  return parsed
}

/** The email a brand adds as a Viewer. Not a secret: it is what we show them. */
export function googleShareEmail(): string | null {
  return keyFile()?.client_email ?? null
}

const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'
let cached: { token: string; expires: number } | null = null

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')

/** A short-lived access token for the service account. Cached until a minute
 *  before it expires. Null when the key is missing or Google refuses it. */
export async function googleServiceToken(): Promise<string | null> {
  const key = keyFile()
  if (!key) return null
  if (cached && cached.expires > Date.now() + 60_000) return cached.token

  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(JSON.stringify({
    iss: key.client_email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }))
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${claims}`)
  const assertion = `${header}.${claims}.${b64url(signer.sign(key.private_key))}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    cache: 'no-store',
  })
  if (!res.ok) {
    console.error('[shared-access] service account token refused:', res.status, await res.text().catch(() => ''))
    return null
  }
  const data = await res.json() as { access_token: string; expires_in: number }
  cached = { token: data.access_token, expires: Date.now() + data.expires_in * 1000 }
  return data.access_token
}

/** "properties/123456789", "123456789" or a GA4 URL with p123456789 in it. */
export function normalisePropertyId(input: string): string | null {
  const s = input.trim()
  const m = /^(?:properties\/)?(\d{6,12})$/.exec(s) ?? /[/#]p(\d{6,12})(?:\/|$)/.exec(s)
  return m ? m[1] : null
}

export type ProbeResult =
  | { ok: true; propertyName: string | null }
  | { ok: false; reason: 'not_configured' | 'no_access' | 'not_found' | 'error' }

/** Can our service account read this property? Reads one day's sessions, the
 *  cheapest call that proves Data API access, then the display name. */
export async function probeGa4Property(propertyId: string): Promise<ProbeResult> {
  const token = await googleServiceToken()
  if (!token) return { ok: false, reason: 'not_configured' }
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ dateRanges: [{ startDate: 'yesterday', endDate: 'today' }], metrics: [{ name: 'sessions' }], limit: 1 }),
    cache: 'no-store',
  })
  if (res.status === 403) return { ok: false, reason: 'no_access' }
  if (res.status === 404 || res.status === 400) return { ok: false, reason: 'not_found' }
  if (!res.ok) return { ok: false, reason: 'error' }

  let propertyName: string | null = null
  const meta = await fetch(`https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  }).catch(() => null)
  if (meta?.ok) propertyName = ((await meta.json()) as { displayName?: string }).displayName ?? null
  return { ok: true, propertyName }
}
