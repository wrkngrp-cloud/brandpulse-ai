import { inngest } from '@/lib/inngest/client'
import { createServiceClient } from '@/lib/supabase/server'
import { decrypt, encrypt } from '@/lib/crypto'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const ADS_API   = 'https://googleads.googleapis.com/v17'

const MICROS = 1_000_000

interface GaqlResultRow {
  campaign?: { id?: string; name?: string }
  adGroup?:  { id?: string; name?: string }
  segments?: { date?: string }
  metrics?: {
    costMicros?:  string | number
    impressions?: string | number
    clicks?:      string | number
    ctr?:         string | number
    averageCpm?:  string | number
    averageCpc?:  string | number
    conversions?: string | number
  }
}

interface SearchStreamBatch {
  results?: GaqlResultRow[]
  error?:   { message?: string }
}

interface TokenRefreshResponse {
  access_token?: string
  expires_in?:   number
  error?:             string
  error_description?: string
}

const GAQL_QUERY = `
  SELECT campaign.id, campaign.name, ad_group.id, ad_group.name, segments.date,
         metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.ctr,
         metrics.average_cpm, metrics.average_cpc, metrics.conversions
  FROM ad_group
  WHERE segments.date DURING LAST_7_DAYS
`.trim()

function toNumber(value: string | number | undefined): number {
  if (value === undefined || value === null) return 0
  const n = typeof value === 'string' ? parseFloat(value) : value
  return isNaN(n) ? 0 : n
}

