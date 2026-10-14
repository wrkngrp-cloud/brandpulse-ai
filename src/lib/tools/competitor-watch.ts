import { createHash } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchGoogleNewsRss, pressQuery, parsePubDate } from '@/lib/press/nigerian-press'
import { fetchPublic, robotsDisallows, pathAllowed } from './fetch-public'
import { findSectionLinks, readPage } from './html'
import { runCompetitorTracker } from './competitor-tracker'

/**
 * Checking a watched competitor again.
 *
 * The free report is a snapshot. The watch is the thing a marketer actually
 * wants: tell me when it changes. That means this function's whole job is
 * telling three states apart, because collapsing them is how an alerting
 * feature loses trust in a fortnight:
 *
 *   a new verified announcement   — a dated press story we have not stored
 *   a detected website change     — their homepage or pricing text now hashes
 *                                   differently than it did
 *   previously known information  — already in competitor_moves, say nothing
 *
 * The second is weaker than the first and is stored as `site_change`, so the
 * UI can say "their pricing page changed" without claiming to know what the
 * change was or that it is a price cut.
 *
 * Deduplication is by fingerprint, unique per brand, so the same story
 * surfacing in two outlets or across two weeks does not alert twice.
 */

const hash = (s: string) => createHash('sha256').update(s).digest('hex')

export interface WatchRow {
  id:              string
  brand_id:        string
  competitor_id:   string | null
  competitor_name: string
  website_url:     string
  market:          string | null
  home_hash:       string | null
  pricing_hash:    string | null
}

export interface WatchCheck {
  watchId:      string
  newMoves:     number
  siteChanges:  number
  alreadyKnown: number
  errors:       string[]
}

const PRICING_PATTERNS = [/pricing/i, /\/plans?/i, /\/price/i, /tariff/i, /fees/i]

export async function checkWatch(watch: WatchRow): Promise<WatchCheck> {
  const svc = await createServiceClient()
  const out: WatchCheck = { watchId: watch.id, newMoves: 0, siteChanges: 0, alreadyKnown: 0, errors: [] }

  // What we already hold for this competitor, so "new" means new.
  const { data: known } = await svc
    .from('competitor_moves')
    .select('fingerprint')
    .eq('brand_id', watch.brand_id)
  const seen = new Set((known ?? []).map(k => k.fingerprint as string))

  // ── 1. Press, since the last check ──────────────────────────────────────
  const feed = await fetchGoogleNewsRss(pressQuery(watch.competitor_name))
  if (!feed.ok) {
    out.errors.push(`press feed unavailable: ${feed.error ?? 'unknown'}`)
  }

  const firstWord = watch.competitor_name.toLowerCase().split(/\s+/)[0]
  const fresh = feed.items.filter(i => i.title.toLowerCase().includes(firstWord))

  for (const item of fresh.slice(0, 12)) {
    const fp = moveFingerprint('company', item.link, item.title)
    if (seen.has(fp)) { out.alreadyKnown++; continue }

    /* Stored uncategorised and unexplained rather than run through the model
       one story at a time. A weekly check across every watched competitor
       would otherwise be one AI call per headline, which is the cost profile
       that kills a free feature. The watchlist screen asks for the reading on
       demand, for the stories the marketer actually opens. */
    const { error } = await svc.from('competitor_moves').insert({
      brand_id:        watch.brand_id,
      competitor_id:   watch.competitor_id,
      competitor_name: watch.competitor_name,
      category:        'company',
      headline:        item.title.slice(0, 500),
      source_url:      item.link,
      source_kind:     'press',
      quote:           item.snippet.slice(0, 240) || null,
      published_at:    parsePubDate(item.pubDate),
      confidence:      'medium',
      is_baseline:     false,
      fingerprint:     fp,
    })
    if (error) {
      // A duplicate is the expected collision and is not worth a log line.
      if (!error.message.includes('duplicate')) out.errors.push(error.message)
      else out.alreadyKnown++
    } else {
      out.newMoves++
      seen.add(fp)
    }
  }

  // ── 2. Their pages, hashed ───────────────────────────────────────────────
  const home = await fetchPublic(watch.website_url)
  let homeHash = watch.home_hash
  let pricingHash = watch.pricing_hash

  if (!home.ok) {
    out.errors.push(`homepage unreadable: ${home.failure}`)
  } else {
    const facts = readPage(home.body, home.url)
    homeHash = hash(facts.text)

    if (watch.home_hash && homeHash !== watch.home_hash) {
      await recordSiteChange(watch, home.url, 'Their homepage copy changed', 'positioning', seen, out)
    }

    const origin = new URL(home.url).origin
    const disallows = await robotsDisallows(origin)
    const pricingUrl = findSectionLinks(facts, PRICING_PATTERNS, 1)
      .find(u => { try { return pathAllowed(new URL(u).pathname, disallows) } catch { return false } })

    if (pricingUrl) {
      const pricing = await fetchPublic(pricingUrl)
      if (pricing.ok) {
        const facts2 = readPage(pricing.body, pricing.url)
        pricingHash = hash(facts2.text)
        if (watch.pricing_hash && pricingHash !== watch.pricing_hash) {
          await recordSiteChange(watch, pricing.url, 'Their pricing page changed', 'pricing', seen, out)
        }
      }
    }
  }

  await svc.from('competitor_watches').update({
    home_hash:       homeHash,
    pricing_hash:    pricingHash,
    last_checked_at: new Date().toISOString(),
  }).eq('id', watch.id)

  return out
}

