import type { SupabaseClient } from '@supabase/supabase-js'
import { decrypt, encrypt } from '@/lib/crypto'
import { googleServiceToken } from './google'

/**
 * The token to read one GA4 connection with, whichever way it was connected.
 *
 * Shared: BrandGauge's service account. OAuth: the brand's own token,
 * refreshed when it is within two minutes of expiry. The daily job used to
 * read the stored OAuth token as it was, which Google expires after an hour,
 * so every scheduled sync after the first hour failed. Both callers now go
 * through here.
 */
export interface Ga4ConnectionRow {
  id:             string
  auth_mode?:     string | null
  access_status?: string | null
  access_token:   string | null
  refresh_token:  string | null
  token_expiry?:  string | null
}

export async function ga4AccessToken(conn: Ga4ConnectionRow, db: SupabaseClient): Promise<string | null> {
  if (conn.auth_mode === 'shared') {
    if (conn.access_status !== 'active') return null
    return googleServiceToken()
  }
  if (!conn.access_token) return null
  let token = decrypt(conn.access_token)
  const expiry = conn.token_expiry ? new Date(conn.token_expiry).getTime() : 0
  if (conn.refresh_token && Date.now() > expiry - 120_000) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: decrypt(conn.refresh_token),
        client_id:     process.env.GOOGLE_CLIENT_ID ?? '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        grant_type:    'refresh_token',
      }),
    })
    const data = await res.json().catch(() => ({})) as { access_token?: string; expires_in?: number }
    if (res.ok && data.access_token) {
      token = data.access_token
      await db.from('ga4_connections').update({
        access_token: encrypt(token),
        token_expiry: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
        updated_at:   new Date().toISOString(),
      }).eq('id', conn.id)
    }
  }
  return token
}
