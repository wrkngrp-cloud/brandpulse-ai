import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrand } from '@/lib/active-brand'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const createSchema = z.object({
  platform:       z.enum(['jumia', 'konga', 'amazon', 'other']),
  product_name:   z.string().min(1),
  sku:            z.string().optional(),
  product_url:    z.string().url().optional(),
  category:       z.string().optional(),
  is_own_product: z.boolean().default(true),
})

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string }>(supabase, 'id')
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const platform = searchParams.get('platform')
  const own      = searchParams.get('own')

  let query = supabase
    .from('marketplace_products')
    .select(`
      *,
      latest_snapshot:marketplace_snapshots(price, rating, review_count, shelf_position, in_stock, scraped_at)
    `)
    .eq('brand_id', brand.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1, { referencedTable: 'marketplace_snapshots' })

  if (platform) query = query.eq('platform', platform)
  if (own === 'true')  query = query.eq('is_own_product', true)
  if (own === 'false') query = query.eq('is_own_product', false)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ products: data })
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
    .from('marketplace_products')
    .insert({ brand_id: brand.id, ...body.data })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ product: data }, { status: 201 })
}
