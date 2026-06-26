import { NextResponse } from 'next/server'
import { getActiveBrandId } from '@/lib/active-brand'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { inngest } from '@/lib/inngest/client'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No active brand' }, { status: 404 })
  const brand = { id: brandId }

  // Create run record for progress tracking
  let runId: string | null = null
  try {
    const service = await createServiceClient()
    const { data: run, error } = await service
      .from('crawl_runs')
      .insert({ brand_id: brand.id, trigger_type: 'manual', status: 'running' })
      .select('id')
      .single()
    if (error) console.error('[trigger] crawl_runs insert error:', error.message)
    else runId = run.id
  } catch (err) {
    console.error('[trigger] crawl_runs error:', String(err))
  }

  // Send event — surface any error rather than swallowing it
  let sendResult: { ids: string[] } | null = null
  try {
    sendResult = await inngest.send({
      name: 'brandpulse/crawl.requested',
      data: { triggeredBy: user.id, runId: runId ?? undefined },
    })
    console.log('[trigger] inngest.send result:', JSON.stringify(sendResult))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[trigger] inngest.send failed:', msg)
    if (runId) {
      const service = await createServiceClient()
      await service.from('crawl_runs').update({
        status: 'error',
        error_message: `Event dispatch failed: ${msg}`,
        completed_at: new Date().toISOString(),
      }).eq('id', runId)
    }
    return NextResponse.json({ error: `Inngest event dispatch failed: ${msg}` }, { status: 500 })
  }

  // ids empty means Inngest received the call but didn't register the event
  if (!sendResult?.ids?.length) {
    console.error('[trigger] inngest.send returned empty ids — event key may be wrong or app not synced')
    if (runId) {
      const service = await createServiceClient()
      await service.from('crawl_runs').update({
        status: 'error',
        error_message: 'Event sent but not accepted by Inngest (check event key)',
        completed_at: new Date().toISOString(),
      }).eq('id', runId)
    }
    return NextResponse.json({
      error: 'Inngest accepted the call but returned no event IDs — the event key may belong to a different app or environment than where the functions are synced.',
      sendResult,
    }, { status: 502 })
  }

  return NextResponse.json({ ok: true, runId, eventIds: sendResult.ids })
}

// Diagnostic GET — tells you exactly what keys are configured
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const eventKey  = process.env.INNGEST_EVENT_KEY
  const signingKey = process.env.INNGEST_SIGNING_KEY

  return NextResponse.json({
    eventKey:   eventKey  ? `${eventKey.slice(0, 8)}...` : 'NOT SET',
    signingKey: signingKey ? `${signingKey.slice(0, 16)}...` : 'NOT SET',
    inngestAppId: 'brandpulse-ai',
  })
}
