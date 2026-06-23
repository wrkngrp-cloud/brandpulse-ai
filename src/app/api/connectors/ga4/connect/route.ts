import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrandId } from '@/lib/active-brand'
import { encrypt } from '@/lib/crypto'
import { z } from 'zod'

const Body = z.object({
  property_id:   z.string().min(1),
  property_name: z.string().optional(),
  access_token:  z.string().min(1),
  refresh_token: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = Body.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { property_id, property_name, access_token, refresh_token } = parsed.data

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const encryptedAccessToken = encrypt(access_token)
  const encryptedRefreshToken = refresh_token ? encrypt(refresh_token) : null

  const { error } = await supabase
    .from('ga4_connections')
    .upsert(
      {
        brand_id:      brandId,
        property_id,
        property_name: property_name ?? null,
        access_token:  encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        updated_at:    new Date().toISOString(),
      },
      { onConflict: 'brand_id' }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
