import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: brand } = await supabase.from('brands').select('id').limit(1).single()
  if (!brand) return NextResponse.json({ conversations: [] })

  const service = await createServiceClient()
  const { data: rows } = await service
    .from('ai_conversations')
    .select('id, messages, updated_at')
    .eq('brand_id', brand.id)
    .order('updated_at', { ascending: false })
    .limit(30)

  const conversations = (rows ?? []).map(row => {
    const msgs = (row.messages ?? []) as Array<{ role: string; content: string }>
    const firstUser = msgs.find(m => m.role === 'user')
    const title = firstUser?.content
      ? firstUser.content.slice(0, 80) + (firstUser.content.length > 80 ? '…' : '')
      : 'Conversation'
    const lastAssistant = [...msgs].reverse().find(m => m.role === 'assistant')
    const preview = lastAssistant?.content
      ? lastAssistant.content.slice(0, 100) + (lastAssistant.content.length > 100 ? '…' : '')
      : null
    return { id: row.id, title, preview, updatedAt: row.updated_at, messageCount: msgs.length }
  })

  return NextResponse.json({ conversations })
}
