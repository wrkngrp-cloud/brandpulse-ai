import { inngest } from '@/lib/inngest/client'
import { createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'
import { metaUserIdForToken } from '@/lib/social/meta'

/**
 * Fill in the Meta user behind connections made before we recorded it.
 *
 * A Meta data deletion request names a user, and we can only delete what we
 * can match to them. Connections from before 4 November 2026 have no
 * meta_user_id, so each night this asks Meta who owns their token. Once all
 * are filled it finds nothing and does nothing. A missing column (migration
 * not applied) makes the query fail, and the job stops there harmlessly.
 */
export const metaUserBackfill = inngest.createFunction(
  { id: 'meta-user-backfill', name: 'Meta: record who connected older connections', triggers: [{ cron: 'TZ=Africa/Lagos 30 2 * * *' }] },
  async ({ step, logger }) => {
    return step.run('backfill', async () => {
      const db = await createServiceClient()
      let filled = 0
      const [social, ads] = await Promise.all([
        db.from('social_connections').select('id, access_token')
          .in('platform', ['facebook', 'instagram']).is('meta_user_id', null).not('access_token', 'is', null).limit(200),
        db.from('digital_ad_accounts').select('id, access_token')
          .eq('platform', 'meta').is('meta_user_id', null).not('access_token', 'is', null).limit(200),
      ])
      if (social.error || ads.error) {
        logger.warn(`[meta-user-backfill] skipped: ${social.error?.message ?? ads.error?.message}`)
        return { filled: 0 }
      }
      for (const [table, rows] of [['social_connections', social.data], ['digital_ad_accounts', ads.data]] as const) {
        for (const r of rows ?? []) {
          let token: string
          try { token = decrypt(r.access_token as string) } catch { continue }
          const id = await metaUserIdForToken(token)
          if (!id) continue
          const { error } = await db.from(table).update({ meta_user_id: id }).eq('id', r.id)
          if (!error) filled++
        }
      }
      return { filled }
    })
  },
)
