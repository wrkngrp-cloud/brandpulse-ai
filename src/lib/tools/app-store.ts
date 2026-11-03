/**
 * App Store release notes, as a dated source of competitor moves.
 *
 * For a fintech, a telco or a marketplace, the app is where a change actually
 * lands, and the release note is the competitor saying so in its own words,
 * with a date on it. That makes it one of the few free sources that can carry
 * a change claim ("they added X this week") rather than a status claim.
 *
 * Apple publishes this through the iTunes Search API: no key, the current
 * version's notes and its release date. It only ever holds the latest version,
 * which is exactly the recent slice we want.
 *
 * Google Play has no equivalent public API, and its page markup changes often
 * enough that a scraper written without live testing would break silently.
 * It is not read here; the coverage note says so.
 */

export interface AppRelease {
  appName:    string
  version:    string
  releasedAt: string        // ISO date, YYYY-MM-DD
  notes:      string
  url:        string
}

export interface AppStoreRead {
  ok:       boolean
  /** Null when we found their app but its latest notes are old or empty. */
  release:  AppRelease | null
  /** Plain sentence for the coverage list. */
  note?:    string
}

interface ItunesResult {
  trackName?:                string
  sellerName?:               string
  sellerUrl?:                string
  artistName?:               string
  version?:                  string
  currentVersionReleaseDate?: string
  releaseNotes?:             string
  trackViewUrl?:             string
}

/** Notes that say nothing a marketer could act on. Most apps ship these most
 *  weeks, and a brief that reports "bug fixes" as a move is the shallow
 *  output this exists to replace. */
export function isGenericNote(notes: string): boolean {
  const text = notes.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim()
  if (text.length < 40) return true
  const filler = /\b(bug fixes?|fixed bugs|performance improvements?|stability improvements?|minor (fixes|improvements|updates)|general improvements?|we update the app regularly|thanks for using|improvements and fixes)\b/g
  const stripped = text.replace(filler, '').replace(/\b(and|we|have|made|some|various|to|the|app|this|update|version|includes?|for|a|of|with|our|you|your)\b/g, '').replace(/\s+/g, ' ').trim()
  return stripped.length < 25
}

/** Which result is theirs. Their own website on the listing is the strongest
 *  tie; failing that, the seller or app name has to start with their name. */
export function pickTheirApp(results: ItunesResult[], name: string, host: string): ItunesResult | null {
  const bare = host.replace(/^www\./, '').toLowerCase()
  const byHost = results.find(r => {
    try { return r.sellerUrl && new URL(r.sellerUrl).hostname.replace(/^www\./, '').toLowerCase().endsWith(bare) } catch { return false }
  })
  if (byHost) return byHost
  const n = name.toLowerCase().trim()
  return results.find(r =>
    (r.sellerName ?? r.artistName ?? '').toLowerCase().startsWith(n)
    || (r.trackName ?? '').toLowerCase().startsWith(n),
  ) ?? null
}

export async function fetchAppStoreRelease(args: { name: string; host: string; days: number; country?: string }): Promise<AppStoreRead> {
  const country = args.country ?? 'ng'
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(args.name)}&country=${country}&entity=software&limit=8`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6_000)
  let results: ItunesResult[]
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' })
    if (!res.ok) return { ok: false, release: null, note: 'The App Store did not answer.' }
    results = ((await res.json()) as { results?: ItunesResult[] }).results ?? []
  } catch {
    return { ok: false, release: null, note: 'The App Store did not answer in time.' }
  } finally {
    clearTimeout(timer)
  }

  const app = pickTheirApp(results, args.name, args.host)
  if (!app) return { ok: true, release: null, note: `No iPhone app from ${args.name} in the Nigerian App Store.` }

  const released = app.currentVersionReleaseDate ? new Date(app.currentVersionReleaseDate) : null
  if (!released || Number.isNaN(released.getTime())) {
    return { ok: true, release: null, note: 'Their app listing carries no release date.' }
  }
  const ageDays = (Date.now() - released.getTime()) / 86_400_000
  if (ageDays > args.days) {
    return { ok: true, release: null, note: `Their latest app update is older than ${args.days} days.` }
  }
  const notes = (app.releaseNotes ?? '').trim()
  if (!notes || isGenericNote(notes)) {
    return { ok: true, release: null, note: 'Their latest app update says only bug fixes and improvements.' }
  }

  return {
    ok: true,
    release: {
      appName:    app.trackName ?? args.name,
      version:    app.version ?? '',
      releasedAt: released.toISOString().slice(0, 10),
      notes:      notes.slice(0, 1500),
      url:        app.trackViewUrl ?? `https://apps.apple.com/${country}/search?term=${encodeURIComponent(args.name)}`,
    },
  }
}
