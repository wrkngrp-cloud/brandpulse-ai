import { NextResponse } from 'next/server'
import { cookies }      from 'next/headers'
import { randomBytes }  from 'crypto'
import { createClient } from '@/lib/supabase/server'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const SCOPE = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/analytics.manage.users.readonly',
].join(' ')

export async function GET() {
  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? ''

  if (!process.env.GOOGLE_CLIENT_ID) {
    return NextResponse.redirect(`${appUrl}/dashboard/connectors?error=ga4_not_configured`)
  }

  // Must be authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${appUrl}/auth/login`)

  // CSRF state — stored in an httpOnly cookie
  const state = randomBytes(20).toString('hex')
  const cookieStore = await cookies()
  cookieStore.set('ga4_oauth_state', state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    maxAge:   600, // 10 minutes
    path:     '/',
    sameSite: 'lax',
  })

  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID,
    redirect_uri:  `${appUrl}/api/connectors/ga4/callback`,
    response_type: 'code',
    scope:         SCOPE,
    access_type:   'offline',
    prompt:        'consent', // always re-consent so we always get a refresh_token
    state,
  })

  return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`)
}
