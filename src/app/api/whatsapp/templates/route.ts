import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const wabaId  = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
  const token   = process.env.WHATSAPP_ACCESS_TOKEN

  if (!wabaId || !token) {
    return NextResponse.json({ templates: [], configured: false })
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${wabaId}/message_templates?status=APPROVED&limit=50&fields=name,language,category,components`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
    )
    const data = await res.json() as {
      data?: Array<{ name: string; language: string; category: string; components: unknown[] }>
      error?: { message: string }
    }

    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 400 })
    }

    return NextResponse.json({ templates: data.data ?? [], configured: true })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }
}
