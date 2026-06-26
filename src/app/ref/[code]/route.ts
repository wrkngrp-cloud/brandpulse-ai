import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Public referral redirect — no auth. Logs click then redirects.
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const supabase = await createClient()

  // Look up code (service role not needed — public read via code column)
  const { data: refCode } = await supabase
    .from('referral_codes')
    .select('id, brand_id, promoter_id, destination_url, is_active, expires_at, clicks, unique_clicks')
    .eq('code', code.toUpperCase())
    .maybeSingle()

  if (!refCode || !refCode.is_active) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (refCode.expires_at && new Date(refCode.expires_at) < new Date()) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Deduplication: hash IP + user-agent for unique click detection
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const ua = request.headers.get('user-agent') ?? ''
  const sessionId = request.cookies.get('bp_session')?.value
  const ipHash = createHash('sha256').update(ip + ua).digest('hex').slice(0, 16)

  // Check if this ip_hash has clicked this code before (last 24h)
  const since24h = new Date(Date.now() - 86400_000).toISOString()
  const { data: existingClick } = await supabase
    .from('referral_events')
    .select('id')
    .eq('referral_code_id', refCode.id)
    .eq('event_type', 'click')
    .eq('ip_hash', ipHash)
    .gte('occurred_at', since24h)
    .maybeSingle()

  const isUnique = !existingClick

  // Insert event (use supabase with service role cookie for writes, else anon key is fine since we have service policy)
  await supabase
    .from('referral_events')
    .insert({
      brand_id:         refCode.brand_id,
      referral_code_id: refCode.id,
      promoter_id:      refCode.promoter_id,
      event_type:       'click',
      session_id:       sessionId ?? null,
      ip_hash:          ipHash,
      is_unique:        isUnique,
      metadata:         { user_agent: ua.slice(0, 200) },
    })

  // Increment counters
  await supabase
    .from('referral_codes')
    .update({
      clicks:        (refCode.clicks ?? 0) + 1,
      unique_clicks: isUnique ? (refCode.unique_clicks ?? 0) + 1 : refCode.unique_clicks,
    })
    .eq('id', refCode.id)

  // Set a session cookie so we can attribute subsequent conversion
  const dest = new URL(refCode.destination_url)
  const response = NextResponse.redirect(dest)
  response.cookies.set('bp_ref', refCode.id, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge:   7 * 24 * 3600,
    path:     '/',
  })
  return response
}
