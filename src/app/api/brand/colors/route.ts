import { NextRequest, NextResponse } from 'next/server'
import { getActiveBrandId } from '@/lib/active-brand'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  colors: z.array(z.string().regex(/^#[0-9A-Fa-f]{3,6}$/, 'Must be a valid hex color')).max(12),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = schema.safeParse(await req.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message }, { status: 400 })

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No active brand' }, { status: 404 })
  const brand = { id: brandId }

  const { error } = await supabase
    .from('brands')
    .update({ brand_colors: body.data.colors })
    .eq('id', brand.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
