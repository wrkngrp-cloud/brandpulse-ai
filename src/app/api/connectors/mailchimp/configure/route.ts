import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrandId } from '@/lib/active-brand'
import { encrypt } from '@/lib/crypto'
import { z } from 'zod'
import { checkMailchimpKey } from '@/lib/connectors/validate-keys'

const Body = z.object({
  api_key: z.string().min(10),
  list_id: z.string().optional(),
})

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

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  // Check the key with Mailchimp first. It used to save anything and say
  // "Connected", so a wrong key looked like a working connector.
  const check = await checkMailchimpKey(parsed.data.api_key, parsed.data.list_id)
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 })

  const encryptedKey = encrypt(parsed.data.api_key.trim())

  const { error } = await supabase
    .from('email_connectors')
    .upsert(
      {
        brand_id:   brandId,
        provider:   'mailchimp',
        api_key:    encryptedKey,
        list_id:    parsed.data.list_id?.trim() ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'brand_id,provider' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

/** Disconnect: removes this brand's mailchimp key. */
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No brand found' }, { status: 404 })
  const { error } = await supabase.from('email_connectors').delete().eq('brand_id', brandId).eq('provider', 'mailchimp')
  if (error) return NextResponse.json({ error: 'That did not go through. Try again.' }, { status: 500 })
  return NextResponse.json({ success: true })
}
