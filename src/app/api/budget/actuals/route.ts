import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrand } from '@/lib/active-brand'
import { z } from 'zod'

export const runtime = 'nodejs'

const schema = z.object({
  line_item_id: z.string().uuid(),
  amount:       z.number().positive(),
  currency:     z.string().default('NGN'),
  description:  z.string().min(1),
  reference:    z.string().optional(),
  spent_on:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string }>(supabase, 'id')
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const body = schema.safeParse(await request.json())
  if (!body.success) return NextResponse.json({ error: 'Invalid input', details: body.error.flatten() }, { status: 400 })

  // Verify line item belongs to brand
  const { data: li } = await supabase
    .from('budget_line_items')
    .select('id, actual_amount')
    .eq('id', body.data.line_item_id)
    .eq('brand_id', brand.id)
    .single()
  if (!li) return NextResponse.json({ error: 'Line item not found' }, { status: 404 })

  // Insert actual spend entry
  const { data: actual, error } = await supabase
    .from('budget_actuals')
    .insert({ brand_id: brand.id, created_by: user.id, ...body.data })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update line item actual_amount
  const newActual = (li.actual_amount ?? 0) + body.data.amount
  await supabase
    .from('budget_line_items')
    .update({ actual_amount: newActual, updated_at: new Date().toISOString() })
    .eq('id', body.data.line_item_id)

  return NextResponse.json({ actual }, { status: 201 })
}
