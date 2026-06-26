import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrand } from '@/lib/active-brand'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const createSchema = z.object({
  name:               z.string().min(1),
  email:              z.string().email().optional().or(z.literal('')),
  phone:              z.string().optional(),
  source:             z.enum(['nps', 'survey', 'whatsapp', 'manual', 'import']).default('manual'),
  source_response_id: z.string().uuid().optional(),
  nps_score:          z.number().int().min(0).max(10).optional(),
  notes:              z.string().optional(),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string }>(supabase, 'id')
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const { data, error } = await supabase
    .from('promoters')
    .select(`
      id, name, email, phone, source, nps_score, status, notes, created_at,
      referral_codes(id, code, label, clicks, unique_clicks, conversions, attributed_revenue, is_active, created_at)
    `)
    .eq('brand_id', brand.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ promoters: data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string }>(supabase, 'id')
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const body = createSchema.safeParse(await request.json())
  if (!body.success) return NextResponse.json({ error: 'Invalid input', details: body.error.flatten() }, { status: 400 })

  const { name, email, phone, source, source_response_id, nps_score, notes } = body.data

  const { data, error } = await supabase
    .from('promoters')
    .insert({
      brand_id: brand.id,
      name,
      email:               email || null,
      phone:               phone || null,
      source,
      source_response_id:  source_response_id || null,
      nps_score:           nps_score ?? null,
      notes:               notes || null,
      status:              'invited',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ promoter: data }, { status: 201 })
}
