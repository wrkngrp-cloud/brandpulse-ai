import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { runCrawl } from '@/lib/crawl/run-crawl'

export const runtime    = 'nodejs'
export const maxDuration = 120  // 2 minutes — enough for fetch + classify + aggregate

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: brand } = await supabase.from('brands').select('id').limit(1).single()
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  // Create run record
  const service = await createServiceClient()
  const { data: run } = await service
    .from('crawl_runs')
    .insert({ brand_id: brand.id, trigger_type: 'manual', status: 'running' })
    .select('id').single()

  const runId = run?.id ?? undefined

  try {
    const result = await runCrawl(brand.id, runId)
    return NextResponse.json({ ok: true, runId, ...result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (runId) {
      await service.from('crawl_runs').update({
        status: 'error', error_message: msg,
        completed_at: new Date().toISOString(),
      }).eq('id', runId)
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
