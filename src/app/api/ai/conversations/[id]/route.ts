import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: brand } = await supabase.from('brands').select('id').limit(1).single()
  if (!brand) return NextResponse.json({ error: 'No brand' }, { status: 404 })

  const { id } = await params
  const service = await createServiceClient()

  const { data: conv } = await service
    .from('ai_conversations')
    .select('id, messages, updated_at')
    .eq('id', id)
    .eq('brand_id', brand.id)
    .single()

  if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    messages: (conv.messages ?? []) as Array<{ role: string; content: string }>,
    updatedAt: conv.updated_at,
  })
}
