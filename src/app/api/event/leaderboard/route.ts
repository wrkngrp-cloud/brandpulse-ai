import { type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return Response.json({ error: 'Missing token' }, { status: 400 })

  const service = await createServiceClient()

  const { data: ambassador } = await service
    .from('event_ambassadors')
    .select('id, event_id')
    .eq('session_token', token)
    .single()

  if (!ambassador) return Response.json({ error: 'Invalid token' }, { status: 401 })

  const [{ data: ambassadors }, { data: interactions }] = await Promise.all([
    service.from('event_ambassadors').select('id, name').eq('event_id', ambassador.event_id),
    service.from('event_interactions').select('ambassador_id, interaction_type').eq('event_id', ambassador.event_id),
  ])

  const counts: Record<string, Record<string, number>> = {}
  for (const ia of (interactions ?? [])) {
    if (!ia.ambassador_id) continue
    counts[ia.ambassador_id] ??= {}
    counts[ia.ambassador_id][ia.interaction_type] = (counts[ia.ambassador_id][ia.interaction_type] ?? 0) + 1
  }

  const leaderboard = (ambassadors ?? [])
    .map(a => ({
      id:      a.id,
      name:    a.name,
      total:   Object.values(counts[a.id] ?? {}).reduce((s, n) => s + n, 0),
      leads:   counts[a.id]?.new_lead ?? 0,
      engaged: counts[a.id]?.engaged  ?? 0,
    }))
    .sort((a, b) => b.total - a.total)

  return Response.json({ leaderboard, myId: ambassador.id })
}
