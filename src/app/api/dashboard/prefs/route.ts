import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { getActiveBrandId }         from '@/lib/active-brand'
import { z }                        from 'zod'
import { DEFAULT_WIDGET_IDS }       from '@/lib/widget-catalog'

const PatchSchema = z.object({
  template:   z.string().optional(),
  widget_ids: z.array(z.string()).optional(),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No active brand' }, { status: 404 })

  const { data } = await supabase
    .from('user_dashboard_prefs')
    .select('template, widget_ids')
    .eq('user_id', user.id)
    .eq('brand_id', brandId)
    .maybeSingle()

  return NextResponse.json(data ?? { template: null, widget_ids: DEFAULT_WIDGET_IDS })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No active brand' }, { status: 404 })

  const body = PatchSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const { error } = await supabase
    .from('user_dashboard_prefs')
    .upsert(
      {
        user_id:    user.id,
        brand_id:   brandId,
        ...(body.data.template   !== undefined && { template:   body.data.template }),
        ...(body.data.widget_ids !== undefined && { widget_ids: body.data.widget_ids }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,brand_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// Temporary: lets the current user re-trigger the first-visit template picker
// for manual mobile QA. Remove once picker/scroll fixes are confirmed on device.
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No active brand' }, { status: 404 })

  const { error } = await supabase
    .from('user_dashboard_prefs')
    .delete()
    .eq('user_id', user.id)
    .eq('brand_id', brandId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
