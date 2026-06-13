import { type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    sessionToken: string
    answers: Record<string, unknown>
  }

  const { sessionToken, answers } = body

  if (!sessionToken || !answers) {
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

  const { error } = await service.from('event_intercept_responses').insert({
    event_id:      ambassador.event_id,
    ambassador_id: ambassador.id,
    answers,
  })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
