import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrand } from '@/lib/active-brand'

export const runtime = 'nodejs'

// PATCH: toggle active state
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ codeId: string }> }) {
  const { codeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string }>(supabase, 'id')
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const body = await request.json() as { is_active?: boolean }

  const { data, error } = await supabase
    .from('referral_codes')
    .update({ is_active: body.is_active })
    .eq('id', codeId)
    .eq('brand_id', brand.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ code: data })
}
