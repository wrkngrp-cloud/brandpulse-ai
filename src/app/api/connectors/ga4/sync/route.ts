import { NextResponse }                from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { encrypt, decrypt }           from '@/lib/crypto'
import { getActiveBrandId }           from '@/lib/active-brand'

interface GA4MetricValue { value: string }
interface GA4Row         { metricValues: GA4MetricValue[] }
interface GA4Response    { totals?: GA4Row[]; error?: { message: string } }

interface TokenRefreshResponse {
  access_token: string
  expires_in:   number
  error?:       string
}

export const runtime    = 'nodejs'
export const maxDuration = 30

async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number } | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type:    'refresh_token',
    }),
  })
  const data = (await res.json()) as TokenRefreshResponse
  if (!res.ok || data.error) return null
  return { access_token: data.access_token, expires_in: data.expires_in }
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const { data: connection } = await supabase
    .from('ga4_connections')
    .select('id, property_id, access_token, refresh_token, token_expiry')
    .eq('brand_id', brandId)
    .single()

  if (!connection) {
    return NextResponse.json({ error: 'GA4 not connected' }, { status: 404 })
  }

  let accessToken = decrypt(connection.access_token)

  // Refresh token if expired (or within 2 minutes of expiry)
  const expiry = connection.token_expiry ? new Date(connection.token_expiry).getTime() : 0
  if (connection.refresh_token && Date.now() > expiry - 120_000) {
    const refreshed = await refreshAccessToken(decrypt(connection.refresh_token))
    if (refreshed) {
      accessToken = refreshed.access_token
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
      await supabase
        .from('ga4_connections')
        .update({
          access_token: encrypt(refreshed.access_token),
          token_expiry: newExpiry,
          updated_at:   new Date().toISOString(),
        })
        .eq('brand_id', brandId)
    }
  }

  const ga4Res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${connection.property_id}:runReport`,
    {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges:          [{ startDate: '30daysAgo', endDate: 'today' }],
        metrics:             [
          { name: 'sessions'     },
          { name: 'activeUsers'  },
          { name: 'conversions'  },
        ],
        metricAggregations: ['TOTAL'],
      }),
    }
  )

  if (!ga4Res.ok) {
    const errBody = await ga4Res.text()
    return NextResponse.json({ error: `GA4 API error: ${errBody}` }, { status: 502 })
  }

  const ga4Data = (await ga4Res.json()) as GA4Response
  if (ga4Data.error) {
    return NextResponse.json({ error: `GA4 API error: ${ga4Data.error.message}` }, { status: 502 })
  }

  const totals      = ga4Data.totals?.[0]?.metricValues ?? []
  const sessions    = Number(totals[0]?.value ?? 0)
  const activeUsers = Number(totals[1]?.value ?? 0)
  const conversions = Number(totals[2]?.value ?? 0)

  const service = await createServiceClient()
  await service.from('sdk_events').insert({
    brand_id:    brandId,
    event_type:  'ga4_sessions',
    value:       sessions,
    metadata:    { activeUsers, conversions },
    occurred_at: new Date().toISOString(),
  })

  await service
    .from('ga4_connections')
    .update({ last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('brand_id', brandId)

  return NextResponse.json({ success: true, sessions, activeUsers, conversions })
}
