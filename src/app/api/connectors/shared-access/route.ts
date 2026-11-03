import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrandId } from '@/lib/active-brand'
import { googleShareEmail, normalisePropertyId, probeGa4Property } from '@/lib/shared-access/google'
import { metaBusinessId, normaliseAdAccountId, probeMetaAdAccount } from '@/lib/shared-access/meta'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * Agency-style access: the brand shares its GA4 property or Meta ad account
 * with BrandGauge, then tells us which one.
 *
 * Everything here runs on the RLS client, so a caller can only touch rows for
 * a brand in their own workspace. The request lands 'pending' and syncs
 * nothing: our account can read every property shared with it, and a
 * property ID is not a secret, so staff confirm who shared it before any data
 * flows (Desk, Ops). A database trigger stops this session from making the
 * row active itself.
 */

const body = z.object({
  platform: z.enum(['ga4', 'meta']),
  id:       z.string().min(3).max(200),
})

const ALREADY_CLAIMED = 'This account is already linked to another BrandGauge brand. If it is yours, message us from the help button and we will sort it out.'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in and try again.' }, { status: 401 })

  const parsed = body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'That did not look right. Check the ID and try again.' }, { status: 400 })
  const { platform, id } = parsed.data

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'We could not find your brand.' }, { status: 404 })

  if (platform === 'ga4') {
    const propertyId = normalisePropertyId(id)
    if (!propertyId) return NextResponse.json({ error: 'A GA4 property ID is a number, like 312345678. You will find it in GA4 under Admin, Property details.' }, { status: 400 })
    const email = googleShareEmail()
    if (!email) return NextResponse.json({ error: 'Sharing access is not switched on yet. Use Connect with Google for now.' }, { status: 503 })

    const { data: existing } = await supabase.from('ga4_connections').select('id, auth_mode').eq('brand_id', brandId).maybeSingle()
    if (existing && existing.auth_mode !== 'shared') {
      return NextResponse.json({ error: 'GA4 is already connected with a Google login. Disconnect that first if you would rather share access.' }, { status: 409 })
    }

    // Check we can see it before we take the request, so the marketer finds
    // out now that a step was missed, not tomorrow.
    const probe = await probeGa4Property(propertyId)
    if (!probe.ok) {
      const msg = probe.reason === 'no_access'
        ? `We cannot see that property yet. In GA4, open Admin, Property access management, and add ${email} as a Viewer. Then try again.`
        : probe.reason === 'not_found'
          ? 'We could not find a GA4 property with that ID. Check it under Admin, Property details.'
          : 'Google did not answer just now. Try again in a minute.'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    if (existing) await supabase.from('ga4_connections').delete().eq('id', existing.id)
    const { error } = await supabase.from('ga4_connections').insert({
      brand_id: brandId, property_id: propertyId, property_name: probe.propertyName,
      auth_mode: 'shared', access_status: 'pending', requested_by: user.id, access_token: null,
    })
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: ALREADY_CLAIMED }, { status: 409 })
      console.error('[shared-access] ga4 insert failed:', error.message)
      return NextResponse.json({ error: 'That did not save. Try again in a minute.' }, { status: 500 })
    }
    return NextResponse.json({ status: 'pending', name: probe.propertyName })
  }

  // Meta
  const adAccountId = normaliseAdAccountId(id)
  if (!adAccountId) return NextResponse.json({ error: 'A Meta ad account ID is a number, like 1234567890. You will find it at the top of Ads Manager.' }, { status: 400 })
  if (!metaBusinessId()) return NextResponse.json({ error: 'Sharing access is not switched on yet. Use Connect with Meta for now.' }, { status: 503 })

  const { data: existingMeta } = await supabase.from('digital_ad_accounts')
    .select('id, auth_mode').eq('brand_id', brandId).eq('platform', 'meta')
  if ((existingMeta ?? []).some(r => r.auth_mode !== 'shared')) {
    return NextResponse.json({ error: 'Meta Ads is already connected with a login. Disconnect that first if you would rather share access.' }, { status: 409 })
  }

  // A partner-shared account is often not readable until we assign it to our
  // system user, which happens at approval. So a failed read here is normal,
  // not a refusal; a successful one just fills in the name.
  const probe = await probeMetaAdAccount(adAccountId)

  for (const r of existingMeta ?? []) await supabase.from('digital_ad_accounts').delete().eq('id', r.id)
  const { error } = await supabase.from('digital_ad_accounts').insert({
    brand_id: brandId, platform: 'meta', account_id: adAccountId, ad_account_id: adAccountId,
    account_name: probe.ok ? probe.name : null, currency: probe.ok ? probe.currency ?? 'NGN' : 'NGN',
    auth_mode: 'shared', access_status: 'pending', requested_by: user.id, access_token: null,
  })
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: ALREADY_CLAIMED }, { status: 409 })
    console.error('[shared-access] meta insert failed:', error.message)
    return NextResponse.json({ error: 'That did not save. Try again in a minute.' }, { status: 500 })
  }
  return NextResponse.json({ status: 'pending', name: probe.ok ? probe.name : null })
}

/** Withdraw a request, or stop sharing. Deletes only this brand's shared row. */
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in and try again.' }, { status: 401 })
  const platform = req.nextUrl.searchParams.get('platform')
  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'We could not find your brand.' }, { status: 404 })

  const { error } = platform === 'ga4'
    ? await supabase.from('ga4_connections').delete().eq('brand_id', brandId).eq('auth_mode', 'shared')
    : platform === 'meta'
      ? await supabase.from('digital_ad_accounts').delete().eq('brand_id', brandId).eq('platform', 'meta').eq('auth_mode', 'shared')
      : { error: { message: 'unknown platform' } }
  if (error) return NextResponse.json({ error: 'That did not go through. Try again.' }, { status: 400 })
  return NextResponse.json({ ok: true })
}
