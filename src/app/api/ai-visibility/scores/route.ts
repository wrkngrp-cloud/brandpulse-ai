import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrandId } from '@/lib/active-brand'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ scores: [], checks: [] })

  const [{ data: scores }, { data: checks }] = await Promise.all([
    supabase
      .from('ai_visibility_scores')
      .select('*')
      .eq('brand_id', brandId)
      .order('week_of', { ascending: false })
      .limit(12),
    supabase
      .from('ai_visibility_checks')
      .select('platform, question, brand_mentioned, mention_position, tone, competitors_mentioned, checked_at')
      .eq('brand_id', brandId)
      .order('checked_at', { ascending: false })
      .limit(50),
  ])

  return NextResponse.json({ scores: scores ?? [], checks: checks ?? [] })
}