export const googleAdsDailySync = inngest.createFunction(
  {
    id:   'google-ads-daily-sync',
    name: 'Google Ads daily sync (5:30 AM Lagos)',
    triggers: [{ cron: 'TZ=Africa/Lagos 30 5 * * *' }],
  },
  async ({ step, logger }) => {
    // Defense in depth: if the developer token was removed after brands connected,
    // skip the whole run without marking accounts as errored — the accounts are
    // still connected, the server just temporarily lost its Ads API access.
    if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
      logger.warn('GOOGLE_ADS_DEVELOPER_TOKEN not set — skipping Google Ads sync')
      return { processed: 0 }
    }
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN

    const supabase = await createServiceClient()

    // Fetch all active Google ad accounts across all brands
    const { data: accounts } = await supabase
      .from('digital_ad_accounts')
      .select('id, brand_id, ad_account_id, access_token, refresh_token, token_expiry')
      .eq('platform', 'google')
      .neq('sync_status', 'disconnected')

    if (!accounts?.length) {
      logger.info('No Google ad accounts to sync')
      return { processed: 0 }
    }

    let processed = 0

    for (const account of accounts) {
      await step.run(`sync-google-${account.id}`, async () => {
        try {
          let accessToken = decrypt(account.access_token)

          // Google access tokens live ~1 hour — refresh if within 5 minutes of expiry
          const expiryMs = account.token_expiry ? new Date(account.token_expiry).getTime() : 0
          const fiveMinutesMs = 5 * 60 * 1000
          const shouldRefresh = expiryMs - Date.now() < fiveMinutesMs

          if (shouldRefresh) {
            if (!account.refresh_token) {
              logger.error(`Account ${account.id} has no refresh_token — cannot refresh expired access token`)
              await supabase
                .from('digital_ad_accounts')
                .update({
                  sync_status: 'error',
                  last_error:  'Access token expired and no refresh token is stored — reconnect Google Ads',
                  updated_at:  new Date().toISOString(),
                })
                .eq('id', account.id)
              return
            }

            const refreshRes = await fetch(TOKEN_URL, {
              method:  'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                grant_type:    'refresh_token',
                client_id:     process.env.GOOGLE_ADS_CLIENT_ID ?? '',
                client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET ?? '',
                refresh_token: decrypt(account.refresh_token),
              }),
            })

            const refreshData = await refreshRes.json() as TokenRefreshResponse
            if (!refreshRes.ok || !refreshData.access_token) {
              const msg = refreshData.error_description ?? refreshData.error ?? `HTTP ${refreshRes.status}`
              logger.error(`Failed to refresh Google token for account ${account.id}: ${msg}`)
              await supabase
                .from('digital_ad_accounts')
                .update({
                  sync_status: 'error',
                  last_error:  `Token refresh failed: ${String(msg).slice(0, 500)}`,
                  updated_at:  new Date().toISOString(),
                })
                .eq('id', account.id)
              return
            }

            accessToken = refreshData.access_token
            const newExpiry = new Date(Date.now() + (refreshData.expires_in ?? 3600) * 1000).toISOString()

            await supabase
              .from('digital_ad_accounts')
              .update({
                access_token: encrypt(accessToken),
                token_expiry: newExpiry,
                updated_at:   new Date().toISOString(),
              })
              .eq('id', account.id)

            logger.info(`Refreshed Google token for account ${account.id}`)
          }

          if (!account.ad_account_id) {
            logger.warn(`Account ${account.id} has no ad_account_id, skipping performance fetch`)
            return
          }

          const searchRes = await fetch(
            `${ADS_API}/customers/${account.ad_account_id}/googleAds:searchStream`,
            {
              method:  'POST',
              headers: {
                Authorization:     `Bearer ${accessToken}`,
                'developer-token': developerToken,
                'Content-Type':    'application/json',
              },
              body: JSON.stringify({ query: GAQL_QUERY }),
            },
          )

          if (!searchRes.ok) {
            const errText = await searchRes.text()
            logger.error(`Google Ads searchStream error for account ${account.id}: ${errText}`)
            await supabase
              .from('digital_ad_accounts')
              .update({
                sync_status: 'error',
                last_error:  `Performance fetch failed: ${errText.slice(0, 500)}`,
                updated_at:  new Date().toISOString(),
              })
              .eq('id', account.id)
            return
          }

          // searchStream returns an array of result batches — flatten into one row list
          const rawBody = await searchRes.text()
          let batches: SearchStreamBatch[] = []
          try {
            const parsed = JSON.parse(rawBody) as SearchStreamBatch | SearchStreamBatch[]
            batches = Array.isArray(parsed) ? parsed : [parsed]
          } catch {
            logger.error(`Failed to parse searchStream response for account ${account.id}`)
            await supabase
              .from('digital_ad_accounts')
              .update({
                sync_status: 'error',
                last_error:  'Failed to parse Google Ads API response',
                updated_at:  new Date().toISOString(),
              })
              .eq('id', account.id)
            return
          }

          const results: GaqlResultRow[] = batches.flatMap(b => b.results ?? [])

          const rows = results.map(result => {
            const spend       = toNumber(result.metrics?.costMicros) / MICROS
            const impressions = Math.round(toNumber(result.metrics?.impressions))
            const clicks      = Math.round(toNumber(result.metrics?.clicks))
            // Google returns ctr as a decimal fraction already — no /100 needed
            const ctr         = toNumber(result.metrics?.ctr)
            const cpm         = toNumber(result.metrics?.averageCpm) / MICROS
            const cpc         = toNumber(result.metrics?.averageCpc) / MICROS
            // Google conversions can be fractional — column is bigint, so round
            const conversions = Math.round(toNumber(result.metrics?.conversions))
            const cpa         = conversions > 0 ? spend / conversions : null

            return {
              brand_id:      account.brand_id,
              account_id:    account.id,
              platform:      'google',
              date:          result.segments?.date ?? new Date().toISOString().slice(0, 10),
              campaign_id:   result.campaign?.id != null ? String(result.campaign.id) : null,
              campaign_name: result.campaign?.name ?? null,
              // Google's ad_group maps onto Meta's adset in this schema
              adset_id:      result.adGroup?.id != null ? String(result.adGroup.id) : null,
              adset_name:    result.adGroup?.name ?? null,
              spend,
              impressions,
              reach:         0,     // Google Ads doesn't report reach like Meta — don't invent it
              clicks,
              ctr:           ctr || null,
              cpm:           cpm || null,
              cpc:           cpc || null,
              cpa,
              frequency:     null,  // not reported the same way as Meta
              video_views:   null,  // not part of this ad_group-level query
              conversions,
              objective:     null,  // Google campaign types don't map onto Meta objectives
              actions:       null,
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
              logger.error(`Failed to upsert Google Ads rows for account ${account.id}: ${upsertErr.message}`)
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
          logger.info(`Synced Google Ads for account ${account.id}: ${rows.length} rows upserted`)
        } catch (err) {
          logger.error(`Failed to sync Google account ${account.id}: ${String(err)}`)

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
