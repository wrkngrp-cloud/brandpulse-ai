import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

/**
 * The only way these tools touch a URL a stranger typed.
 *
 * Everything public here takes a website address from an anonymous visitor and
 * fetches it from our servers, which is the textbook setup for SSRF: give it
 * http://169.254.169.254/ and a naive fetch hands back cloud instance
 * metadata. `scrapeWebsite()` in the brand-infer route is a plain fetch, and
 * that is defensible there because the caller is already signed in and the URL
 * is their own brand's; it is not defensible here.
 *
 * So: scheme allowlist, no credentials in the URL, DNS resolution checked
 * against the private ranges before the socket opens, redirects followed by
 * hand so each hop is checked the same way, a byte cap, a content-type
 * allowlist and a timeout. A blocked address is reported as blocked rather
 * than as an empty page, because the tools must be able to say what they could
 * not read.
 */

const MAX_BYTES    = 1_500_000      // ~1.5MB of HTML is already far more than any parse needs
const MAX_REDIRECTS = 3
const TIMEOUT_MS   = 9_000

const UA = 'Mozilla/5.0 (compatible; BrandGaugeBot/1.0; +https://brandgauge.app/tools)'

const ALLOWED_TYPES = ['text/html', 'application/xhtml+xml', 'text/plain', 'application/xml', 'text/xml', 'application/rss+xml']

export type FetchFailure =
  | 'invalid_url'
  | 'blocked_address'
  | 'dns_failed'
  | 'timeout'
  | 'http_error'
  | 'unsupported_type'
  | 'too_large'
  | 'network_error'
  | 'too_many_redirects'

export interface PublicFetchOk {
  ok:          true
  url:         string      // the final URL after redirects
  status:      number
  contentType: string
  body:        string
  /** Wall-clock milliseconds for the whole fetch, used by the audit's
   *  "this is not a performance measurement" caveat. */
  elapsedMs:   number
}

export interface PublicFetchErr {
  ok:      false
  url:     string
  failure: FetchFailure
  status?: number
  /** For the server log. Never rendered to a visitor verbatim. */
  detail?: string
}

export type PublicFetchResult = PublicFetchOk | PublicFetchErr

/** Normalise what a human types into something fetchable. "acme.ng" and
 *  "ACME.ng/path " both become https://acme.ng/... */
export function normaliseUrl(input: string): URL | null {
  const raw = input.trim()
  if (!raw) return null
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const url = new URL(withScheme)
    if (url.username || url.password) return null
    /* A hostname with no dot is usually a typo, so it is refused here rather
       than fetched. Two exceptions pass through on purpose: an IPv6 literal
       (hostname "[::1]") and a bare internal name such as "localhost". Those
       are not typos, they are attempts to reach inside the network, and they
       belong to screenHost so the caller is told "blocked" rather than
       "invalid" and the report's coverage note says the true thing. */
    const host = url.hostname
    const bareInternal = host === 'localhost' || host.endsWith('.localhost')
    if (!host.includes('.') && !host.startsWith('[') && !bareInternal) return null
    return url
  } catch {
    return null
  }
}

/** Hostname → the registrable-looking root, for comparing two URLs without
 *  pulling in a public-suffix list. Good enough to tell acme.com from
 *  competitor.com, which is all the callers ask. */
export function rootHost(hostname: string): string {
  return hostname.replace(/^www\./i, '').toLowerCase()
}

function isPrivateAddress(addr: string): boolean {
  if (isIP(addr) === 6) {
    const a = addr.toLowerCase()
    if (a === '::1' || a === '::') return true
    if (a.startsWith('fe80') || a.startsWith('fc') || a.startsWith('fd')) return true
    /* IPv4-mapped addresses carry the v4 rules with them, and they arrive in
       two shapes. A visitor types ::ffff:10.0.0.1, but the WHATWG URL parser
       serialises the host as ::ffff:a00:1 — the same address in hex — so
       matching only the dotted form let 10.0.0.1 through the screen. Both
       forms are decoded here. */
    const dotted = /::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(a)
    if (dotted) return isPrivateAddress(dotted[1])
    const hex = /::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(a)
    if (hex) {
      const high = parseInt(hex[1], 16)
      const low  = parseInt(hex[2], 16)
      return isPrivateAddress(`${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`)
    }
    return false
  }
  const p = addr.split('.').map(Number)
  if (p.length !== 4 || p.some(n => Number.isNaN(n))) return true
  const [a, b] = p
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 169 && b === 254) return true            // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 192 && b === 0 && p[2] === 2) return true
  if (a === 100 && b >= 64 && b <= 127) return true  // carrier-grade NAT
  if (a >= 224) return true                          // multicast and reserved
  return false
}

/** Resolve and reject anything that points inside the network. Returns null
 *  when the host is fine, or the failure to report. */
async function screenHost(url: URL): Promise<FetchFailure | null> {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'invalid_url'
  // url.hostname keeps the brackets on an IPv6 literal; isIP does not want them.
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) return 'blocked_address'
  if (isIP(host)) return isPrivateAddress(host) ? 'blocked_address' : null
  try {
    const addrs = await lookup(host, { all: true })
    if (!addrs.length) return 'dns_failed'
    if (addrs.some(a => isPrivateAddress(a.address))) return 'blocked_address'
    return null
  } catch {
    return 'dns_failed'
  }
}

