import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { getActiveBrand }           from '@/lib/active-brand'
import { z }                        from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const schema = z.object({
  ooh_site_id:       z.string().uuid(),
  audience_name:     z.string().min(1).max(200),
  platform:          z.enum(['meta', 'google']),
  fence_radius_m:    z.number().int().min(50).max(50_000).default(500),
  dwell_minutes:     z.number().int().min(0).default(5),
  creative_asset_id: z.string().uuid().optional(),
  creative_headline: z.string().max(255).optional(),
  creative_description: z.string().max(500).optional(),
})

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string }>(supabase, 'id')
  if (!brand) return NextResponse.json({ error: 'No brand' }, { status: 404 })

  const siteId = req.nextUrl.searchParams.get('site_id')
  let q = supabase.from('ooh_geo_audiences').select('*').eq('brand_id', brand.id)
  if (siteId) q = q.eq('ooh_site_id', siteId)

  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ audiences: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string }>(supabase, 'id')
  if (!brand) return NextResponse.json({ error: 'No brand' }, { status: 404 })

  const body = schema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: 'Invalid input', details: body.error.flatten() }, { status: 400 })

  const { data, error } = await supabase
    .from('ooh_geo_audiences')
    .insert({ brand_id: brand.id, ...body.data })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ audience: data }, { status: 201 })
}
