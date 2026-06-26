import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrand } from '@/lib/active-brand'
import { z } from 'zod'

export const runtime = 'nodejs'

const snapshotSchema = z.object({
  product_id:     z.string().uuid(),
  price:          z.number().positive().optional(),
  original_price: z.number().positive().optional(),
  in_stock:       z.boolean().default(true),
  rating:         z.number().min(0).max(5).optional(),
  review_count:   z.number().int().min(0).optional(),
  shelf_position: z.number().int().positive().optional(),
  sales_rank:     z.number().int().positive().optional(),
  badges:         z.array(z.string()).optional(),
  image_url:      z.string().url().optional(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string }>(supabase, 'id')
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const body = snapshotSchema.safeParse(await request.json())
  if (!body.success) return NextResponse.json({ error: 'Invalid input', details: body.error.flatten() }, { status: 400 })

  // Verify product belongs to this brand
  const { data: product } = await supabase
    .from('marketplace_products')
    .select('id')
    .eq('id', body.data.product_id)
    .eq('brand_id', brand.id)
    .single()
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  const discountPct = (body.data.price && body.data.original_price && body.data.original_price > body.data.price)
    ? ((body.data.original_price - body.data.price) / body.data.original_price) * 100
    : null

  const { data, error } = await supabase
    .from('marketplace_snapshots')
    .insert({
      brand_id:       brand.id,
      snapshot_date:  new Date().toISOString().slice(0, 10),
      discount_pct:   discountPct,
      ...body.data,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ snapshot: data }, { status: 201 })
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string }>(supabase, 'id')
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const productId = searchParams.get('product_id')
  const days = parseInt(searchParams.get('days') ?? '30')
  const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10)

  let query = supabase
    .from('marketplace_snapshots')
    .select('*, product:marketplace_products(product_name, platform, is_own_product)')
    .eq('brand_id', brand.id)
    .gte('snapshot_date', since)
    .order('scraped_at', { ascending: false })
    .limit(200)

  if (productId) query = query.eq('product_id', productId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ snapshots: data })
}
