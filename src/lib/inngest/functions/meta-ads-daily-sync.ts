import { inngest } from '@/lib/inngest/client'
import { createServiceClient } from '@/lib/supabase/server'
import { decrypt, encrypt } from '@/lib/crypto'
import { getLongLivedToken } from '@/lib/social/meta'

const GRAPH = 'https://graph.facebook.com/v21.0'

interface InsightValue {
  value: string
}

interface InsightAction {
  action_type: string
  value:       string
}

interface InsightRecord {
  campaign_id?:   string
  campaign_name?: string
  adset_id?:      string
  adset_name?:    string
  date_start?:    string
  spend?:         string
  impressions?:   string
  reach?:         string
  clicks?:        string
  ctr?:           string
  cpm?:           string
  cpc?:           string
  frequency?:     string
  video_p25_watched_actions?: InsightValue[]
  actions?: InsightAction[]
}

interface InsightsResponse {
  data?: InsightRecord[]
  error?: { message: string; code: number }
  paging?: { next?: string }
}

interface TokenRefreshResponse {
  access_token: string
  expires_in:   number
}

export const metaAdsDailySync = inngest.createFunction(
  {
    id:   'meta-ads-daily-sync',
    name: 'Meta Ads daily sync (5 AM Lagos)',
    triggers: [{ cron: 'TZ=Africa/Lagos 0 5 * * *' }],
  },
  async ({ step, logger }) => {
    const supabase = await createServiceClient()

    // Fetch all active Meta ad accounts across all brands
    const { data: accounts } = await supabase
      .from('digital_ad_accounts')
      .select('id, brand_id, ad_account_id, access_token, refresh_token, token_expiry')
      .eq('platform', 'meta')
      .neq('sync_status', 'disconnected')

    if (!accounts?.length) {
      logger.info('No Meta ad accounts to sync')
      return { processed: 0 }
    }

    let processed = 0

    for (const account of accounts) {
      await step.run(`sync-meta-${account.id}`, async () => {
        try {
          let accessToken = decrypt(account.access_token)

          // Refresh token if expiring within 7 days
          if (account.token_expiry) {
            const expiryMs     = new Date(account.token_expiry).getTime()
            const sevenDaysMs  = 7 * 24 * 60 * 60 * 1000
            const shouldRefresh = expiryMs - Date.now() < sevenDaysMs

            if (shouldRefresh) {
              try {
                const refreshed = await getLongLivedToken(accessToken) as TokenRefreshResponse
                accessToken = refreshed.access_token
                const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()

                await supabase
                  .from('digital_ad_accounts')
                  .update({
                    access_token: encrypt(accessToken),
                    token_expiry: newExpiry,
                    updated_at:   new Date().toISOString(),
                  })
                  .eq('id', account.id)

                logger.info(`Refreshed Meta token for account ${account.id}`)
              } catch (refreshErr) {
                logger.error(`Failed to refresh token for account ${account.id}: ${String(refreshErr)}`)
                // Continue with existing token — it may still be valid
              }
            }
          }

          if (!account.ad_account_id) {
            logger.warn(`Account ${account.id} has no ad_account_id, skipping insights fetch`)
            return
          }

          const fields = [
            'campaign_id',
            'campaign_name',
            'adset_id',
            'adset_name',
            'spend',
            'impressions',
            'reach',
            'clicks',
            'ctr',
            'cpm',
            'cpc',
            'frequency',
            'video_p25_watched_actions',
            'actions',
          ].join(',')

          const insightsUrl = new URL(`${GRAPH}/${account.ad_account_id}/insights`)
          insightsUrl.searchParams.set('fields',         fields)
          insightsUrl.searchParams.set('date_preset',    'last_7d')
          insightsUrl.searchParams.set('level',          'adset')
          insightsUrl.searchParams.set('time_increment', '1')
          insightsUrl.searchParams.set('access_token',   accessToken)
          insightsUrl.searchParams.set('limit',          '500')

          const insightsRes = await fetch(insightsUrl.toString())
          if (!insightsRes.ok) {
            const errText = await insightsRes.text()
            logger.error(`Meta insights API error for account ${account.id}: ${errText}`)

            await supabase
              .from('digital_ad_accounts')
              .update({
                sync_status: 'error',
                last_error:  `Insights fetch failed: ${errText.slice(0, 500)}`,
                updated_at:  new Date().toISOString(),
              })
              .eq('id', account.id)
            return
          }

          const insightsData = await insightsRes.json() as InsightsResponse

          if (insightsData.error) {
            logger.error(`Meta insights error for account ${account.id}: ${insightsData.error.message}`)
            await supabase
              .from('digital_ad_accounts')
              .update({
                sync_status: 'error',
                last_error:  insightsData.error.message.slice(0, 500),
                updated_at:  new Date().toISOString(),
              })
              .eq('id', account.id)
            return
          }

          const rows = (insightsData.data ?? []).map(insight => {
            const spend       = parseFloat(insight.spend       ?? '0')
            const impressions = parseInt(insight.impressions   ?? '0', 10)
            const clicks      = parseInt(insight.clicks        ?? '0', 10)
            const ctr         = parseFloat(insight.ctr         ?? '0') / 100  // Meta returns as percentage
            const cpm         = parseFloat(insight.cpm         ?? '0')
            const cpc         = parseFloat(insight.cpc         ?? '0')
            const reach       = parseInt(insight.reach         ?? '0', 10)
            const frequency   = parseFloat(insight.frequency   ?? '0')

            // Video views from video_p25_watched_actions
            const videoViews  = parseInt(insight.video_p25_watched_actions?.[0]?.value ?? '0', 10)

            // Conversions from actions (purchase or lead)
            const conversions = (insight.actions ?? [])
              .filter(a => a.action_type === 'offsite_conversion.fb_pixel_purchase' || a.action_type === 'lead')
              .reduce((sum, a) => sum + parseInt(a.value, 10), 0)

            const cpa = conversions > 0 ? spend / conversions : null

            return {
              brand_id:      account.brand_id,
              account_id:    account.id,
              platform:      'meta',
              date:          insight.date_start ?? new Date().toISOString().slice(0, 10),
              campaign_id:   insight.campaign_id   ?? null,
              campaign_name: insight.campaign_name ?? null,
              adset_id:      insight.adset_id      ?? null,
              adset_name:    insight.adset_name    ?? null,
              spend:         isNaN(spend)       ? 0 : spend,
              impressions:   isNaN(impressions) ? 0 : impressions,
              reach:         isNaN(reach)       ? 0 : reach,
              clicks:        isNaN(clicks)      ? 0 : clicks,
              ctr:           isNaN(ctr)         ? null : ctr,
              cpm:           isNaN(cpm)         ? null : cpm,
              cpc:           isNaN(cpc)         ? null : cpc,
              cpa:           cpa !== null && isNaN(cpa) ? null : cpa,
              frequency:     isNaN(frequency)   ? null : frequency,
              video_views:   isNaN(videoViews)  ? null : videoViews,
              conversions,
              currency:      'NGN',
            }
          })

          if (rows.length > 0) {
            const { error: upsertErr } = await supabase
              .from('digital_performance_daily')
              .upsert(rows, {
                onConflict: 'brand_id,platform,date,campaign_id,adset_id',
                ignoreDuplicates: false,
              })

            if (upsertErr) {
              logger.error(`Failed to upsert insights for account ${account.id}: ${upsertErr.message}`)
              return
            }
          }

          // Mark account as synced
          await supabase
            .from('digital_ad_accounts')
            .update({
              sync_status:    'active',
              last_synced_at: new Date().toISOString(),
              last_error:     null,
              updated_at:     new Date().toISOString(),
            })
            .eq('id', account.id)

          processed++
          logger.info(`Synced Meta Ads for account ${account.id}: ${rows.length} rows upserted`)
        } catch (err) {
          logger.error(`Failed to sync Meta account ${account.id}: ${String(err)}`)

          await supabase
            .from('digital_ad_accounts')
            .update({
              sync_status: 'error',
              last_error:  String(err).slice(0, 500),
              updated_at:  new Date().toISOString(),
            })
            .eq('id', account.id)
        }
      })
    }

    return { processed }
  }
)
