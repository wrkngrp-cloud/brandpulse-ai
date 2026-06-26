import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrand, getActiveBrandId } from '@/lib/active-brand'
import { encrypt, decrypt } from '@/lib/crypto'
import { z } from 'zod'

const PostBody = z.object({
  api_key: z.string().min(10, 'API key is too short'),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = PostBody.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const brand = await getActiveBrand<{ id: string; workspace_id: string }>(supabase, 'id, workspace_id')
  if (!brand) return NextResponse.json({ error: 'No active brand' }, { status: 404 })

  const encryptedKey = encrypt(parsed.data.api_key)

  const { error } = await supabase
    .from('youtube_api_configs')
    .upsert(
      {
        brand_id:     brand.id,
        workspace_id: brand.workspace_id,
        api_key:      encryptedKey,
        updated_at:   new Date().toISOString(),
      },
      { onConflict: 'brand_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ connected: false })
  const brand = { id: brandId }

  const { data: config } = await supabase
    .from('youtube_api_configs')
    .select('last_synced_at, updated_at')
    .eq('brand_id', brand.id)
    .maybeSingle()

  if (!config) return NextResponse.json({ connected: false })

  let maskedKey = '••••••••'
  try {
    const { data: full } = await supabase
      .from('youtube_api_configs')
      .select('api_key')
      .eq('brand_id', brand.id)
      .single()
    if (full?.api_key) {
      const plain = decrypt(full.api_key)
      maskedKey = plain.slice(0, 4) + '••••' + plain.slice(-4)
    }
  } catch { /* leave masked */ }

  return NextResponse.json({
    connected:      true,
    last_synced_at: config.last_synced_at,
    updated_at:     config.updated_at,
    masked_key:     maskedKey,
  })
}
