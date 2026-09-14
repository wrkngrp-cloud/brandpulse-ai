import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { inngest }             from '@/lib/inngest/client'
import { timingSafeEqual }     from 'crypto'

export const runtime    = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  // The secret arrives as a header, not a query parameter. Web addresses are
  // written to server, proxy and CDN logs as a matter of course, so a secret in
  // the query string ends up sitting in log files long after the call.
  const expected = process.env.ADMIN_SECRET
  if (!expected) {
    // Fail closed: an unset secret must never mean an open endpoint.
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const provided = req.headers.get('x-admin-secret') ?? ''
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
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
