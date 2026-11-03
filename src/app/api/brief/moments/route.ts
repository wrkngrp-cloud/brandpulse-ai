import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrandId } from '@/lib/active-brand'
import { MOMENT_KINDS, lagosToday, addDays } from '@/lib/brief/metrics'

/** Moments: what the brand did that is not a campaign. RLS client throughout. */
const body = z.object({
  happenedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind:       z.enum(Object.keys(MOMENT_KINDS) as [keyof typeof MOMENT_KINDS, ...(keyof typeof MOMENT_KINDS)[]]),
  title:      z.string().trim().min(2).max(200),
  notes:      z.string().trim().max(1000).optional(),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in and try again.' }, { status: 401 })

  const parsed = body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Give it a date, a type and a short name.' }, { status: 400 })
  const today = lagosToday()
  if (parsed.data.happenedOn > addDays(today, 31) || parsed.data.happenedOn < addDays(today, -365)) {
    return NextResponse.json({ error: 'Pick a date within the last year.' }, { status: 400 })
  }

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'We could not find your brand.' }, { status: 404 })

  const { data, error } = await supabase.from('brand_moments').insert({
    brand_id: brandId, happened_on: parsed.data.happenedOn, kind: parsed.data.kind,
    title: parsed.data.title, notes: parsed.data.notes || null, created_by: user.id,
  }).select('id').single()
  if (error) return NextResponse.json({ error: 'That did not save. Try again in a minute.' }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in and try again.' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id') ?? ''
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: 'Unknown moment.' }, { status: 400 })
  // RLS limits this to the caller's own brands.
  const { error } = await supabase.from('brand_moments').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'That did not go through. Try again.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
