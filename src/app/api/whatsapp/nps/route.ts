import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const Body = z.object({
  phones:   z.array(z.string().min(6)).min(1).max(200),
  surveyId: z.string().uuid().optional(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.AFRICAS_TALKING_API_KEY) {
    return NextResponse.json({ error: 'WhatsApp API not configured.' }, { status: 503 })
  }

  const parsed = Body.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { data: brand } = await supabase.from('brands').select('id, name, workspace_id').limit(1).maybeSingle()
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const message = `Hi! ${brand.name} wants to know — on a scale of 0 to 10, how likely are you to recommend us to a friend or colleague?\n\nReply with just a number (0-10). 0 = Not at all likely, 10 = Extremely likely.\n\nThank you! 🙏`

  const { phones, surveyId } = parsed.data
  const service = await createServiceClient()
  let sent = 0
  let failed = 0

  for (let i = 0; i < phones.length; i += 20) {
    const batch = phones.slice(i, i + 20)
    try {
      const res = await fetch('https://content.africastalking.com/version1/messaging/whatsapp', {
        method: 'POST',
        headers: {
          'apiKey':       process.env.AFRICAS_TALKING_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: process.env.AFRICAS_TALKING_USERNAME ?? 'sandbox',
          to:       batch,
          message,
          from:     process.env.AFRICAS_TALKING_WHATSAPP_SENDER,
        }),
      })

      if (res.ok) {
        const body = await res.json().catch(() => null) as { SMSMessageData?: { Recipients?: { number: string; status: string; messageId?: string }[] } } | null
        const recipients = body?.SMSMessageData?.Recipients ?? []

        for (const r of recipients) {
          if (r.status === 'Success') {
            sent++
            // Track the send so the webhook can match replies
            await service.from('whatsapp_nps_sends').insert({
              workspace_id: brand.workspace_id,
              brand_id:     brand.id,
              to_number:    r.number,
              survey_id:    surveyId ?? null,
              message_id:   r.messageId ?? null,
            })
          } else {
            failed++
          }
        }

        if (!recipients.length) {
          sent += batch.length
          for (const phone of batch) {
            await service.from('whatsapp_nps_sends').insert({
              workspace_id: brand.workspace_id,
              brand_id:     brand.id,
              to_number:    phone,
              survey_id:    surveyId ?? null,
            })
          }
        }
      } else {
        failed += batch.length
      }
    } catch {
      failed += batch.length
    }
  }

  return NextResponse.json({ sent, failed })
}
