import { NextRequest, NextResponse } from 'next/server'
import { getActiveBrandId } from '@/lib/active-brand'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  name:                   z.string().min(1),
  creator_handle:         z.string().optional().default(''),
  platform:               z.enum(['instagram', 'tiktok', 'twitter', 'youtube', 'facebook']),
  fee:                    z.number().min(0),
  reach:                  z.number().min(0).default(0),
  impressions:            z.number().min(0).default(0),
  engagements:            z.number().min(0).default(0),
  attributed_clicks:      z.number().min(0).default(0),
  attributed_conversions: z.number().min(0).default(0),
  promo_code:             z.string().optional().default(''),
  utm_campaign:           z.string().optional().default(''),
})

export async function GET() {
  const supabase = await createClient()
  const brand = { id: await getActiveBrandId(supabase) }
  if (!brand) return NextResponse.json({ error: 'No brand' }, { status: 400 })

  const { data, error } = await supabase
    .from('influencer_campaigns')
    .select('*')
    .eq('brand_id', brand.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const brand = { id: await getActiveBrandId(supabase) }
  if (!brand) return NextResponse.json({ error: 'No brand' }, { status: 400 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 422 })

  const d = parsed.data

  // Calculate EMV using Nigerian market CPM benchmarks (in kobo per 1000 impressions)
  // CPM benchmarks (NGN): Instagram 2000, TikTok 900, Twitter 1200, YouTube 3000, Facebook 1800
  const CPM: Record<string, number> = { instagram: 2000, tiktok: 900, twitter: 1200, youtube: 3000, facebook: 1800 }
  const CPE = 65 // cost per engagement benchmark (NGN)
  const cpm = CPM[d.platform] ?? 1500
  const emv = (d.impressions * cpm / 1000) + (d.engagements * CPE)

  const { data, error } = await supabase
    .from('influencer_campaigns')
    .insert({
      brand_id:               brand.id,
      name:                   d.name,
      promo_code:             d.promo_code || null,
      utm_campaign:           d.utm_campaign || null,
      reach:                  d.reach,
      impressions:            d.impressions,
      engagements:            d.engagements,
      emv:                    emv,
      attributed_clicks:      d.attributed_clicks,
      attributed_conversions: d.attributed_conversions,
      fee:                    d.fee,
      currency:               'NGN',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ...data, creator_handle: d.creator_handle, platform: d.platform })
}