async function recordSiteChange(
  watch: WatchRow, url: string, headline: string,
  category: 'pricing' | 'positioning',
  seen: Set<string>, out: WatchCheck,
): Promise<void> {
  const svc = await createServiceClient()
  // Dated to the day, so a page that changes three times in a week is three
  // findings rather than one row rewritten, and a page that changes every day
  // because of a rotating banner does not produce an unbounded stream.
  const day = new Date().toISOString().slice(0, 10)
  const fp = moveFingerprint(`site_change_${category}`, url, day)
  if (seen.has(fp)) { out.alreadyKnown++; return }

  const { error } = await svc.from('competitor_moves').insert({
    brand_id:        watch.brand_id,
    competitor_id:   watch.competitor_id,
    competitor_name: watch.competitor_name,
    category,
    headline,
    significance:    'We hold a copy of this page from the last check and the text no longer matches. That tells you it moved, not what moved. Open the page to see.',
    source_url:      url,
    source_kind:     'site_change',
    published_at:    day,
    // A hash difference is a weak signal: a rotating testimonial changes the
    // text as surely as a price cut does.
    confidence:      'low',
    is_baseline:     false,
    fingerprint:     fp,
  })
  if (error) {
    if (error.message.includes('duplicate')) out.alreadyKnown++
    else out.errors.push(error.message)
  } else {
    out.siteChanges++
    seen.add(fp)
  }
}

function moveFingerprint(category: string, sourceUrl: string, extra: string): string {
  let key = sourceUrl
  try {
    const u = new URL(sourceUrl)
    key = `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}`
  } catch { /* raw string */ }
  return hash(`${category}|${key}|${extra.toLowerCase().slice(0, 80)}`).slice(0, 40)
}

/**
 * Start watching a competitor the marketer typed in, inside BrandGauge.
 *
 * Runs the same analysis the public tool runs and stores its findings as the
 * baseline, so the first check after this only reports what is genuinely new.
 * A watch created with no baseline would alert on the competitor's entire
 * history the first time it ran.
 */
export async function createWatch(args: {
  brandId: string
  brandWebsite: string | null
  competitorWebsite: string
  market?: string | null
}): Promise<{ ok: true; name: string; moves: number } | { ok: false; note: string }> {
  const outcome = await runCompetitorTracker({
    yourWebsite: args.brandWebsite ?? args.competitorWebsite,
    competitorWebsite: args.competitorWebsite,
    market: args.market ?? null,
  })

  if (!outcome.ok && outcome.reason !== 'no_evidence') {
    return { ok: false, note: outcome.note }
  }

  const svc = await createServiceClient()

  // No findings is a fine reason to start watching: that is the point of a
  // watch. The baseline is simply empty.
  const name = outcome.ok ? outcome.result.competitor.name : hostName(args.competitorWebsite)
  const website = outcome.ok ? outcome.result.competitor.website : args.competitorWebsite

  const { data: existing } = await svc
    .from('competitors').select('id').eq('brand_id', args.brandId).ilike('name', name).maybeSingle()

  let competitorId = existing?.id ?? null
  if (!competitorId) {
    const { data } = await svc.from('competitors')
      .insert({ brand_id: args.brandId, name, website_url: website }).select('id').single()
    competitorId = data?.id ?? null
  }

  await svc.from('competitor_watches').upsert({
    brand_id:        args.brandId,
    competitor_id:   competitorId,
    competitor_name: name,
    website_url:     website,
    market:          args.market ?? null,
    home_hash:       outcome.ok ? outcome.result.hashes.home : null,
    pricing_hash:    outcome.ok ? outcome.result.hashes.pricing : null,
    last_checked_at: new Date().toISOString(),
  }, { onConflict: 'brand_id,website_url' })

  const moves = outcome.ok ? outcome.result.moves : []
  if (moves.length) {
    await svc.from('competitor_moves').upsert(moves.map(m => ({
      brand_id:        args.brandId,
      competitor_id:   competitorId,
      competitor_name: name,
      category:        m.category,
      headline:        m.headline.slice(0, 500),
      significance:    m.significance || null,
      implication:     m.implication || null,
      source_url:      m.sourceUrl,
      source_kind:     m.sourceKind,
      quote:           m.quote || null,
      published_at:    m.publishedAt,
      confidence:      m.confidence,
      is_baseline:     true,
      fingerprint:     m.fingerprint,
    })), { onConflict: 'brand_id,fingerprint', ignoreDuplicates: true })
  }

  return { ok: true, name, moves: moves.length }
}

function hostName(url: string): string {
  try {
    const bare = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '').split('.')[0]
    return bare.charAt(0).toUpperCase() + bare.slice(1)
  } catch { return url }
}

export { WATCH_LIMIT } from './moves'
