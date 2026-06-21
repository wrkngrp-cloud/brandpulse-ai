import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { cookies } from 'next/headers'

const Body = z.object({ brandId: z.string().uuid() })

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = Body.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  // Validate brand belongs to user's workspace (RLS enforces this)
  const { data: brand } = await supabase
    .from('brands').select('id, name').eq('id', parsed.data.brandId).maybeSingle()
  if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 })

  // Also update workspace active_brand_id
  await supabase.from('workspaces').update({ active_brand_id: brand.id })

  const cookieStore = await cookies()
  cookieStore.set('active_brand_id', brand.id, {
    httpOnly: false, // readable by client for optimistic UI
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })

  return NextResponse.json({ brandId: brand.id, brandName: brand.name })
}
