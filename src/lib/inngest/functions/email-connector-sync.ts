import { inngest } from '../client'
import { createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'

interface MailchimpCampaign {
  id: string
  settings?: { title?: string; subject_line?: string }
  send_time?: string
  recipients?: { recipient_count?: number }
  report_summary?: {
    open_rate?: number
    click_rate?: number
  }
  tracking?: { opens?: boolean }
}

interface MailchimpResponse {
  campaigns?: MailchimpCampaign[]
  error_code?: string
  detail?: string
}

interface BrevoEmailCampaign {
  id: number
  name: string
  sentDate?: string
  statistics?: {
    globalStats?: {
      recipients?: number
      openRate?: number
      clickRate?: number
      unsubscriptions?: number
    }
  }
}

interface BrevoResponse {
  campaigns?: BrevoEmailCampaign[]
}

export const emailConnectorSync = inngest.createFunction(
  {
    id: 'email-connector-sync',
    name: 'Email connector sync (daily 7 AM Lagos)',
    triggers: [
      { cron: 'TZ=Africa/Lagos 0 7 * * *' },
      { event: 'brandpulse/email-connectors.sync-requested' },
    ],
    concurrency: { limit: 3 },
  },
  async ({ step, logger }) => {
    const supabase = await createServiceClient()

    const { data: connectors } = await supabase
      .from('email_connectors')
      .select('id, brand_id, provider, api_key, list_id')

    if (!connectors?.length) {
      logger.info('No email connectors configured')
      return { processed: 0 }
    }

    let processed = 0

    for (const connector of connectors) {
      await step.run(`sync-${connector.id}`, async () => {
        try {
          const apiKey = decrypt(connector.api_key)

          if (connector.provider === 'mailchimp') {
            await syncMailchimp(supabase, connector.brand_id, apiKey, connector.list_id, logger)
          } else if (connector.provider === 'brevo') {
            await syncBrevo(supabase, connector.brand_id, apiKey, logger)
          }

          await supabase
            .from('email_connectors')
            .update({ last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('id', connector.id)

          processed++
        } catch (err) {
          logger.error(`Failed to sync email connector ${connector.id}: ${String(err)}`)
        }
      })
    }

    return { processed }
  }
)

async function syncMailchimp(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  brandId: string,
  apiKey: string,
  listId: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logger: any
) {
  // Mailchimp API key format: key-dcXX (data center in the key)
  const dc = apiKey.split('-').pop() ?? 'us1'

  const params = new URLSearchParams({
    count: '25',
    status: 'sent',
    sort_field: 'send_time',
    sort_dir: 'DESC',
  })
  if (listId) params.set('list_id', listId)

  const res = await fetch(
    `https://${dc}.api.mailchimp.com/3.0/campaigns?${params}`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`anystring:${apiKey}`).toString('base64')}`,
      },
    }
  )

  if (!res.ok) {
    logger.error(`Mailchimp API error: ${res.status}`)
    return
  }

  const data = (await res.json()) as MailchimpResponse

  if (!data.campaigns?.length) return

  const rows = data.campaigns.map((c: MailchimpCampaign) => ({
    brand_id:         brandId,
    provider:         'mailchimp',
    campaign_id:      c.id,
    campaign_name:    c.settings?.title ?? c.settings?.subject_line ?? c.id,
    send_date:        c.send_time ? c.send_time.slice(0, 10) : null,
    recipients:       c.recipients?.recipient_count ?? null,
    open_rate:        c.report_summary?.open_rate != null
      ? Math.round(c.report_summary.open_rate * 100 * 100) / 100
      : null,
    click_rate:       c.report_summary?.click_rate != null
      ? Math.round(c.report_summary.click_rate * 100 * 100) / 100
      : null,
    unsubscribe_rate: null,
    synced_at:        new Date().toISOString(),
  }))

  await supabase
    .from('email_campaign_snapshots')
    .upsert(rows, { onConflict: 'brand_id,provider,campaign_id' })
}

async function syncBrevo(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  brandId: string,
  apiKey: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logger: any
) {
  const res = await fetch(
    'https://api.brevo.com/v3/emailCampaigns?status=sent&limit=25&sort=desc',
    {
      headers: {
        'api-key': apiKey,
        Accept: 'application/json',
      },
    }
  )

  if (!res.ok) {
    logger.error(`Brevo API error: ${res.status}`)
    return
  }

  const data = (await res.json()) as BrevoResponse

  if (!data.campaigns?.length) return

  const rows = data.campaigns.map((c: BrevoEmailCampaign) => {
    const stats = c.statistics?.globalStats
    const recip = stats?.recipients ?? null
    const unsubs = stats?.unsubscriptions ?? null
    return {
      brand_id:         brandId,
      provider:         'brevo',
      campaign_id:      String(c.id),
      campaign_name:    c.name,
      send_date:        c.sentDate ? c.sentDate.slice(0, 10) : null,
      recipients:       recip,
      open_rate:        stats?.openRate != null ? Math.round(stats.openRate * 100) / 100 : null,
      click_rate:       stats?.clickRate != null ? Math.round(stats.clickRate * 100) / 100 : null,
      unsubscribe_rate: recip && unsubs ? Math.round((unsubs / recip) * 10000) / 100 : null,
      synced_at:        new Date().toISOString(),
    }
  })

  await supabase
    .from('email_campaign_snapshots')
    .upsert(rows, { onConflict: 'brand_id,provider,campaign_id' })
}
