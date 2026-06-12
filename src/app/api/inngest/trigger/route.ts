import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { inngest } from '@/lib/inngest/client'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: brand } = await supabase.from('brands').select('id').limit(1).single()
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  // Service client bypasses RLS — Inngest (not the browser user) owns these rows
  const service = await createServiceClient()
  const { data: run, error } = await service
    .from('crawl_runs')
    .insert({ brand_id: brand.id, trigger_type: 'manual', status: 'running' })
    .select('id')
    .single()

  if (error || !run) {
    return NextResponse.json({ error: 'Failed to create run record' }, { status: 500 })
  }

  await inngest.send({
    name: 'brandpulse/crawl.requested',
    data: { triggeredBy: user.id, runId: run.id },
  })

  return NextResponse.json({ ok: true, runId: run.id })
}
