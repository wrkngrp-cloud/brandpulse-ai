import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrand } from '@/lib/active-brand'
import { runVolumeSurgeCheck } from '@/lib/sentiment/volume-surge'

// On-demand complaint-surge check for the active brand.
// Computes the z-score of negative mention volume against a 30-day baseline and
// fires a notification when it reaches >= 2.0σ. Also runs daily via Inngest.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string; name: string | null }>(supabase, 'id, name')
  if (!brand) return NextResponse.json({ error: 'No brand' }, { status: 404 })

  const result = await runVolumeSurgeCheck(supabase, brand)
  return NextResponse.json(result)
}
