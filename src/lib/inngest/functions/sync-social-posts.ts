import { inngest } from '@/lib/inngest/client'
import { createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'
import { MetaTokenError } from '@/lib/social/meta'
import { fetchInstagramPosts, fetchFacebookPosts, type MetaPost } from '@/lib/social/meta'
import { fetchTwitterPosts, type TwitterPost } from '@/lib/social/twitter'
import { twitterRefresher } from '@/lib/social/twitter-token'

type AnyPost = MetaPost | TwitterPost

function isMetaPost(p: AnyPost): p is MetaPost {
  return 'content_type' in p
}

export const syncSocialPosts = inngest.createFunction(
  {
    id: 'sync-social-posts',
    name: 'Sync social posts (nightly)',
    triggers: [{ cron: 'TZ=Africa/Lagos 0 3 * * *' }],
  },
  async ({ step, logger }) => {
    const supabase = await createServiceClient()
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const { data: connections } = await supabase
      .from('social_connections')
      .select('id, brand_id, platform, account_id, access_token, refresh_token')
      .eq('sync_status', 'active')

    if (!connections?.length) {
      logger.info('No active social connections to sync')
      return { synced: 0 }
    }

    let totalSynced = 0

    for (const conn of connections) {
      await step.run(`sync-${conn.platform}-${conn.id}`, async () => {
        try {
          const accessToken = decrypt(conn.access_token!)
          const posts = await fetchPostsForPlatform(conn.platform, conn.account_id!, accessToken, since, conn)

          if (!posts.length) return

          const rows = posts.map(p => {
            const meta = isMetaPost(p) ? p : null
            const tw = !isMetaPost(p) ? p : null
            const likes = p.likes
            const comments = meta ? meta.comments : tw!.replies
            const shares = meta ? meta.shares : tw!.retweets
            const saves = meta ? meta.saves : tw!.bookmarks
            const reach = p.reach

            return {
              brand_id: conn.brand_id,
              platform: conn.platform,
              external_id: p.id,
              content: p.content,
              media_url: meta?.media_url ?? null,
              content_type: meta?.content_type ?? 'text',
              reach,
              impressions: p.impressions,
              likes,
              comments,
              shares,
              saves,
              video_views: meta?.video_views ?? null,
              engagement_rate: reach > 0 ? ((likes + comments + shares + saves) / reach) * 100 : 0,
              posted_at: p.posted_at,
            }
          })

          const { error } = await supabase
            .from('social_posts')
            .upsert(rows, { onConflict: 'platform,external_id', ignoreDuplicates: false })

          if (error) {
            logger.error(`Upsert failed for ${conn.platform} ${conn.id}: ${error.message}`)
            await supabase
              .from('social_connections')
              .update({ sync_status: 'error', last_synced_at: new Date().toISOString() })
              .eq('id', conn.id)
            return
          }

          await supabase
            .from('social_connections')
            .update({ last_synced_at: new Date().toISOString() })
            .eq('id', conn.id)

          totalSynced += rows.length
        } catch (err) {
          logger.error(`Sync failed for connection ${conn.id}: ${String(err)}`)
          // A dead Meta login: mark it so the card offers Reconnect, instead
          // of the connection reading "active" over weeks of nothing.
          if (err instanceof MetaTokenError) {
            await supabase.from('social_connections').update({ sync_status: 'error' }).eq('id', conn.id)
          }
        }
      })
    }

    return { synced: totalSynced }
  }
)

async function fetchPostsForPlatform(
  platform: string,
  accountId: string,
  accessToken: string,
  since: Date,
  conn: { refresh_token?: string | null; id: string }
): Promise<AnyPost[]> {
  switch (platform) {
    case 'instagram':
      return fetchInstagramPosts(accountId, accessToken, since)
    case 'facebook':
      return fetchFacebookPosts(accountId, accessToken, since)
    case 'twitter': {
      // X access tokens last two hours, so a nightly job always needs a fresh
      // one. twitterRefresher saves the rotated refresh token, which this used
      // to throw away, killing the connection from the second night.
      if (conn.refresh_token) {
        try {
          const supabase = await createServiceClient()
          const fresh = await twitterRefresher(supabase, conn)()
          return fetchTwitterPosts(accountId, fresh, since)
        } catch (err) {
          console.error('[sync-social-posts] X token refresh failed:', err instanceof Error ? err.message : err)
          // Fall through to the stored token, in case it is still valid.
        }
      }
      return fetchTwitterPosts(accountId, accessToken, since)
    }
    default:
      return []
  }
}
