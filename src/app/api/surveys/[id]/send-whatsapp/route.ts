import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// WhatsApp survey delivery is not available yet. It will run on the Meta Cloud
// API (Model A, see CLAUDE.md) through an Inngest job. This route used to post
// to Africa's Talking, which CLAUDE.md forbids, so it now answers plainly and
// sends nothing. Nothing in the app calls it today; the path is kept so the
// Meta integration has a home.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json(
    { error: 'Sending surveys on WhatsApp is not available yet. Share the survey link or send it by email for now.' },
    { status: 501 },
  )
}
