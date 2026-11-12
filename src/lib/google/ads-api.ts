/**
 * Which Google Ads API version we call.
 *
 * Google ships a new version roughly every month and switches each one off
 * about a year later; v17, which this was pinned to, stopped answering in
 * 2025. So the version is a setting: GOOGLE_ADS_API_VERSION (for example
 * "v23"). Check https://developers.google.com/google-ads/api/docs/sunset-dates
 * and move it forward before the one in use is switched off.
 */
export const GOOGLE_ADS_API_VERSION = (process.env.GOOGLE_ADS_API_VERSION?.trim() || 'v23').replace(/^(?!v)/, 'v')
export const GOOGLE_ADS_API = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`

export interface AdsCustomer { id: string; name: string | null; manager: boolean; currency: string | null }

/** Name, currency and whether it is a manager (MCC) account. */
export async function describeCustomer(customerId: string, accessToken: string, developerToken: string): Promise<AdsCustomer | null> {
  const res = await fetch(`${GOOGLE_ADS_API}/customers/${customerId}/googleAds:search`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'developer-token': developerToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'SELECT customer.id, customer.descriptive_name, customer.manager, customer.currency_code FROM customer LIMIT 1' }),
    cache: 'no-store',
  }).catch(() => null)
  if (!res?.ok) return null
  const body = await res.json().catch(() => ({})) as { results?: { customer?: { descriptiveName?: string; manager?: boolean; currencyCode?: string } }[] }
  const c = body.results?.[0]?.customer
  return c ? { id: customerId, name: c.descriptiveName ?? null, manager: !!c.manager, currency: c.currencyCode ?? null } : null
}
