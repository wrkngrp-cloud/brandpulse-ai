import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrand } from '@/lib/active-brand'
import { z } from 'zod'

export const runtime = 'nodejs'

const schema = z.object({
  channel:        z.enum(['digital', 'tv', 'radio', 'ooh', 'influencer', 'events', 'print', 'other']),
  label:          z.string().min(1),
  planned_amount: z.number().positive(),
  currency:       z.string().default('NGN'),
  campaign_id:    z.string().uuid().optional(),
  notes:          z.string().optional(),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string }>(supabase, 'id')
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  // Verify plan belongs to brand
  const { data: plan } = await supabase.from('budget_plans').select('id').eq('id', planId).eq('brand_id', brand.id).single()
  if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

  const body = schema.safeParse(await request.json())
  if (!body.success) return NextResponse.json({ error: 'Invalid input', details: body.error.flatten() }, { status: 400 })

  const { data, error } = await supabase
    .from('budget_line_items')
    .insert({ brand_id: brand.id, plan_id: planId, ...body.data })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ line_item: data }, { status: 201 })
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string }>(supabase, 'id')
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const { data, error } = await supabase
    .from('budget_line_items')
    .select('*, actuals:budget_actuals(id, amount, description, spent_on)')
    .eq('plan_id', planId)
    .eq('brand_id', brand.id)
    .order('channel')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ line_items: data })
}
