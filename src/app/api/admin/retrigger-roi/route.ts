import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { inngest }             from '@/lib/inngest/client'

export const runtime    = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  // Simple secret guard so this can't be called by accident
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = await createServiceClient()

  // Find all events stuck in 'closed' with no ROI report yet
  const { data: closedEvents, error } = await service
    .from('events')
    .select('id, name, city')
    .eq('status', 'closed')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!closedEvents?.length) {
    return NextResponse.json({ message: 'No closed events found', triggered: 0 })
  }

  // Filter out any that already have a report (edge case)
  const { data: existingReports } = await service
    .from('event_roi_reports')
    .select('event_id')
    .in('event_id', closedEvents.map(e => e.id))

  const reportedIds = new Set((existingReports ?? []).map(r => r.event_id))
  const toRetrigger = closedEvents.filter(e => !reportedIds.has(e.id))

  if (!toRetrigger.length) {
    return NextResponse.json({ message: 'All closed events already have reports', triggered: 0 })
  }

  // Fire Inngest for each stuck event
  await Promise.all(
    toRetrigger.map(e =>
      inngest.send({ name: 'brandgauge/event.closed', data: { eventId: e.id } })
    )
  )

  return NextResponse.json({
    triggered: toRetrigger.length,
    events:    toRetrigger.map(e => ({ id: e.id, name: e.name, city: e.city })),
  })
}
