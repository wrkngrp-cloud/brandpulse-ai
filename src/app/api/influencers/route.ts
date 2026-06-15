import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const socialUrlSchema = z.object({
  platform: z.string().min(1),
  handle:   z.string().min(1),
  url:      z.string().optional(),
})

const bodySchema = z.object({
  name:         z.string().min(1).max(120),
  handle:       z.string().min(1).max(80),
  platform:     z.enum(['instagram', 'tiktok', 'twitter', 'youtube', 'facebook']),
  category:     z.string().max(80).optional(),
  followers:    z.number().int().min(0).optional(),
  profile_url:  z.string().optional(),
  social_urls:  z.array(socialUrlSchema).optional(),
  profile_data: z.record(z.string(), z.unknown()).optional(),
  brand_fit:    z.record(z.string(), z.unknown()).optional(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { name, handle, platform, category, followers, profile_url, social_urls, profile_data, brand_fit } = parsed.data

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
      brand_id:     brand.id,
      name,
      handle:       cleanHandle,
      platform,
      category:     category ?? null,
      followers:    followers ?? null,
      status:       'prospect',
      profile_url:  profile_url ?? null,
      social_urls:  social_urls ?? [],
      profile_data: profile_data ?? {},
      brand_fit:    brand_fit ?? {},
    })
    .select()
    .single()

  if (error) {
    console.error('[influencers] insert error', error)
    return NextResponse.json({ error: 'Failed to add influencer.' }, { status: 500 })
  }

  return NextResponse.json({ influencer }, { status: 201 })
}
