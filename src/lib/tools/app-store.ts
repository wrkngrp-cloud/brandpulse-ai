/**
 * App Store release notes, as a dated source of competitor moves.
 *
 * For a fintech, a telco or a marketplace, the app is where a change actually
 * lands, and the release note is the competitor saying so in its own words,
 * with a date on it.
 *
 * The gate is their own website. We only look at an app store when their
 * homepage links to an app, and then we look up exactly that app by its id.
 * So an FMCG brand with no app is never checked, a drinks brand with a
 * loyalty app is checked (because the app is then a real channel for them),
 * and nobody else's app with a similar name can be mistaken for theirs.
 *
 * Apple publishes the latest version's notes and date through the iTunes
 * lookup API, no key needed. Google Play has no equivalent public API and its
 * markup changes too often to scrape without live testing, so a Play-only
 * brand is reported as such rather than guessed at.
 */

import type { PageFacts } from './html'

export interface AppRelease {
  appName:    string
  version:    string
  releasedAt: string        // ISO date, YYYY-MM-DD
  notes:      string
  url:        string
}

export interface AppStoreRead {
  /** False when the site links to no app, so nothing was checked. */
  checked:  boolean
  ok:       boolean
  release:  AppRelease | null
  /** Plain sentence for the coverage list. */
  note:     string
}

export interface AppLinks {
  appleId:     string | null
  playPackage: string | null
}

/** The apps their own homepage links to. */
export function findAppLinks(facts: Pick<PageFacts, 'links'>): AppLinks {
  let appleId: string | null = null
  let playPackage: string | null = null
  for (const { href } of facts.links) {
    if (!appleId) {
      const m = /(?:apps|itunes)\.apple\.com\/[^\s"']*?\/id(\d{6,12})/i.exec(href)
      if (m) appleId = m[1]
    }
    if (!playPackage) {
      const m = /play\.google\.com\/store\/apps\/details\?(?:[^\s"']*&)?id=([A-Za-z0-9_.]+)/i.exec(href)
      if (m) playPackage = m[1]
    }
  }
  return { appleId, playPackage }
}

/** Notes that say nothing a marketer could act on. Most apps ship these most
 *  weeks, and a brief that reports "bug fixes" as a move is the shallow
 *  output this exists to replace. */
export function isGenericNote(notes: string): boolean {
  const text = notes.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim()
  if (text.length < 40) return true
  const filler = /\b(bug fixes?|fixed bugs|performance improvements?|stability improvements?|minor (fixes|improvements|updates)|general improvements?|we update the app regularly|thanks for using|improvements and fixes)\b/g
  const stripped = text.replace(filler, '').replace(/\b(and|we|have|made|some|various|to|the|app|this|update|version|includes?|for|a|of|with|our|you|your|it|make|better|regularly)\b/g, '').replace(/\s+/g, ' ').trim()
  return stripped.length < 25
}

interface ItunesResult {
  trackName?:                 string
  version?:                   string
  currentVersionReleaseDate?: string
  releaseNotes?:              string
  trackViewUrl?:              string
}

export async function fetchAppStoreRelease(args: { links: AppLinks; days: number; country?: string }): Promise<AppStoreRead> {
  const { appleId, playPackage } = args.links
  if (!appleId && !playPackage) {
    return { checked: false, ok: true, release: null, note: 'Their website links to no app, so app stores were not checked.' }
  }
  if (!appleId) {
    return { checked: false, ok: true, release: null, note: 'Their website links to an Android app only, and Google Play release notes are not read yet.' }
  }

  const country = args.country ?? 'ng'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6_000)
  let app: ItunesResult | undefined
  try {
    const res = await fetch(`https://itunes.apple.com/lookup?id=${appleId}&country=${country}`, { signal: controller.signal, cache: 'no-store' })
    if (!res.ok) return { checked: true, ok: false, release: null, note: 'The App Store did not answer.' }
    app = ((await res.json()) as { results?: ItunesResult[] }).results?.[0]
  } catch {
    return { checked: true, ok: false, release: null, note: 'The App Store did not answer in time.' }
  } finally {
    clearTimeout(timer)
  }
  const play = playPackage ? ' Google Play is not read yet.' : ''

  if (!app) return { checked: true, ok: true, release: null, note: `Their iPhone app is not listed in the Nigerian App Store.${play}` }
  const released = app.currentVersionReleaseDate ? new Date(app.currentVersionReleaseDate) : null
  if (!released || Number.isNaN(released.getTime())) {
    return { checked: true, ok: true, release: null, note: `Their app listing carries no release date.${play}` }
  }
  if ((Date.now() - released.getTime()) / 86_400_000 > args.days) {
    return { checked: true, ok: true, release: null, note: `Their latest iPhone app update is older than ${args.days} days.${play}` }
  }
  const notes = (app.releaseNotes ?? '').trim()
  if (!notes || isGenericNote(notes)) {
    return { checked: true, ok: true, release: null, note: `Their latest iPhone app update says only bug fixes and improvements.${play}` }
  }

  return {
    checked: true,
    ok: true,
    note: `Read their latest iPhone app release.${play}`,
    release: {
      appName:    app.trackName ?? 'Their app',
      version:    app.version ?? '',
      releasedAt: released.toISOString().slice(0, 10),
      notes:      notes.slice(0, 1500),
      url:        app.trackViewUrl ?? `https://apps.apple.com/${country}/app/id${appleId}`,
    },
  }
}
