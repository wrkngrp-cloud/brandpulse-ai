import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrandId } from '@/lib/active-brand'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'Brand not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const campaign_id: string | null = body.campaign_id ?? null

  const { error } = await supabase
    .from('influencers')
    .update({ campaign_id })
    .eq('id', id)
    .eq('brand_id', brandId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
