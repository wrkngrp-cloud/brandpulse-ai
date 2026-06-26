import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrand } from '@/lib/active-brand'
import { z } from 'zod'

export const runtime = 'nodejs'

const schema = z.object({
  member_id:        z.string().uuid(),
  transaction_type: z.enum(['earn', 'redeem', 'bonus', 'expire', 'adjust']),
  points:           z.number().int().refine(v => v !== 0, 'Points must be non-zero'),
  description:      z.string().min(1),
  reference:        z.string().optional(),
  spend_amount:     z.number().positive().optional(),
  expires_at:       z.string().datetime().optional(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string }>(supabase, 'id')
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const body = schema.safeParse(await request.json())
  if (!body.success) return NextResponse.json({ error: 'Invalid input', details: body.error.flatten() }, { status: 400 })

  // Get current member + program tiers
  const { data: member } = await supabase
    .from('loyalty_members')
    .select('id, points_balance, lifetime_points, program_id')
    .eq('id', body.data.member_id)
    .eq('brand_id', brand.id)
    .single()
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  const newBalance = member.points_balance + body.data.points
  if (newBalance < 0) return NextResponse.json({ error: 'Insufficient points balance' }, { status: 400 })

  const newLifetime = body.data.points > 0
    ? member.lifetime_points + body.data.points
    : member.lifetime_points

  // Auto-promote tier based on lifetime_points
  let newTierId: string | undefined
  if (member.program_id) {
    const { data: tiers } = await supabase
      .from('loyalty_tiers')
      .select('id, min_points')
      .eq('program_id', member.program_id)
      .order('min_points', { ascending: false })
    if (tiers) {
      const eligible = tiers.find(t => newLifetime >= t.min_points)
      if (eligible) newTierId = eligible.id
    }
  }

  // Insert transaction
  const { data: txn, error: txnErr } = await supabase
    .from('loyalty_transactions')
    .insert({
      brand_id:     brand.id,
      balance_after: newBalance,
      ...body.data,
    })
    .select()
    .single()
  if (txnErr) return NextResponse.json({ error: txnErr.message }, { status: 500 })

  // Update member balance + tier
  await supabase
    .from('loyalty_members')
    .update({
      points_balance:  newBalance,
      lifetime_points: newLifetime,
      ...(newTierId ? { current_tier_id: newTierId } : {}),
      last_activity_at: new Date().toISOString(),
      updated_at:       new Date().toISOString(),
    })
    .eq('id', body.data.member_id)

  return NextResponse.json({ transaction: txn, new_balance: newBalance, tier_updated: !!newTierId }, { status: 201 })
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string }>(supabase, 'id')
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const memberId = searchParams.get('member_id')

  let query = supabase
    .from('loyalty_transactions')
    .select('*, member:loyalty_members(name, email)')
    .eq('brand_id', brand.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (memberId) query = query.eq('member_id', memberId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ transactions: data })
}
