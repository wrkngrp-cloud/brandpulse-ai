import { type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    sessionToken: string
    interactionType: string
    leadName?: string
    leadPhone?: string
    leadInterest?: string
    clientUuid: string
    occurredAt?: string
  }

  const { sessionToken, interactionType, leadName, leadPhone, leadInterest, clientUuid, occurredAt } = body

  if (!sessionToken || !interactionType || !clientUuid) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const service = await createServiceClient()

  const { data: ambassador } = await service
    .from('event_ambassadors')
    .select('id, event_id')
    .eq('session_token', sessionToken)
    .single()

  if (!ambassador) {
    return Response.json({ error: 'Invalid session token' }, { status: 401 })
  }

  const { error } = await service.from('event_interactions').upsert({
    event_id:         ambassador.event_id,
    ambassador_id:    ambassador.id,
    interaction_type: interactionType,
    lead_name:        leadName    ?? null,
    lead_phone:       leadPhone   ?? null,
    lead_interest:    leadInterest ?? null,
    client_uuid:      clientUuid,
    occurred_at:      occurredAt ?? new Date().toISOString(),
  }, { onConflict: 'event_id,client_uuid' })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
