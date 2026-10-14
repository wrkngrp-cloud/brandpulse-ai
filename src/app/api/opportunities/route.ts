import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { recordEvent } from '@/lib/tools/events'

export const runtime = 'nodejs'

/**
 * Working the acquisition backlog: priority and status.
 *
 * Everything goes through the RLS client, so the policy is the authorisation
 * and an id from another workspace updates nothing. No service client is
 * needed here, which is the right default.
 */

const Body = z.object({
  id:       z.string().uuid(),
  status:   z.enum(['identified', 'planned', 'in_progress', 'done', 'dismissed']).optional(),
  priority: z.number().int().min(1).max(5).optional(),
})

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Bad request.' }, { status: 400 })

  const { id, status, priority } = parsed.data
  if (!status && !priority) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 })

  const { error, count } = await supabase
    .from('acquisition_opportunities')
    .update({ ...(status ? { status } : {}), ...(priority ? { priority } : {}) }, { count: 'exact' })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!count) return NextResponse.json({ error: 'That opportunity is not yours.' }, { status: 404 })

  await recordEvent({
    event: 'beta_feature_used', toolId: 'market-demand', userId: user.id,
    props: { feature: 'opportunity_updated', ...(status ? { status } : {}) },
  })

  return NextResponse.json({ ok: true })
}
