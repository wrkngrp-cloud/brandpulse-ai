import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/crypto'
import { z } from 'zod'

const Body = z.object({
  api_key: z.string().min(10),
  list_id: z.string().optional(),
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

  const { data: brand } = await supabase
    .from('brands').select('id').limit(1).single()
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const encryptedKey = encrypt(parsed.data.api_key)

  const { error } = await supabase
    .from('email_connectors')
    .upsert(
      {
        brand_id:   brand.id,
        provider:   'brevo',
        api_key:    encryptedKey,
        list_id:    parsed.data.list_id?.trim() ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'brand_id,provider' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
