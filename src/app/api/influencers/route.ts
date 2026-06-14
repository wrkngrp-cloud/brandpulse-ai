import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const bodySchema = z.object({
  name:      z.string().min(1).max(120),
  handle:    z.string().min(1).max(80),
  platform:  z.enum(['Instagram', 'TikTok', 'Twitter', 'YouTube', 'Facebook']),
  category:  z.string().max(80).optional(),
  followers: z.number().int().min(0).optional(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { name, handle, platform, category, followers } = parsed.data

  const { data: brand } = await supabase
    .from('brands')
    .select('id')
    .limit(1)
    .single()

  if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 })

  const cleanHandle = handle.replace(/^@/, '')

  const { data: influencer, error } = await supabase
    .from('influencers')
    .insert({
      brand_id: brand.id,
      name,
      handle: cleanHandle,
      platform,
      category:  category ?? null,
      followers: followers ?? null,
      status:    'prospect',
    })
    .select()
    .single()

  if (error) {
    console.error('[influencers] insert error', error)
    return NextResponse.json({ error: 'Failed to add influencer.' }, { status: 500 })
  }

  return NextResponse.json({ influencer }, { status: 201 })
}
