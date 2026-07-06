import { inngest } from '@/lib/inngest/client'
import { createServiceClient } from '@/lib/supabase/server'
import { decrypt, encrypt } from '@/lib/crypto'

/**
 * HubSpot daily sync (6:30 AM Lagos — deliberately AFTER the 6 AM
 * commercial-metrics-rollup run).
 *
 * Both jobs can write metric_manual's mql_count for the same brand+period:
 * the rollup writes a pixel-based lead count as a fallback; this job writes
 * the real HubSpot lifecycle-stage count when a connection exists. Running
 * second means HubSpot's real number naturally wins via the shared
 * onConflict 'brand_id,metric_key,period_start' upsert key — no special-case
 * logic anywhere. Do not move this cron before 6 AM.
 *
 * Read-only: we only count contacts whose lifecyclestage is
 * 'marketingqualifiedlead' created in the current calendar month. We never
 * write anything back to HubSpot, and we never upsert a count unless the
 * HubSpot API call actually succeeded (a false zero would stomp a real or
 * pixel-based count).
 */

const HUBSPOT_TOKEN_URL  = 'https://api.hubapi.com/oauth/v1/token'
const HUBSPOT_SEARCH_URL = 'https://api.hubapi.com/crm/v3/objects/contacts/search'

interface HubSpotConnectionRow {
  id:            string
  brand_id:      string
  access_token:  string
  refresh_token: string | null
  token_expiry:  string | null
}

interface TokenRefreshResponse {
  access_token:  string
  refresh_token?: string
  expires_in:    number
  error?:        string
  error_description?: string
}

interface ContactSearchResponse {
  total?: number
}

export const hubspotDailySync = inngest.createFunction(
  {
    id:   'hubspot-daily-sync',
    name: 'HubSpot MQL daily sync (6:30 AM Lagos)',
    triggers: [{ cron: 'TZ=Africa/Lagos 30 6 * * *' }],
  },
  async ({ step, logger }) => {
    const supabase = await createServiceClient()

    const { data: connections } = await supabase
      .from('hubspot_connections')
      .select('id, brand_id, access_token, refresh_token, token_expiry')

    if (!connections?.length) {
      logger.info('No HubSpot connections to sync')
      return { processed: 0 }
    }

    // Current calendar month bounds (same convention as commercial-metrics-rollup)
    const today       = new Date()
    const periodStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
    const periodEnd   = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]
    // Exclusive upper bound (first day of next month) for the createdate filter
    const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString().split('T')[0]

    let processed = 0

    for (const connection of connections as HubSpotConnectionRow[]) {
      await step.run(`sync-hubspot-${connection.id}`, async () => {
        const recordError = async (message: string) => {
          logger.error(`HubSpot sync failed for brand ${connection.brand_id}: ${message}`)
          await supabase
            .from('hubspot_connections')
            .update({
              last_error: message.slice(0, 500),
              updated_at: new Date().toISOString(),
            })
            .eq('id', connection.id)
        }

        try {
          let accessToken = decrypt(connection.access_token)

          // Refresh the token if it expires within 5 minutes (or already has)
          const fiveMinutesMs = 5 * 60 * 1000
          const needsRefresh  =
            !connection.token_expiry ||
            new Date(connection.token_expiry).getTime() - Date.now() < fiveMinutesMs

          if (needsRefresh) {
            if (!connection.refresh_token) {
              await recordError('Access token expired and no refresh token is stored')
              return
            }
            if (!process.env.HUBSPOT_CLIENT_ID || !process.env.HUBSPOT_CLIENT_SECRET) {
              await recordError('HubSpot client credentials are not configured on this server')
              return
            }

            const refreshRes = await fetch(HUBSPOT_TOKEN_URL, {
              method:  'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body:    new URLSearchParams({
                grant_type:    'refresh_token',
                client_id:     process.env.HUBSPOT_CLIENT_ID,
                client_secret: process.env.HUBSPOT_CLIENT_SECRET,
                refresh_token: decrypt(connection.refresh_token),
              }),
            })

            const refreshed = (await refreshRes.json()) as TokenRefreshResponse
            if (!refreshRes.ok || refreshed.error || !refreshed.access_token) {
              await recordError(
                `Token refresh failed: ${refreshed.error_description ?? refreshed.error ?? refreshRes.status}`
              )
              return
            }

            accessToken = refreshed.access_token
            await supabase
              .from('hubspot_connections')
              .update({
                access_token:  encrypt(refreshed.access_token),
                refresh_token: refreshed.refresh_token
                  ? encrypt(refreshed.refresh_token)
                  : connection.refresh_token,
                token_expiry:  new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
                updated_at:    new Date().toISOString(),
              })
              .eq('id', connection.id)

            logger.info(`Refreshed HubSpot token for connection ${connection.id}`)
          }

          // Count MQL contacts created this calendar month. limit: 1 because
          // we only need the `total` field — the CRM v3 search API returns
          // the full match count regardless of limit.
          const searchRes = await fetch(HUBSPOT_SEARCH_URL, {
            method:  'POST',
            headers: {
              'Content-Type':  'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              filterGroups: [
                {
                  filters: [
                    { propertyName: 'lifecyclestage', operator: 'EQ',  value: 'marketingqualifiedlead' },
                    { propertyName: 'createdate',     operator: 'GTE', value: String(new Date(`${periodStart}T00:00:00Z`).getTime()) },
                    { propertyName: 'createdate',     operator: 'LT',  value: String(new Date(`${nextMonthStart}T00:00:00Z`).getTime()) },
                  ],
                },
              ],
              limit: 1,
            }),
          })

          if (!searchRes.ok) {
            const errText = await searchRes.text()
            await recordError(`Contact search failed (${searchRes.status}): ${errText.slice(0, 300)}`)
            return
          }

          const searchData = (await searchRes.json()) as ContactSearchResponse
          const total = searchData.total

          if (typeof total !== 'number' || total < 0) {
            await recordError('Contact search returned no total count')
            return
          }

          // Only reached on a successful API call — safe to upsert.
          const { error: upsertErr } = await supabase.from('metric_manual').upsert(
            {
              brand_id:     connection.brand_id,
              metric_key:   'mql_count',
              value:        total,
              currency:     'NGN',
              period_start: periodStart,
              period_end:   periodEnd,
              notes:        'Auto-synced from HubSpot lifecycle stage',
              entered_by:   null,
              updated_at:   new Date().toISOString(),
            },
            { onConflict: 'brand_id,metric_key,period_start' }
          )

          if (upsertErr) {
            await recordError(`metric_manual upsert failed: ${upsertErr.message}`)
            return
          }

          await supabase
            .from('hubspot_connections')
            .update({
              last_synced_at: new Date().toISOString(),
              last_error:     null,
              updated_at:     new Date().toISOString(),
            })
            .eq('id', connection.id)

          processed++
          logger.info(`Synced HubSpot MQL count for brand ${connection.brand_id}: ${total}`)
        } catch (err) {
          await recordError(String(err))
        }
      })
    }

    return { processed }
  }
)
