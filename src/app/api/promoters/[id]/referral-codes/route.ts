import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrand } from '@/lib/active-brand'
import { z } from 'zod'

export const runtime = 'nodejs'

const schema = z.object({
  label:           z.string().optional(),
  destination_url: z.string().url(),
  expires_at:      z.string().datetime().optional(),
})

// Generate a unique BP-XXXXXX code (6 uppercase alphanumeric chars, no ambiguous chars)
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'BP-'
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string }>(supabase, 'id')
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const { data, error } = await supabase
    .from('referral_codes')
    .select('*')
    .eq('promoter_id', id)
    .eq('brand_id', brand.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ codes: data })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: promoterId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string }>(supabase, 'id')
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  // Verify promoter belongs to this brand
  const { data: promoter } = await supabase
    .from('promoters')
    .select('id')
    .eq('id', promoterId)
    .eq('brand_id', brand.id)
    .single()

  if (!promoter) return NextResponse.json({ error: 'Promoter not found' }, { status: 404 })

  const body = schema.safeParse(await request.json())
  if (!body.success) return NextResponse.json({ error: 'Invalid input', details: body.error.flatten() }, { status: 400 })

  // Generate unique code (retry up to 5 times on collision)
  let code = ''
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateCode()
    const { data: existing } = await supabase
      .from('referral_codes')
      .select('id')
      .eq('code', candidate)
      .maybeSingle()
    if (!existing) { code = candidate; break }
  }
  if (!code) return NextResponse.json({ error: 'Could not generate unique code, try again.' }, { status: 500 })

  const { data, error } = await supabase
    .from('referral_codes')
    .insert({
      brand_id:        brand.id,
      promoter_id:     promoterId,
      code,
      label:           body.data.label || null,
      destination_url: body.data.destination_url,
      expires_at:      body.data.expires_at || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ code: data }, { status: 201 })
}
