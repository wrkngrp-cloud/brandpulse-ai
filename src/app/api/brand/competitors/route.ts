import { NextRequest, NextResponse } from 'next/server'
import { getActiveBrandId } from '@/lib/active-brand'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const addSchema = z.object({ name: z.string().min(1) })

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = addSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No active brand' }, { status: 404 })
  const brand = { id: brandId }

  const { data, error } = await supabase
    .from('competitors')
    .insert({ brand_id: brand.id, name: parsed.data.name })
    .select('id, name')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await supabase.from('competitors').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
