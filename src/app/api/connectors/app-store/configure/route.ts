import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const Body = z.object({
  apple_app_id:    z.string().optional(),
  google_pkg_name: z.string().optional(),
}).refine(
  (d) => d.apple_app_id || d.google_pkg_name,
  { message: 'Provide at least one of apple_app_id or google_pkg_name' }
)

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = Body.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { apple_app_id, google_pkg_name } = parsed.data

  const { data: brand } = await supabase
    .from('brands')
    .select('id')
    .limit(1)
    .single()
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const { error } = await supabase
    .from('app_store_configs')
    .upsert(
      {
        brand_id:        brand.id,
        apple_app_id:    apple_app_id ?? null,
        google_pkg_name: google_pkg_name ?? null,
      },
      { onConflict: 'brand_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
