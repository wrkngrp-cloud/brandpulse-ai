/**
 * Check a pasted credential with the provider before we save it.
 *
 * Mailchimp, Brevo and the App Store card saved whatever was typed and then
 * showed "Connected", so a typo or a key from the wrong account looked like a
 * working connector until the numbers never arrived. Each check here makes
 * the cheapest read the provider offers with that credential.
 */
export type KeyCheck = { ok: true; label?: string } | { ok: false; error: string }

async function timed(url: string, init: RequestInit): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8_000)
  try { return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' }) }
  catch { return null }
  finally { clearTimeout(timer) }
}

export async function checkMailchimpKey(key: string, listId?: string | null): Promise<KeyCheck> {
  // A Mailchimp key ends in its data centre: abc123...-us21.
  const dc = /-([a-z]{2,4}\d{1,3})$/.exec(key.trim())?.[1]
  if (!dc) return { ok: false, error: 'That does not look like a Mailchimp API key. It should end in something like -us21.' }
  const auth = { Authorization: `Basic ${Buffer.from(`brandgauge:${key.trim()}`).toString('base64')}` }
  const ping = await timed(`https://${dc}.api.mailchimp.com/3.0/ping`, { headers: auth })
  if (!ping) return { ok: false, error: 'Mailchimp did not answer. Try again in a minute.' }
  if (ping.status === 401 || ping.status === 403) return { ok: false, error: 'Mailchimp did not accept that key. Check it under Account, Extras, API keys.' }
  if (!ping.ok) return { ok: false, error: 'Mailchimp did not accept that key.' }
  if (listId?.trim()) {
    const list = await timed(`https://${dc}.api.mailchimp.com/3.0/lists/${encodeURIComponent(listId.trim())}?fields=name`, { headers: auth })
    if (!list?.ok) return { ok: false, error: 'The key works, but we could not find that audience ID in this account.' }
    const name = ((await list.json().catch(() => ({}))) as { name?: string }).name
    return { ok: true, label: name }
  }
  return { ok: true }
}

export async function checkBrevoKey(key: string): Promise<KeyCheck> {
  const res = await timed('https://api.brevo.com/v3/account', { headers: { 'api-key': key.trim(), accept: 'application/json' } })
  if (!res) return { ok: false, error: 'Brevo did not answer. Try again in a minute.' }
  if (res.status === 401 || res.status === 403) return { ok: false, error: 'Brevo did not accept that key. Create one under SMTP & API, API keys.' }
  if (!res.ok) return { ok: false, error: 'Brevo did not accept that key.' }
  const body = await res.json().catch(() => ({})) as { companyName?: string }
  return { ok: true, label: body.companyName }
}

export async function checkAppleAppId(id: string): Promise<KeyCheck> {
  const digits = /(?:id)?(\d{6,12})/.exec(id.trim())?.[1]
  if (!digits) return { ok: false, error: 'An Apple App ID is a number, like 1234567890. It is in your App Store link after "id".' }
  const res = await timed(`https://itunes.apple.com/lookup?id=${digits}`, {})
  if (!res?.ok) return { ok: false, error: 'The App Store did not answer. Try again in a minute.' }
  const body = await res.json().catch(() => ({})) as { resultCount?: number; results?: { trackName?: string }[] }
  if (!body.resultCount) return { ok: false, error: 'We could not find an app with that ID in the App Store.' }
  return { ok: true, label: body.results?.[0]?.trackName }
}

/** Google Play has no public lookup, so only the shape is checked. */
export function checkPlayPackage(pkg: string): KeyCheck {
  return /^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)+$/.test(pkg.trim())
    ? { ok: true }
    : { ok: false, error: 'A Google Play package name looks like com.yourbrand.app. It is in your Play Store link after "id=".' }
}

export function appleIdDigits(id: string): string {
  return /(?:id)?(\d{6,12})/.exec(id.trim())?.[1] ?? id.trim()
}
