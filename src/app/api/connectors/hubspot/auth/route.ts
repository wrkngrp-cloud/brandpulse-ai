import { NextResponse } from 'next/server'
import { cookies }      from 'next/headers'
import { randomBytes }  from 'crypto'
import { createClient } from '@/lib/supabase/server'

const HUBSPOT_AUTH_URL = 'https://app.hubspot.com/oauth/authorize'
// Read-only: this connector only ever reads contact lifecycle-stage counts.
const SCOPE = 'crm.objects.contacts.read'

export async function GET() {
  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? ''

  if (!process.env.HUBSPOT_CLIENT_ID) {
    return NextResponse.redirect(`${appUrl}/dashboard/connectors?error=hubspot_not_configured`)
  }

  // Must be authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${appUrl}/auth/login`)

  // CSRF state — stored in an httpOnly cookie
  const state = randomBytes(20).toString('hex')
  const cookieStore = await cookies()
  cookieStore.set('hubspot_oauth_state', state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    maxAge:   600, // 10 minutes
    path:     '/',
    sameSite: 'lax',
  })

  const params = new URLSearchParams({
    client_id:    process.env.HUBSPOT_CLIENT_ID,
    redirect_uri: `${appUrl}/api/connectors/hubspot/callback`,
    scope:        SCOPE,
    state,
  })

  return NextResponse.redirect(`${HUBSPOT_AUTH_URL}?${params.toString()}`)
}
