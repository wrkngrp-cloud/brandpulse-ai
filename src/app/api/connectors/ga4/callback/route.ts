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

interface PropertySummary {
  property:    string // "properties/123456789"
  displayName: string
}

interface AccountSummary {
  account:           string
  displayName:       string
  propertySummaries?: PropertySummary[]
}

interface AccountSummariesResponse {
  accountSummaries?: AccountSummary[]
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
  if (oauthError === 'access_denied') return fail('ga4_denied')
  if (!code) return fail('ga4_no_code')

  // Verify CSRF state
  const cookieStore = await cookies()
  const savedState  = cookieStore.get('ga4_oauth_state')?.value
  cookieStore.delete('ga4_oauth_state')

  if (!state || state !== savedState) return fail('ga4_invalid_state')

  // Exchange authorisation code for tokens
  const redirectUri = `${appUrl}/api/connectors/ga4/callback`
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  redirectUri,
      grant_type:    'authorization_code',
    }),
  })

  const tokens = (await tokenRes.json()) as TokenResponse
  if (!tokenRes.ok || tokens.error) return fail('ga4_token_failed')

  // Fetch GA4 property list via Analytics Admin API
  const propsRes = await fetch(
    'https://analyticsadmin.googleapis.com/v1beta/accountSummaries',
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  )

  let propertyId   = ''
  let propertyName = ''

  if (propsRes.ok) {
    const propsData = (await propsRes.json()) as AccountSummariesResponse
    const firstProp = propsData.accountSummaries?.[0]?.propertySummaries?.[0]
    if (firstProp) {
      // resource name is "properties/123456789" — strip prefix for API calls
      propertyId   = firstProp.property.replace('properties/', '')
      propertyName = firstProp.displayName
    }
  }

  if (!propertyId) return fail('ga4_no_property')

  // Save to DB
  const supabase  = await createClient()
  const brandId   = await getActiveBrandId(supabase)
  if (!brandId) return fail('ga4_no_brand')

  const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  const { error: dbErr } = await supabase
    .from('ga4_connections')
    .upsert(
      {
        brand_id:      brandId,
        property_id:   propertyId,
        property_name: propertyName,
        access_token:  encrypt(tokens.access_token),
        refresh_token: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        token_expiry:  tokenExpiry,
        updated_at:    new Date().toISOString(),
      },
      { onConflict: 'brand_id' }
    )

  if (dbErr) return fail('ga4_db_error')

  return NextResponse.redirect(`${appUrl}/dashboard/connectors?connected=ga4`)
}
