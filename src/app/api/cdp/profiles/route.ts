import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrand } from '@/lib/active-brand'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string }>(supabase, 'id')
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const npsLabel  = searchParams.get('nps_label')   // promoter | passive | detractor
  const segment   = searchParams.get('segment')
  const search    = searchParams.get('q')
  const page      = parseInt(searchParams.get('page') ?? '1')
  const limit     = 50
  const offset    = (page - 1) * limit

  let query = supabase
    .from('customer_profiles')
    .select('*', { count: 'exact' })
    .eq('brand_id', brand.id)
    .order('last_seen_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1)

  if (npsLabel) query = query.eq('nps_label', npsLabel)
  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
  }

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ profiles: data, total: count, page, limit })
}
