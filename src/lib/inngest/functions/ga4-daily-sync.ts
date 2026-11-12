import { inngest } from '@/lib/inngest/client'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchGa4Daily, saveGa4Daily } from '@/lib/ga4/report'
import { ga4AccessToken, type Ga4ConnectionRow } from '@/lib/shared-access/ga4-token'

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

          const read = await fetchGa4Daily(connection.property_id, accessToken, 30)
          if (!read.ok) {
            logger.error(`GA4 API error for connection ${connection.id}: ${read.error}`)
            return
          }
          // Saves by day, and only stamps "synced" when the save worked. The
          // old upsert targeted a constraint sdk_events does not have, so it
          // failed every night while the stamp said all was well.
          const saveError = await saveGa4Daily(supabase, connection.brand_id, connection.id, read.days)
          if (saveError) {
            logger.error(`GA4 save failed for connection ${connection.id}: ${saveError}`)
            return
          }
          processed++
          logger.info(`Synced GA4 for brand ${connection.brand_id}: ${read.days.length} days`)
        } catch (err) {
          logger.error(`Failed to sync GA4 connection ${connection.id}: ${String(err)}`)
        }
      })
    }

    return { processed }
  }
)
