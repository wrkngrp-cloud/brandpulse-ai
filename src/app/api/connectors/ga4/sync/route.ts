import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'
import { getActiveBrandId } from '@/lib/active-brand'

interface GA4MetricValue {
  value: string
}

interface GA4Row {
  metricValues: GA4MetricValue[]
}

interface GA4Response {
  totals?: GA4Row[]
  error?: { message: string; code: number }
}

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const { data: connection } = await supabase
    .from('ga4_connections')
    .select('id, property_id, access_token, refresh_token')
    .eq('brand_id', brandId)
    .single()

  if (!connection) {
    return NextResponse.json({ error: 'GA4 not connected' }, { status: 404 })
  }

  const accessToken = decrypt(connection.access_token)

  const ga4Res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${connection.property_id}:runReport`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        metrics: [
          { name: 'sessions' },
          { name: 'activeUsers' },
          { name: 'conversions' },
        ],
        metricAggregations: ['TOTAL'],
      }),
    }
  )

  if (!ga4Res.ok) {
    const errBody = await ga4Res.text()
    return NextResponse.json(
      { error: `GA4 API error: ${errBody}` },
      { status: 502 }
    )
  }

  const ga4Data = (await ga4Res.json()) as GA4Response

  if (ga4Data.error) {
    return NextResponse.json(
      { error: `GA4 API error: ${ga4Data.error.message}` },
      { status: 502 }
    )
  }

  const totals = ga4Data.totals?.[0]?.metricValues ?? []
  const sessions    = Number(totals[0]?.value ?? 0)
  const activeUsers = Number(totals[1]?.value ?? 0)
  const conversions = Number(totals[2]?.value ?? 0)

  const service = await createServiceClient()

  // sdk_events is a time-series log — insert a new snapshot each sync
  await service
    .from('sdk_events')
    .insert({
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
