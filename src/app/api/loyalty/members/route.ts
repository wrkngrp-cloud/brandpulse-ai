import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrand } from '@/lib/active-brand'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const createSchema = z.object({
  program_id:  z.string().uuid(),
  email:       z.string().email().optional().or(z.literal('')),
  phone:       z.string().optional(),
  name:        z.string().min(1),
})

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string }>(supabase, 'id')
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const programId = searchParams.get('program_id')
  const search    = searchParams.get('q')

  let query = supabase
    .from('loyalty_members')
    .select('*, tier:loyalty_tiers(name, color, multiplier)')
    .eq('brand_id', brand.id)
    .order('lifetime_points', { ascending: false })
    .limit(100)

  if (programId) query = query.eq('program_id', programId)
  if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ members: data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string }>(supabase, 'id')
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const body = createSchema.safeParse(await request.json())
  if (!body.success) return NextResponse.json({ error: 'Invalid input', details: body.error.flatten() }, { status: 400 })

  const { data, error } = await supabase
    .from('loyalty_members')
    .insert({
      brand_id:    brand.id,
      email:       body.data.email || null,
      phone:       body.data.phone || null,
      name:        body.data.name,
      program_id:  body.data.program_id,
      joined_at:   new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ member: data }, { status: 201 })
}
