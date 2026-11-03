import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrandId } from '@/lib/active-brand'
import { z } from 'zod'
import { appleIdDigits, checkAppleAppId, checkPlayPackage } from '@/lib/connectors/validate-keys'

const Body = z.object({
  apple_app_id:    z.string().optional(),
  google_pkg_name: z.string().optional(),
}).refine(
  (d) => d.apple_app_id || d.google_pkg_name,
  { message: 'Provide at least one of apple_app_id or google_pkg_name' }
)

export const runtime = 'nodejs'

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

  // Check before saving. Any text used to save and show "Configured".
  if (apple_app_id?.trim()) {
    const check = await checkAppleAppId(apple_app_id)
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 })
  }
  if (google_pkg_name?.trim()) {
    const check = checkPlayPackage(google_pkg_name)
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 })
  }

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const { error } = await supabase
    .from('app_store_configs')
    .upsert(
      {
        brand_id:        brandId,
        apple_app_id:    apple_app_id?.trim() ? appleIdDigits(apple_app_id) : null,
        google_pkg_name: google_pkg_name?.trim() || null,
      },
      { onConflict: 'brand_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

/** Disconnect: removes this brand's app store settings. */
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No brand found' }, { status: 404 })
  const { error } = await supabase.from('app_store_configs').delete().eq('brand_id', brandId)
  if (error) return NextResponse.json({ error: 'That did not go through. Try again.' }, { status: 500 })
  return NextResponse.json({ success: true })
}
