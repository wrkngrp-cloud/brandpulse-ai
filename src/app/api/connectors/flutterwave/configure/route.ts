import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/crypto'
import { z } from 'zod'

const Body = z.object({
  secret_key: z.string().min(10),
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
    .from('brands')
    .select('id')
    .limit(1)
    .single()
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const encryptedSecret = encrypt(parsed.data.secret_key)

  const { error } = await supabase
    .from('webhook_configs')
    .upsert(
      {
        brand_id:   brand.id,
        provider:   'flutterwave',
        secret_key: encryptedSecret,
      },
      { onConflict: 'brand_id,provider' }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/flutterwave`

  return NextResponse.json({ success: true, webhookUrl })
}
