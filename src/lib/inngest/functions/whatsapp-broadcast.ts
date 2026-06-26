import { inngest } from '../client'
import { createServiceClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID ?? ''
const ACCESS_TOKEN    = process.env.WHATSAPP_ACCESS_TOKEN    ?? ''
const DAILY_LIMIT     = 1000
const BATCH_SIZE      = 50

interface Contact {
  id: string
  phone_e164: string
  name: string | null
}

async function sendTemplate(
  phone: string,
  templateName: string,
  templateLanguage: string,
  templateVars?: Record<string, string> | null,
): Promise<{ wamid: string | null; error: string | null }> {
  const components: unknown[] = []

  // Build body component if template has variables
  if (templateVars && Object.keys(templateVars).length > 0) {
    components.push({
      type: 'body',
      parameters: Object.values(templateVars).map(v => ({ type: 'text', text: v })),
    })
  }

  const payload = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: templateLanguage },
      ...(components.length > 0 ? { components } : {}),
    },
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    )
    const data = await res.json() as { messages?: Array<{ id: string }>; error?: { message: string } }
    if (data.error) return { wamid: null, error: data.error.message }
    return { wamid: data.messages?.[0]?.id ?? null, error: null }
  } catch (err) {
    return { wamid: null, error: String(err) }
  }
}

export const whatsappBroadcast = inngest.createFunction(
  {
    id: 'whatsapp-broadcast',
    name: 'WhatsApp Broadcast Send',
    triggers: [{ event: 'whatsapp/broadcast.send' }],
    concurrency: { limit: 1 },
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: { event: any; step: any }) => {
    const { campaignId, brandId } = event.data as { campaignId: string; brandId: string }
    const service = await createServiceClient()

    // Check daily send count against 1,000 limit
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { count: sentToday } = await step.run('check-daily-limit', async () =>
      service
        .from('whatsapp_send_log')
        .select('id', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .gte('sent_at', todayStart.toISOString())
    )

    const dailySent = sentToday ?? 0
    if (dailySent >= DAILY_LIMIT) {
      await service.from('whatsapp_campaigns')
        .update({ status: 'failed', completed_at: new Date().toISOString() })
        .eq('id', campaignId)
      return { error: 'Daily limit of 1,000 messages reached' }
    }

    // Fetch campaign details
    const { data: campaign } = await step.run('fetch-campaign', async () =>
      service.from('whatsapp_campaigns')
        .select('template_name, template_language, template_vars')
        .eq('id', campaignId)
        .single()
    )
    if (!campaign) return { error: 'Campaign not found' }

    // Fetch opted-in contacts in pages
    let offset = 0
    let totalSent = 0
    const remaining = DAILY_LIMIT - dailySent

    while (true) {
      const contacts = await step.run(`fetch-contacts-batch-${offset}`, async () => {
        const { data } = await service
          .from('whatsapp_contacts')
          .select('id, phone_e164, name')
          .eq('brand_id', brandId)
          .eq('whatsapp_opted_in', true)
          .range(offset, offset + BATCH_SIZE - 1)
        return (data ?? []) as Contact[]
      })

      if (contacts.length === 0) break
      if (totalSent >= remaining) break

      await step.run(`send-batch-${offset}`, async () => {
        for (const contact of contacts) {
          if (totalSent >= remaining) break

          const vars = campaign.template_vars
            ? { ...campaign.template_vars, name: contact.name ?? 'there' }
            : null

          const { wamid, error } = await sendTemplate(
            contact.phone_e164,
            campaign.template_name,
            campaign.template_language,
            vars,
          )

          const recipientHash = createHash('sha256').update(contact.phone_e164).digest('hex')

          await service.from('whatsapp_send_log').insert({
            campaign_id:     campaignId,
            brand_id:        brandId,
            recipient_hash:  recipientHash,
            wamid:           wamid ?? null,
            status:          error ? 'failed' : 'sent',
            error_code:      error ?? null,
            sent_at:         error ? null : new Date().toISOString(),
          })

          if (!error) totalSent++

          // Respect Meta's rate limit — 80 messages/second max, ~15ms per message
          await new Promise(r => setTimeout(r, 15))
        }
      })

      offset += BATCH_SIZE
      if (contacts.length < BATCH_SIZE) break
    }

    await service.from('whatsapp_campaigns')
      .update({ status: 'sent', sent: totalSent, completed_at: new Date().toISOString() })
      .eq('id', campaignId)

    return { sent: totalSent }
  }
)
