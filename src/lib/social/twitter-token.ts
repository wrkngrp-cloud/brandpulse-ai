import type { SupabaseClient } from '@supabase/supabase-js'
import { decrypt, encrypt } from '@/lib/crypto'
import { refreshTwitterToken } from './twitter'

/**
 * One way to refresh an X connection's token, shared by every job.
 *
 * X refresh tokens are single use: each refresh returns a new one and kills
 * the old. The 03:00 post sync saved only the new access token and threw the
 * new refresh token away, so on the second night it refreshed with a dead
 * token, and posts and mentions stopped for good while the card still read
 * "active". The 04:00 crawl also refreshed twice in parallel with the same
 * token, so one of the two always failed.
 *
 * So: the refresh token X returns is always saved, concurrent callers share
 * one refresh, and a refresh X refuses outright marks the connection 'error',
 * which is what makes the Connectors card offer Reconnect.
 */
export function twitterRefresher(
  db: SupabaseClient,
  conn: { id?: string; brand_id?: string; refresh_token?: string | null },
): () => Promise<string> {
  let inflight: Promise<string> | null = null
  const where = <T extends { eq: (c: string, v: string) => T }>(q: T): T =>
    conn.id ? q.eq('id', conn.id) : q.eq('brand_id', conn.brand_id!).eq('platform', 'twitter')

  return () => {
    inflight ??= (async () => {
      if (!conn.refresh_token) throw new Error('X connection has no refresh token; reconnect needed')
      let refreshed: { access_token: string; refresh_token?: string }
      try {
        refreshed = await refreshTwitterToken(decrypt(conn.refresh_token))
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        // invalid_request / invalid_grant: the refresh token is dead and only
        // the customer can fix it. Anything else may be a blip; leave it.
        if (/invalid_grant|invalid_request|revoked|expired/i.test(msg)) {
          await where(db.from('social_connections').update({ sync_status: 'error' }))
        }
        throw err
      }
      const { error } = await where(db.from('social_connections').update({
        access_token: encrypt(refreshed.access_token),
        ...(refreshed.refresh_token ? { refresh_token: encrypt(refreshed.refresh_token) } : {}),
      }))
      if (error) {
        // The old refresh token is already spent, so this connection will need
        // a reconnect. Say so loudly rather than let it look healthy.
        console.error('[x-token] refreshed but could not save the new token:', error.message)
      }
      return refreshed.access_token
    })()
    return inflight
  }
}
