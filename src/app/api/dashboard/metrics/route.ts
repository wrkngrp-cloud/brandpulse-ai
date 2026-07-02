import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { getActiveBrandId }         from '@/lib/active-brand'
import { z }                        from 'zod'

const Schema = z.object({
  metric_key:   z.string().min(1),
  value:        z.number(),
  currency:     z.string().default('NGN'),
  period_start: z.string(),
  period_end:   z.string(),
  notes:        z.string().optional(),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No active brand' }, { status: 404 })

  const body = Schema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const d = body.data
  const { error } = await supabase.from('metric_manual').upsert(
    {
      brand_id:     brandId,
      metric_key:   d.metric_key,
      value:        d.value,
      currency:     d.currency,
      period_start: d.period_start,
      period_end:   d.period_end,
      notes:        d.notes ?? null,
      entered_by:   user.id,
      updated_at:   new Date().toISOString(),
    },
    { onConflict: 'brand_id,metric_key,period_start' }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No active brand' }, { status: 404 })

  const { data } = await supabase
    .from('metric_manual')
    .select('metric_key, value, currency, period_start, period_end')
    .eq('brand_id', brandId)
    .order('period_start', { ascending: false })
    .limit(50)

  return NextResponse.json(data ?? [])
}
