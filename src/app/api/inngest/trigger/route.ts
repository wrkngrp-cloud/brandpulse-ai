import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { inngest } from '@/lib/inngest/client'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: brand } = await supabase.from('brands').select('id').limit(1).single()
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  // Try to create a run record for progress tracking.
  // If the crawl_runs table doesn't exist yet, still fire the crawl — just without tracking.
  let runId: string | null = null
  try {
    const service = await createServiceClient()
    const { data: run, error } = await service
      .from('crawl_runs')
      .insert({ brand_id: brand.id, trigger_type: 'manual', status: 'running' })
      .select('id')
      .single()

    if (error) {
      console.error('[trigger] crawl_runs insert error:', error.message, error.code)
    } else {
      runId = run.id
    }
  } catch (err) {
    console.error('[trigger] crawl_runs table may not exist:', String(err))
  }

  await inngest.send({
    name: 'brandpulse/crawl.requested',
    data: { triggeredBy: user.id, runId: runId ?? undefined },
  })

  return NextResponse.json({ ok: true, runId })
}
