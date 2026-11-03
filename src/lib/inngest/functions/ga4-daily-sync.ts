import { inngest } from '@/lib/inngest/client'
import { createServiceClient } from '@/lib/supabase/server'
import { ga4AccessToken, type Ga4ConnectionRow } from '@/lib/shared-access/ga4-token'

interface GA4MetricValue {
  value: string
}

interface GA4Row {
  metricValues: GA4MetricValue[]
}

interface GA4Response {
  totals?: GA4Row[]
  error?: { message: string; code: number }
}

export const ga4DailySync = inngest.createFunction(
  {
    id: 'ga4-daily-sync',
    name: 'GA4 daily sync (6 AM Lagos)',
    triggers: [{ cron: 'TZ=Africa/Lagos 0 6 * * *' }],
  },
  async ({ step, logger }) => {
    const supabase = await createServiceClient()

    // The shared-access columns, falling back to the older shape until that
    // migration is applied, so the sync never stops for want of a column.
    type Row = Ga4ConnectionRow & { brand_id: string; property_id: string }
    const first = await supabase
      .from('ga4_connections')
      .select('id, brand_id, property_id, access_token, refresh_token, token_expiry, auth_mode, access_status')
      .returns<Row[]>()
    let connections = first.data
    if (first.error) {
      ;({ data: connections } = await supabase
        .from('ga4_connections')
        .select('id, brand_id, property_id, access_token, refresh_token, token_expiry')
        .returns<Row[]>())
    }

    if (!connections?.length) {
      logger.info('No GA4 connections to sync')
      return { processed: 0 }
    }

    let processed = 0

    for (const connection of connections) {
      await step.run(`sync-${connection.id}`, async () => {
        try {
          // A shared connection still waiting for BrandGauge's check reads
          // nothing. ga4AccessToken returns null for it.
          const accessToken = await ga4AccessToken(connection, supabase)
          if (!accessToken) {
            logger.info(`GA4 connection ${connection.id} skipped: no usable token or not yet approved`)
            return
          }

          const ga4Res = await fetch(
            `https://analyticsdata.googleapis.com/v1beta/properties/${connection.property_id}:runReport`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
                metrics: [
                  { name: 'sessions' },
                  { name: 'activeUsers' },
                  { name: 'conversions' },
                ],
              }),
            }
          )

          if (!ga4Res.ok) {
            const errText = await ga4Res.text()
            logger.error(`GA4 API error for connection ${connection.id}: ${errText}`)
            return
          }

          const ga4Data = (await ga4Res.json()) as GA4Response

          if (ga4Data.error) {
            logger.error(`GA4 API error for connection ${connection.id}: ${ga4Data.error.message}`)
            return
          }

          const totals = ga4Data.totals?.[0]?.metricValues ?? []
          const sessions    = Number(totals[0]?.value ?? 0)
          const activeUsers = Number(totals[1]?.value ?? 0)
          const conversions = Number(totals[2]?.value ?? 0)

          await supabase
            .from('sdk_events')
            .upsert(
              {
                brand_id:    connection.brand_id,
                event_type:  'ga4_sessions',
                value:       sessions,
                metadata:    { activeUsers, conversions },
                occurred_at: new Date().toISOString(),
              },
              { onConflict: 'brand_id,event_type' }
            )

          await supabase
            .from('ga4_connections')
            .update({ last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('id', connection.id)

          processed++
          logger.info(`Synced GA4 for brand ${connection.brand_id}: sessions=${sessions}`)
        } catch (err) {
          logger.error(`Failed to sync GA4 connection ${connection.id}: ${String(err)}`)
        }
      })
    }

    return { processed }
  }
)
