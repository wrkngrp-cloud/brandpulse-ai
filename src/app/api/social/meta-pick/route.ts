import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { finishPick, readPick } from '@/lib/meta/pick'

export const runtime = 'nodejs'

/**
 * The "which Page / ad account?" step. The held login is tied to the user who
 * started it, and only an option that was offered can be chosen, so the
 * service-role write below only ever lands on the brand that user was
 * connecting, for an account Meta listed for their own login.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in and try again.' }, { status: 401 })
  const key = req.nextUrl.searchParams.get('key') ?? ''
  if (!/^[0-9a-f]{32}$/.test(key)) return NextResponse.json({ error: 'That link is not right.' }, { status: 400 })
  const pick = await readPick(key, user.id)
  if (!pick) return NextResponse.json({ error: 'That choice has expired. Connect again from the Connectors page.' }, { status: 404 })
  return NextResponse.json(pick)
}

const body = z.object({ key: z.string().regex(/^[0-9a-f]{32}$/), id: z.string().min(1).max(64) })

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in and try again.' }, { status: 401 })
  const parsed = body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Pick one of the accounts listed.' }, { status: 400 })
  const out = await finishPick(await createServiceClient(), parsed.data.key, user.id, parsed.data.id)
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: 400 })
  const redirect = out.kind === 'meta_ads'
    ? (out.returnTo === 'connectors' ? '/dashboard/connectors?connected=meta' : '/dashboard/digital?connected=meta')
    : `/dashboard/content?connected=${out.kind}`
  return NextResponse.json({ ok: true, redirect })
}
