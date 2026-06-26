import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrand } from '@/lib/active-brand'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const createSchema = z.object({
  name:               z.string().min(1),
  hypothesis:         z.string().min(10),
  description:        z.string().optional(),
  experiment_type:    z.enum(['message', 'creative', 'channel', 'offer', 'landing_page', 'email', 'other']).default('other'),
  metric_primary:     z.string().min(1),
  metrics_secondary:  z.array(z.string()).default([]),
  confidence_target:  z.number().min(80).max(99.9).default(95),
  min_sample_size:    z.number().int().min(10).default(100),
  variants: z.array(z.object({
    name:        z.string().min(1),
    is_control:  z.boolean().default(false),
    description: z.string().optional(),
    content:     z.record(z.string(), z.unknown()).default({}),
  })).min(2),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string }>(supabase, 'id')
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const { data, error } = await supabase
    .from('ab_experiments')
    .select('*, variants:ab_variants(id, name, is_control, impressions, conversions, revenue, sort_order, content)')
    .eq('brand_id', brand.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ experiments: data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string }>(supabase, 'id')
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const body = createSchema.safeParse(await request.json())
  if (!body.success) return NextResponse.json({ error: 'Invalid input', details: body.error.flatten() }, { status: 400 })

  const { variants, ...expData } = body.data

  // Create experiment
  const { data: exp, error: expErr } = await supabase
    .from('ab_experiments')
    .insert({ brand_id: brand.id, created_by: user.id, ...expData })
    .select()
    .single()
  if (expErr) return NextResponse.json({ error: expErr.message }, { status: 500 })

  // Create variants
  const variantRows = variants.map((v, i) => ({
    brand_id:      brand.id,
    experiment_id: exp.id,
    name:          v.name,
    is_control:    v.is_control ?? i === 0,
    description:   v.description ?? null,
    content:       v.content,
    sort_order:    i,
  }))

  const { data: createdVariants, error: varErr } = await supabase
    .from('ab_variants')
    .insert(variantRows)
    .select()

  if (varErr) return NextResponse.json({ error: varErr.message }, { status: 500 })

  // Set equal traffic split
  const splitPct = Math.floor(100 / variants.length)
  const trafficSplit: Record<string, number> = {}
  createdVariants?.forEach((v, i) => {
    trafficSplit[v.id] = i < variants.length - 1 ? splitPct : 100 - splitPct * (variants.length - 1)
  })
  await supabase
    .from('ab_experiments')
    .update({ traffic_split: trafficSplit })
    .eq('id', exp.id)

  return NextResponse.json({ experiment: { ...exp, variants: createdVariants } }, { status: 201 })
}
