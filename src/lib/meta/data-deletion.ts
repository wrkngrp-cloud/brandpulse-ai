import { createHmac, timingSafeEqual } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Meta's data deletion request, end to end.
 *
 * Meta posts a `signed_request` holding the app-scoped user id of someone who
 * removed BrandGauge or asked for their data to go. We verify it, delete
 * everything we pulled from Meta on that person's authority, and hand Meta a
 * status page and a confirmation code. This is checked in App Review.
 */

/** Verify and decode Meta's signed_request. Null when the signature fails. */
export function parseSignedRequest(signedRequest: string, secret: string): Record<string, unknown> | null {
  const [encodedSig, payload] = signedRequest.split('.')
  if (!encodedSig || !payload) return null
  const b64 = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
  const sig = b64(encodedSig)
  const expected = createHmac('sha256', secret).update(payload).digest()
  // Constant-time, and length-checked first: timingSafeEqual throws on a
  // length mismatch, which would otherwise be its own signal.
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null
  try {
    const data = JSON.parse(b64(payload).toString('utf8')) as Record<string, unknown>
    return data.algorithm === undefined || String(data.algorithm).toUpperCase() === 'HMAC-SHA256' ? data : null
  } catch {
    return null
  }
}

export interface DeletionResult {
  socialConnections: number
  adAccounts:        number
  socialPosts:       number
  mentions:          number
}

/**
 * Delete what we hold from one Meta user: the Facebook and Instagram
 * connections they made (with their tokens), the posts and Instagram
 * listening pulled through those connections, and the Meta ad accounts they
 * connected (ad performance rows go with them, by cascade). Rows from other
 * platforms, and anything the brand typed in itself, are not touched.
 */
export async function deleteMetaUserData(db: SupabaseClient, metaUserId: string): Promise<DeletionResult> {
  const result: DeletionResult = { socialConnections: 0, adAccounts: 0, socialPosts: 0, mentions: 0 }

  const { data: conns } = await db.from('social_connections')
    .select('id, brand_id, platform')
    .eq('meta_user_id', metaUserId)
    .in('platform', ['facebook', 'instagram'])
  for (const c of conns ?? []) {
    const posts = await db.from('social_posts').delete({ count: 'exact' })
      .eq('brand_id', c.brand_id).eq('platform', c.platform)
    result.socialPosts += posts.count ?? 0
    if (c.platform === 'instagram') {
      const ments = await db.from('mentions').delete({ count: 'exact' })
        .eq('brand_id', c.brand_id).eq('platform', 'instagram')
      result.mentions += ments.count ?? 0
    }
  }
  if (conns?.length) {
    const del = await db.from('social_connections').delete({ count: 'exact' }).in('id', conns.map(c => c.id))
    result.socialConnections = del.count ?? 0
  }

  const ads = await db.from('digital_ad_accounts').delete({ count: 'exact' })
    .eq('meta_user_id', metaUserId).eq('platform', 'meta')
  result.adAccounts = ads.count ?? 0

  return result
}
