import { inngest } from '@/lib/inngest/client'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEach } from '@/lib/email/send'
import { brandRecipients } from '@/lib/email/recipients'

const APP_URL = process.env.APP_URL || 'https://brandgauge.app'
const DAY = 86_400_000
const PLATFORM_LABEL: Record<string, string> = { facebook: 'Facebook', instagram: 'Instagram', meta: 'Meta Ads' }

/**
 * Warn before a Meta login runs out, and say so when it has.
 *
 * Meta logins last about 60 days and only the person can renew them, by
 * reconnecting. Nothing used to watch the date, so a connection went quiet
 * and the numbers drifted down as if conversation had dropped. Each morning:
 * a login within 7 days of expiry gets one notification and one email to the
 * brand's owners and admins; a login past expiry is marked 'error', so its
 * card offers Reconnect.
 */
export const metaLoginExpiry = inngest.createFunction(
  { id: 'meta-login-expiry', name: 'Meta: warn before logins expire', triggers: [{ cron: 'TZ=Africa/Lagos 0 7 * * *' }] },
  async ({ step, logger }) => {
    return step.run('check', async () => {
      const db = await createServiceClient()
      const now = Date.now()
      const soon = new Date(now + 7 * DAY).toISOString()

      const [social, ads] = await Promise.all([
        db.from('social_connections').select('id, brand_id, platform, account_name, token_expires_at')
          .in('platform', ['facebook', 'instagram']).eq('sync_status', 'active')
          .not('token_expires_at', 'is', null).lte('token_expires_at', soon),
        db.from('digital_ad_accounts').select('id, brand_id, account_name, token_expiry, auth_mode')
          .eq('platform', 'meta').eq('sync_status', 'active')
          .not('token_expiry', 'is', null).lte('token_expiry', soon),
      ])
      if (social.error) logger.warn(`[meta-login-expiry] social read failed: ${social.error.message}`)

      const items = [
        ...(social.data ?? []).map(r => ({ table: 'social_connections' as const, id: r.id, brandId: r.brand_id, platform: r.platform, name: r.account_name, expires: r.token_expires_at as string })),
        // Shared-access accounts read with our own token, which does not expire.
        ...(ads.data ?? []).filter(r => r.auth_mode !== 'shared').map(r => ({ table: 'digital_ad_accounts' as const, id: r.id, brandId: r.brand_id, platform: 'meta', name: r.account_name, expires: r.token_expiry as string })),
      ]

      let warned = 0, expired = 0
      for (const it of items) {
        const label = PLATFORM_LABEL[it.platform] ?? 'Meta'
        if (Date.parse(it.expires) <= now) {
          await db.from(it.table).update(it.table === 'digital_ad_accounts'
            ? { sync_status: 'error', last_error: 'Meta login expired' }   // the card reads this to say "expired"
            : { sync_status: 'error' }).eq('id', it.id)
          expired++
          continue
        }
        // One warning per connection per expiry date.
        const type = `meta_login_expiring:${it.id}:${it.expires.slice(0, 10)}`
        const { data: already } = await db.from('notifications').select('id').eq('brand_id', it.brandId).eq('type', type).limit(1)
        if (already?.length) continue

        const days = Math.max(1, Math.ceil((Date.parse(it.expires) - now) / DAY))
        const title = `Reconnect ${label} within ${days} day${days === 1 ? '' : 's'}`
        const body = `Your ${label} login${it.name ? ` for ${it.name}` : ''} runs out soon. Reconnect it so your numbers keep coming in. It takes a minute.`
        await db.from('notifications').insert({ brand_id: it.brandId, type, title, body, href: '/dashboard/connectors' })

        const to = await brandRecipients(db, it.brandId)
        if (to.length) {
          const mail = await sendEach({
            from: 'BrandGauge <alerts@brandgauge.app>',
            subject: title,
            text: `${body}\n\nReconnect here: ${APP_URL}/dashboard/connectors\n\nMeta logins last about 60 days, and only you can renew them.`,
          }, to)
          if ('reason' in mail) logger.warn(`[meta-login-expiry] email for ${it.brandId}: ${mail.reason}`)
        }
        warned++
      }
      return { warned, expired }
    })
  },
)
