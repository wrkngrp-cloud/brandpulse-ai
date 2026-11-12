import { NextResponse }                from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { fetchGa4Daily, saveGa4Daily } from '@/lib/ga4/report'
import { ga4AccessToken, type Ga4ConnectionRow } from '@/lib/shared-access/ga4-token'
import { getActiveBrandId }           from '@/lib/active-brand'


export const runtime    = 'nodejs'
export const maxDuration = 30

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  type Row = Ga4ConnectionRow & { property_id: string }
  const first = await supabase
    .from('ga4_connections')
    .select('id, property_id, access_token, refresh_token, token_expiry, auth_mode, access_status')
    .eq('brand_id', brandId)
    .returns<Row[]>()
    .maybeSingle()
  let connection = first.data
  if (first.error) {
    ;({ data: connection } = await supabase
      .from('ga4_connections')
      .select('id, property_id, access_token, refresh_token, token_expiry')
      .eq('brand_id', brandId)
      .returns<Row[]>()
      .maybeSingle())
  }

  if (!connection) {
    return NextResponse.json({ error: 'GA4 not connected' }, { status: 404 })
  }

  if (connection.auth_mode === 'shared' && connection.access_status !== 'active') {
    return NextResponse.json({ error: 'BrandGauge is still checking this connection. It starts syncing once confirmed.' }, { status: 409 })
  }
  const accessToken = await ga4AccessToken(connection, supabase)
  if (!accessToken) return NextResponse.json({ error: 'GA4 could not be read. Reconnect it and try again.' }, { status: 502 })

  const read = await fetchGa4Daily(connection.property_id, accessToken, 30)
  if (!read.ok) return NextResponse.json({ error: `GA4 did not answer: ${read.error}` }, { status: 502 })

  const service = await createServiceClient()
  const saveError = await saveGa4Daily(service, brandId, connection.id, read.days)
  if (saveError) return NextResponse.json({ error: 'GA4 answered, but the numbers did not save. Try again.' }, { status: 500 })

  const sum = (k: 'sessions' | 'activeUsers' | 'keyEvents') => read.days.reduce((n, d) => n + d[k], 0)
  return NextResponse.json({ success: true, days: read.days.length, sessions: sum('sessions'), activeUsers: sum('activeUsers'), keyEvents: sum('keyEvents') })
}
