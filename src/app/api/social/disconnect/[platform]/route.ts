import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrandId } from '@/lib/active-brand'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const { platform } = await params
  if (!['instagram', 'facebook', 'twitter'].includes(platform)) {
    return NextResponse.json({ error: 'Unknown platform' }, { status: 400 })
  }

  const { error } = await supabase
    .from('social_connections')
    .delete()
    .eq('brand_id', brandId)
    .eq('platform', platform)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
