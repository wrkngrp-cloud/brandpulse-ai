import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrandId } from '@/lib/active-brand'

/** The hour on Monday (Lagos) this brand wants its brief. */
const body = z.object({ briefHour: z.number().int().min(5).max(12) })

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in and try again.' }, { status: 401 })
  const parsed = body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Pick a time between 5am and noon.' }, { status: 400 })
  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'We could not find your brand.' }, { status: 404 })
  const { error } = await supabase.from('brands').update({ brief_hour: parsed.data.briefHour }).eq('id', brandId)
  if (error) return NextResponse.json({ error: 'That did not save. Try again in a minute.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