/**
 * Fetch a public page safely. Redirects are followed by hand so every hop is
 * screened; `redirect: 'manual'` is the point of this function, not an
 * optimisation.
 */
export async function fetchPublic(input: string | URL, opts?: { maxBytes?: number; timeoutMs?: number }): Promise<PublicFetchResult> {
  const first = input instanceof URL ? input : normaliseUrl(input)
  if (!first) return { ok: false, url: String(input), failure: 'invalid_url' }

  const maxBytes = opts?.maxBytes ?? MAX_BYTES
  const started  = Date.now()
  let url = first

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const blocked = await screenHost(url)
    if (blocked) return { ok: false, url: url.toString(), failure: blocked }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), opts?.timeoutMs ?? TIMEOUT_MS)
    let res: Response
    try {
      res = await fetch(url.toString(), {
        signal:   controller.signal,
        redirect: 'manual',
        headers:  { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5' },
        cache:    'no-store',
      })
    } catch (err) {
      clearTimeout(timer)
      const aborted = err instanceof Error && err.name === 'AbortError'
      return {
        ok: false, url: url.toString(),
        failure: aborted ? 'timeout' : 'network_error',
        detail: err instanceof Error ? err.message : String(err),
      }
    }
    clearTimeout(timer)

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      if (!loc) return { ok: false, url: url.toString(), failure: 'http_error', status: res.status }
      let next: URL
      try { next = new URL(loc, url) } catch { return { ok: false, url: url.toString(), failure: 'invalid_url' } }
      if (next.username || next.password) return { ok: false, url: next.toString(), failure: 'blocked_address' }
      url = next
      continue
    }

    if (!res.ok) {
      return { ok: false, url: url.toString(), failure: 'http_error', status: res.status }
    }

    const contentType = (res.headers.get('content-type') ?? '').toLowerCase()
    if (contentType && !ALLOWED_TYPES.some(t => contentType.includes(t))) {
      return { ok: false, url: url.toString(), failure: 'unsupported_type', detail: contentType }
    }

    const declared = Number(res.headers.get('content-length') ?? '0')
    if (declared > maxBytes) return { ok: false, url: url.toString(), failure: 'too_large' }

    // Stream so a server that lies about content-length cannot hand us a
    // gigabyte. Everything past the cap is dropped, not buffered.
    const reader = res.body?.getReader()
    if (!reader) return { ok: false, url: url.toString(), failure: 'network_error', detail: 'no body' }
    const chunks: Uint8Array[] = []
    let total = 0
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (!value) continue
        total += value.byteLength
        if (total > maxBytes) { await reader.cancel().catch(() => {}); break }
        chunks.push(value)
      }
    } catch (err) {
      return { ok: false, url: url.toString(), failure: 'network_error', detail: err instanceof Error ? err.message : String(err) }
    }

    const buf = Buffer.concat(chunks.map(c => Buffer.from(c)))
    return {
      ok: true,
      url: url.toString(),
      status: res.status,
      contentType: contentType || 'text/html',
      body: buf.toString('utf8'),
      elapsedMs: Date.now() - started,
    }
  }

  return { ok: false, url: url.toString(), failure: 'too_many_redirects' }
}

/** Plain-language reason, for a report's coverage block. */
export function failureSentence(f: FetchFailure): string {
  switch (f) {
    case 'invalid_url':        return 'That address did not parse as a website.'
    case 'blocked_address':    return 'That address points inside a private network, so we did not fetch it.'
    case 'dns_failed':         return 'We could not resolve that domain.'
    case 'timeout':            return 'The site did not answer in time.'
    case 'http_error':         return 'The site refused our request.'
    case 'unsupported_type':   return 'That address did not return a web page.'
    case 'too_large':          return 'That page was too large to read.'
    case 'too_many_redirects': return 'That address redirected too many times.'
    case 'network_error':      return 'We could not reach that page.'
  }
}

/**
 * robots.txt, honoured for the paths we go looking for ourselves.
 *
 * The page a visitor hands us is theirs and they asked for it to be read. The
 * extra pages we guess at (/pricing, /news) are our own idea, so those are
 * checked first. Deliberately small: group-agnostic Disallow prefixes under
 * `*` and our own agent, which is what a marketing site actually publishes.
 */
export async function robotsDisallows(origin: string): Promise<string[]> {
  const res = await fetchPublic(`${origin.replace(/\/$/, '')}/robots.txt`, { maxBytes: 100_000, timeoutMs: 5_000 })
  if (!res.ok) return []
  const lines = res.body.split('\n').map(l => l.replace(/#.*$/, '').trim())
  const disallows: string[] = []
  let applies = false
  for (const line of lines) {
    const ua = /^user-agent:\s*(.+)$/i.exec(line)
    if (ua) {
      const name = ua[1].trim().toLowerCase()
      applies = name === '*' || name.includes('brandgauge')
      continue
    }
    const dis = /^disallow:\s*(.*)$/i.exec(line)
    if (dis && applies) {
      const path = dis[1].trim()
      if (path) disallows.push(path)
    }
  }
  return disallows
}

export function pathAllowed(path: string, disallows: string[]): boolean {
  return !disallows.some(d => d === '/' ? true : path.startsWith(d))
}
