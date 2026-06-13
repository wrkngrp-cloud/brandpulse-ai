import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { inngest }                   from '@/lib/inngest/client'
import { z }                         from 'zod'

const Body = z.object({
  siteId:   z.string().uuid(),
  brandId:  z.string().uuid(),
  keyword:  z.string().min(1).max(100),
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

  const { siteId, brandId, keyword } = parsed.data

  // Verify the site belongs to this user's workspace
  const { data: site } = await supabase
    .from('ooh_sites')
    .select('id')
    .eq('id', siteId)
    .single()

  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })

  await inngest.send({
    name: 'brandpulse/ooh.search-uplift-requested',
    data: { siteId, brandId, keyword },
  })

  return NextResponse.json({ queued: true })
}
