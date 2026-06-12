import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { inngest } from '@/lib/inngest/client'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: brand } = await supabase.from('brands').select('id').limit(1).single()
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

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
  try {
    await inngest.send({
      name: 'brandpulse/crawl.requested',
      data: { triggeredBy: user.id, runId: runId ?? undefined },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[trigger] inngest.send failed:', msg)
    // Mark the run as errored if we created one
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

  return NextResponse.json({ ok: true, runId })
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
