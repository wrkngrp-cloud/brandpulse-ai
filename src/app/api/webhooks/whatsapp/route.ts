import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import crypto from 'node:crypto'

export const runtime = 'nodejs'

// Africa's Talking does not sign its webhooks, so we authenticate inbound calls
// with a shared secret carried in the callback URL (?key=…) or an x-webhook-secret
// header. Without this, anyone could POST fake NPS replies and inbound messages.
// Register the callback as: /api/webhooks/whatsapp?key=<WHATSAPP_INBOUND_SECRET>
function verifyInboundSecret(request: NextRequest): boolean {
  const expected = process.env.WHATSAPP_INBOUND_SECRET
  if (!expected) return false // fail closed: no secret configured → reject
  const provided =
    request.nextUrl.searchParams.get('key') ??
    request.headers.get('x-webhook-secret') ??
    ''
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// Africa's Talking WhatsApp inbound webhook
// Registers at: https://dashboard.africastalking.com → SMS → Callback URL → /api/webhooks/whatsapp
export async function POST(request: NextRequest) {
  if (!verifyInboundSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    const text = await request.text()
    // AT sends form-encoded OR JSON depending on the channel
    if (request.headers.get('content-type')?.includes('application/json')) {
      body = JSON.parse(text)
    } else {
      body = Object.fromEntries(new URLSearchParams(text))
    }
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const fromNumber = (body['from'] ?? body['From']) as string | undefined
  const messageText = (body['text'] ?? body['Body'] ?? body['message']) as string | undefined
  const messageId   = (body['messageId'] ?? body['MessageSid']) as string | undefined

  if (!fromNumber) return NextResponse.json({ ok: true }) // silently accept

  const supabase = await createServiceClient()

  // Check if this is a reply to an NPS send (number is in whatsapp_nps_sends and hasn't replied yet)
  const { data: pendingNps } = await supabase
    .from('whatsapp_nps_sends')
    .select('id, brand_id, workspace_id, survey_id')
    .eq('to_number', fromNumber)
    .is('replied_at', null)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let npsScore: number | null = null
  if (pendingNps && messageText) {
    const trimmed = messageText.trim()
    const parsed  = parseInt(trimmed, 10)
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 10) {
      npsScore = parsed
      // Mark NPS send as replied
      await supabase.from('whatsapp_nps_sends').update({
        replied_at: new Date().toISOString(),
        nps_score:  npsScore,
      }).eq('id', pendingNps.id)

      // Store in survey_responses if linked to a survey
      // survey_responses has: survey_id, answers, source, quality_flag
      // It does NOT have brand_id, workspace_id, or channel columns
      if (pendingNps.survey_id) {
        await supabase.from('survey_responses').insert({
          survey_id:   pendingNps.survey_id,
          answers:     { q1: npsScore },
          source:      'whatsapp',
          quality_flag: 'ok',
        })
      }
    }
  }

  // Log the inbound message
  await supabase.from('whatsapp_inbound').insert({
    workspace_id:  pendingNps?.workspace_id ?? null,
    brand_id:      pendingNps?.brand_id ?? null,
    from_number:   fromNumber,
    message_text:  messageText ?? null,
    message_id:    messageId ?? null,
    survey_id:     pendingNps?.survey_id ?? null,
    nps_score:     npsScore,
    raw_payload:   body,
  })

  return NextResponse.json({ ok: true })
}

// AT also sends GET for webhook verification
export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get('hub.challenge')
  if (challenge) return new Response(challenge, { status: 200 })
  return NextResponse.json({ ok: true })
}
