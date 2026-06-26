import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrand } from '@/lib/active-brand'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Returns high-NPS records (score ≥ 9) that haven't been activated as promoters yet
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string }>(supabase, 'id')
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  // Get existing promoter source_response_ids so we can exclude already-activated ones
  const { data: existing } = await supabase
    .from('promoters')
    .select('source_response_id')
    .eq('brand_id', brand.id)
    .not('source_response_id', 'is', null)

  const activatedIds = new Set((existing ?? []).map(p => p.source_response_id).filter(Boolean))

  const { data: npsRows } = await supabase
    .from('nps_records')
    .select('id, score, verbatim, promoter_type, created_at')
    .eq('brand_id', brand.id)
    .gte('score', 9)
    .order('created_at', { ascending: false })
    .limit(50)

  const candidates = (npsRows ?? [])
    .filter(r => !activatedIds.has(r.id))
    .map(r => ({
      id:            r.id,
      score:         r.score,
      verbatim:      r.verbatim,
      promoter_type: r.promoter_type,
      created_at:    r.created_at,
    }))

  return NextResponse.json({ candidates })
}
