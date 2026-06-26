import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrand } from '@/lib/active-brand'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const createSchema = z.object({
  name:            z.string().min(1),
  description:     z.string().optional(),
  points_currency: z.string().default('points'),
  points_per_ngn:  z.number().positive().default(1),
  starts_at:       z.string().datetime().optional(),
  ends_at:         z.string().datetime().optional(),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string }>(supabase, 'id')
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const { data, error } = await supabase
    .from('loyalty_programs')
    .select(`
      *,
      tiers:loyalty_tiers(id, name, min_points, max_points, multiplier, color, sort_order),
      member_count:loyalty_members(count),
      rewards:loyalty_rewards(id, name, points_cost, reward_type, is_active)
    `)
    .eq('brand_id', brand.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ programs: data })
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
    .from('loyalty_programs')
    .insert({ brand_id: brand.id, ...body.data })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ program: data }, { status: 201 })
}
