import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { FINDING_STATUS } from '@/lib/tools/audit-vocab'
import { recordEvent } from '@/lib/tools/events'

export const runtime = 'nodejs'

const Body = z.object({
  id:     z.string().uuid(),
  status: z.enum(FINDING_STATUS),
})

/** Work the backlog. Straight through the RLS client, so a finding belonging
 *  to another workspace updates nothing. */
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Bad request.' }, { status: 400 })

  const { error, count } = await supabase
    .from('page_audit_findings')
    .update({
      status: parsed.data.status,
      resolved_at: parsed.data.status === 'fixed' ? new Date().toISOString() : null,
    }, { count: 'exact' })
    .eq('id', parsed.data.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!count) return NextResponse.json({ error: 'That finding is not yours.' }, { status: 404 })

  await recordEvent({
    event: 'beta_feature_used', toolId: 'campaign-audit', userId: user.id,
    props: { feature: 'finding_status', status: parsed.data.status },
  })

  return NextResponse.json({ ok: true })
}
