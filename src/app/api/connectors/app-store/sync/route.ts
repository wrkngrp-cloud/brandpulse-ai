import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrandId } from '@/lib/active-brand'
import { inngest } from '@/lib/inngest/client'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  await inngest.send({
    name: 'brandpulse/app.reviews.sync',
    data: { brand_id: brandId },
  })

  return NextResponse.json({
    success: true,
    message: 'Sync queued. Check back in a few minutes.',
  })
}
