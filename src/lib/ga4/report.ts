import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Read GA4 by day and save it. Shared by the nightly job and "Sync now", so
 * both write the same rows the same way.
 *
 * `keyEvents` is Google's 2024 rename of `conversions`. The `date` dimension
 * gives one row per day, which is what makes a trend possible; a single
 * 30-day total, which is all the sync used to fetch, cannot show one.
 */
export interface Ga4Day { day: string; sessions: number; activeUsers: number; keyEvents: number }

export type Ga4Read = { ok: true; days: Ga4Day[] } | { ok: false; status: number; error: string }

export async function fetchGa4Daily(propertyId: string, accessToken: string, days = 30): Promise<Ga4Read> {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'yesterday' }],
      dimensions: [{ name: 'date' }],
      metrics:    [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'keyEvents' }],
      orderBys:   [{ dimension: { dimensionName: 'date' } }],
      limit:      400,
    }),
    cache: 'no-store',
  })
  const body = await res.json().catch(() => ({})) as {
    rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[]
    error?: { message?: string }
  }
  if (!res.ok || body.error) return { ok: false, status: res.status, error: body.error?.message ?? `GA4 answered ${res.status}` }
  return {
    ok: true,
    days: (body.rows ?? []).map(r => {
      const d = r.dimensionValues[0].value // YYYYMMDD
      return {
        day: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
        sessions:    Number(r.metricValues[0]?.value ?? 0),
        activeUsers: Number(r.metricValues[1]?.value ?? 0),
        keyEvents:   Number(r.metricValues[2]?.value ?? 0),
      }
    }),
  }
}

/** Save days, then stamp the connection. Only stamps when the save worked. */
export async function saveGa4Daily(db: SupabaseClient, brandId: string, connectionId: string, days: Ga4Day[]): Promise<string | null> {
  if (days.length) {
    const { error } = await db.from('ga4_daily').upsert(days.map(d => ({
      brand_id: brandId, day: d.day, sessions: d.sessions, active_users: d.activeUsers, key_events: d.keyEvents,
      synced_at: new Date().toISOString(),
    })), { onConflict: 'brand_id,day' })
    if (error) return error.message
  }
  await db.from('ga4_connections').update({ last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', connectionId)
  return null
}
