import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { createServiceClient }      from '@/lib/supabase/server'
import { z }                        from 'zod'

const BodySchema = z.object({
  competitor_name: z.string().min(1),
  sighting_type:   z.enum(['billboard','event','digital','print','tv','radio','activation','pr']),
  city:            z.string().optional(),
  state:           z.string().optional(),
  description:     z.string().optional(),
  spotted_at:      z.string().optional(),
  lat:             z.number().optional(),
  lng:             z.number().optional(),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: brand } = await supabase
    .from('brands').select('id').limit(1).single()
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const parsed = BodySchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const service = await createServiceClient()
  const { data, error } = await service
    .from('competitor_sightings')
    .insert({
      brand_id:        brand.id,
      competitor_name: parsed.data.competitor_name,
      sighting_type:   parsed.data.sighting_type,
      city:            parsed.data.city   ?? null,
      state:           parsed.data.state  ?? null,
      description:     parsed.data.description ?? null,
      spotted_at:      parsed.data.spotted_at  ?? new Date().toISOString().slice(0, 10),
      lat:             parsed.data.lat ?? null,
      lng:             parsed.data.lng ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('[sightings] insert error:', error)
    return NextResponse.json({ error: 'Failed to log sighting' }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: brand } = await supabase
    .from('brands').select('id').limit(1).single()
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 100)

  const { data, error } = await supabase
    .from('competitor_sightings')
    .select('*')
    .eq('brand_id', brand.id)
    .order('spotted_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: 'Failed to fetch sightings' }, { status: 500 })
  return NextResponse.json({ sightings: data ?? [] })
}
