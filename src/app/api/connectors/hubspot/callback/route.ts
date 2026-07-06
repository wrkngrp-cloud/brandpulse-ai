import { NextRequest, NextResponse } from 'next/server'
import { cookies }                    from 'next/headers'
import { createClient }               from '@/lib/supabase/server'
import { encrypt }                    from '@/lib/crypto'
import { getActiveBrandId }           from '@/lib/active-brand'

interface TokenResponse {
  access_token:  string
  refresh_token?: string
  expires_in:    number
  token_type:    string
  error?:        string
  error_description?: string
}

interface AccessTokenInfo {
  hub_id?: number
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code       = searchParams.get('code')
  const state      = searchParams.get('state')
  const oauthError = searchParams.get('error')

  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? ''
  const fail   = (reason: string) =>
    NextResponse.redirect(`${appUrl}/dashboard/connectors?error=${reason}`)

  // User denied access
  if (oauthError === 'access_denied') return fail('hubspot_denied')
  if (!code) return fail('hubspot_no_code')

  // Verify CSRF state
  const cookieStore = await cookies()
  const savedState  = cookieStore.get('hubspot_oauth_state')?.value
  cookieStore.delete('hubspot_oauth_state')

  if (!state || state !== savedState) return fail('hubspot_invalid_state')

  // Exchange authorisation code for tokens
  const redirectUri = `${appUrl}/api/connectors/hubspot/callback`
  const tokenRes = await fetch('https://api.hubapi.com/oauth/v1/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type:    'authorization_code',
      client_id:     process.env.HUBSPOT_CLIENT_ID!,
      client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
      redirect_uri:  redirectUri,
      code,
    }),
  })

  const tokens = (await tokenRes.json()) as TokenResponse
  if (!tokenRes.ok || tokens.error || !tokens.access_token) return fail('hubspot_token_failed')

  // Fetch the portal (hub) ID for display
  let portalId: string | null = null
  const infoRes = await fetch(
    `https://api.hubapi.com/oauth/v1/access-tokens/${tokens.access_token}`
  )
  if (infoRes.ok) {
    const info = (await infoRes.json()) as AccessTokenInfo
    if (info.hub_id) portalId = String(info.hub_id)
  }

  // Save to DB
  const supabase = await createClient()
  const brandId  = await getActiveBrandId(supabase)
  if (!brandId) return fail('hubspot_no_brand')

  const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  const { error: dbErr } = await supabase
    .from('hubspot_connections')
    .upsert(
      {
        brand_id:      brandId,
        portal_id:     portalId,
        access_token:  encrypt(tokens.access_token),
        refresh_token: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        token_expiry:  tokenExpiry,
        last_error:    null,
        updated_at:    new Date().toISOString(),
      },
      { onConflict: 'brand_id' }
    )

  if (dbErr) return fail('hubspot_db_error')

  return NextResponse.redirect(`${appUrl}/dashboard/connectors?connected=hubspot`)
}
