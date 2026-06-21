import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const supabase = await createServiceClient()

  // Look up and validate token
  const { data: portalToken } = await supabase
    .from('portal_tokens')
    .select('id, brand_id, workspace_id, sections, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (!portalToken) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  if (portalToken.expires_at && new Date(portalToken.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This portal link has expired' }, { status: 410 })
  }

  // Record access
  await supabase.from('portal_tokens').update({ last_accessed: new Date().toISOString() })
    .eq('id', portalToken.id)

  const brandId = portalToken.brand_id
  const sections = portalToken.sections as string[]

  const [brandRes, sentimentRes, sovRes, bhiRes] = await Promise.all([
    supabase.from('brands').select('name, category, logo_url').eq('id', brandId).single(),
    sections.includes('sentiment')
      ? supabase.from('sentiment_daily').select('social_score, day, positive_pct, negative_pct')
          .eq('brand_id', brandId).order('day', { ascending: false }).limit(30)
      : { data: null },
    sections.includes('sov')
      ? supabase.from('sov_snapshots').select('social_sov, snapshot_date')
          .eq('brand_id', brandId).order('snapshot_date', { ascending: false }).limit(1).single()
      : { data: null },
    sections.includes('bhi')
      ? supabase.from('brand_health_snapshots').select('bhi, snapshot_date')
          .eq('brand_id', brandId).order('snapshot_date', { ascending: false }).limit(30)
      : { data: null },
  ])

  return NextResponse.json({
    brand:      brandRes.data,
    sections,
    sentiment:  sentimentRes.data,
    sov:        sovRes.data,
    bhiHistory: bhiRes.data,
    asOf:       new Date().toISOString(),
  })
}
