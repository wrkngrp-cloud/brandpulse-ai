import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  postId: z.string().uuid(),
  stage: z.enum(['awareness', 'consideration', 'preference', 'action', 'loyalty', 'advocacy']),
})

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { postId, stage } = parsed.data
  const { error } = await supabase
    .from('social_posts')
    .update({ funnel_stage: stage })
    .eq('id', postId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
