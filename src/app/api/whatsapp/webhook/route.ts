import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'

// GET — Meta webhook verification handshake
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

// POST — delivery status callbacks + inbound replies
export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // Verify HMAC signature
  const sig = req.headers.get('x-hub-signature-256')
  if (!sig || !process.env.WHATSAPP_APP_SECRET) {
    return new NextResponse('Unauthorized', { status: 401 })
  }
  const expected = 'sha256=' + createHmac('sha256', process.env.WHATSAPP_APP_SECRET)
    .update(rawBody).digest('hex')
  const sigBuf = Buffer.from(sig)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  let body: WhatsAppWebhookPayload
  try { body = JSON.parse(rawBody) } catch { return NextResponse.json({ ok: true }) }

  const service = await createServiceClient()

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value

      // Delivery / read status updates
      for (const statusEvent of value.statuses ?? []) {
        const { id: wamid, status, timestamp } = statusEvent
        const ts = new Date(parseInt(timestamp) * 1000).toISOString()

        const update: Record<string, string> = { status }
        if (status === 'sent')      update.sent_at      = ts
        if (status === 'delivered') update.delivered_at = ts
        if (status === 'read')      update.read_at      = ts

        await service.from('whatsapp_send_log').update(update).eq('wamid', wamid)

        // Increment campaign counter
        if (['sent', 'delivered', 'read', 'failed'].includes(status)) {
          const col = status === 'delivered' ? 'delivered'
                    : status === 'read'      ? 'read_count'
                    : status === 'failed'    ? 'failed'
                    : null
          if (col) {
            const { data: row } = await service
              .from('whatsapp_send_log').select('campaign_id').eq('wamid', wamid).maybeSingle()
            if (row?.campaign_id) {
              await service.rpc('increment_whatsapp_campaign_counter', {
                p_campaign_id: row.campaign_id, p_column: col,
              })
            }
          }
        }
      }

      // Inbound messages — handle STOP opt-out
      for (const msg of value.messages ?? []) {
        if (msg.type === 'text') {
          const text = (msg.text?.body ?? '').trim().toUpperCase()
          if (text === 'STOP' || text === 'UNSUBSCRIBE') {
            const phone = '+' + msg.from
            await service.from('whatsapp_contacts')
              .update({ whatsapp_opted_in: false, opted_out_at: new Date().toISOString() })
              .eq('phone_e164', phone)
          }
        }
      }
    }
  }

  return NextResponse.json({ ok: true })
}

interface WhatsAppWebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value: {
        statuses?: Array<{ id: string; status: string; timestamp: string }>
        messages?: Array<{ from: string; type: string; text?: { body: string } }>
      }
    }>
  }>
}
