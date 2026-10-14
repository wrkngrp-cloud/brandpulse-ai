import { createHash, randomBytes } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { normaliseUrl } from './fetch-public'
import { FREE_PLACEMENT_LIMIT, type CampaignType } from './campaign-labels'

/**
 * Trackable links and QR codes for offline campaigns.
 *
 * The thing that makes this different from a link shortener is that the links
 * are printed. A QR code on a billboard in Ikeja cannot be reissued, so a slug
 * is permanent from the moment it is generated, and claiming a campaign into a
 * BrandGauge workspace moves the row's ownership rather than copying it. That
 * is why tool_campaigns carries a nullable brand_id instead of the campaign
 * being re-created in ooh_sites on sign-up.
 *
 * The redirect namespace is shared with print_placements and ooh_sites, which
 * /go/[slug] resolves in order, so slug generation checks all three.
 */

export {
  CAMPAIGN_TYPES, CAMPAIGN_TYPE_LABEL, FREE_PLACEMENT_LIMIT, PLACEMENT_HINT,
  type CampaignType,
} from './campaign-labels'

/** The UTM medium each campaign type reports, so a destination's own analytics
 *  can separate offline traffic the same way ours does. */
const UTM_MEDIUM: Record<CampaignType, string> = {
  outdoor:     'ooh',
  event:       'event',
  activation:  'activation',
  radio:       'radio',
  flyer:       'flyer',
  in_store:    'in_store',
  sponsorship: 'sponsorship',
  other:       'offline',
}

const hash = (s: string) => createHash('sha256').update(s).digest('hex')

/** Readable, unambiguous in print, and short enough to type off a billboard.
 *  No i, l, 1, o or 0: someone is going to read this off a poster at speed. */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

function randomSlug(length = 6): string {
  const bytes = randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}

export function slugify(input: string, max = 18): string {
  const full = input.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (full.length <= max) return full

  /* Cut on a word boundary. A hard slice turned "third-mainland-bridge" into
     "third-mainland-bri", and this is a string someone reads off a poster and
     types into a phone. A whole word short beats a truncated one. */
  const cut = full.slice(0, max)
  const lastDash = cut.lastIndexOf('-')
  const trimmed = lastDash > Math.floor(max / 2) ? cut.slice(0, lastDash) : cut
  return trimmed.replace(/-+$/g, '')
}

/**
 * A slug nothing else in the redirect namespace is using.
 *
 * Tries a readable one first (campaign-placement), then falls back to a random
 * suffix. All three tables are checked because /go/[slug] looks in
 * print_placements, then ooh_sites, then tool_placements: a collision would
 * silently send a printed QR code to somebody else's landing page.
 */
export async function mintSlug(preferred: string): Promise<string> {
  const svc = await createServiceClient()
  const base = slugify(preferred) || 'go'

  const taken = async (slug: string): Promise<boolean> => {
    const [print, ooh, tool] = await Promise.all([
      svc.from('print_placements').select('id').eq('vanity_slug', slug).limit(1).maybeSingle(),
      svc.from('ooh_sites').select('id').eq('vanity_slug', slug).limit(1).maybeSingle(),
      svc.from('tool_placements').select('id').eq('slug', slug).limit(1).maybeSingle(),
    ])
    return Boolean(print.data || ooh.data || tool.data)
  }

  if (base.length >= 3 && !(await taken(base))) return base
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = `${base.slice(0, 12)}-${randomSlug(attempt < 4 ? 4 : 7)}`.replace(/^-/, '')
    if (!(await taken(candidate))) return candidate
  }
  // Eight collisions on a random suffix is not going to happen, but a thrown
  // error beats handing back a slug that resolves to someone else's campaign.
  throw new Error('could not mint a free tracking slug')
}

/**
 * The destination, with UTMs added and the customer's own query kept.
 *
 * A destination often already carries parameters that matter — a product id, a
 * referral code, a language. Rebuilding the URL from scratch would drop them,
 * and silently sending traffic to the wrong page is worse than no tracking at
 * all. Existing parameters are preserved; a utm_* the customer already set is
 * left alone, because they meant it.
 */
export function withUtm(destination: string, args: {
  campaignType: CampaignType
  campaignName: string
  placementUtm: string
}): string {
  const url = normaliseUrl(destination)
  if (!url) return destination

  const setIfAbsent = (key: string, value: string) => {
    if (!url.searchParams.has(key)) url.searchParams.set(key, value)
  }
  setIfAbsent('utm_source', 'brandgauge')
  setIfAbsent('utm_medium', UTM_MEDIUM[args.campaignType])
  setIfAbsent('utm_campaign', slugify(args.campaignName, 40) || 'offline')
  setIfAbsent('utm_content', args.placementUtm)
  return url.toString()
}

export interface NewPlacement { name: string }

export interface CreatedCampaign {
  campaignId: string
  name: string
  campaignType: CampaignType
  destinationUrl: string
  market: string | null
  placements: {
    id: string
    name: string
    slug: string
    utmContent: string
    trackingUrl: string
    destinationWithUtm: string
  }[]
}

/** The short domain the printed link uses. NEXT_PUBLIC_SHORT_DOMAIN is already
 *  read elsewhere for the OOH vanity links, so offline links are consistent. */
export function shortBase(): string {
  const short = process.env.NEXT_PUBLIC_SHORT_DOMAIN
  if (short) return short.replace(/\/$/, '').startsWith('http') ? short.replace(/\/$/, '') : `https://${short.replace(/\/$/, '')}`
  const app = process.env.NEXT_PUBLIC_APP_URL ?? 'https://brandgauge.app'
  return app.replace(/\/$/, '')
}

export function trackingUrlFor(slug: string): string {
  return `${shortBase()}/go/${slug}`
}

export async function createCampaign(args: {
  runId: string | null
  name: string
  campaignType: CampaignType
  destinationUrl: string
  market?: string | null
  placements: NewPlacement[]
}): Promise<CreatedCampaign> {
  const svc = await createServiceClient()

  const { data: campaign, error } = await svc.from('tool_campaigns').insert({
    run_id:          args.runId,
    name:            args.name,
    campaign_type:   args.campaignType,
    destination_url: args.destinationUrl,
    market:          args.market ?? null,
  }).select('id').single()

  if (error || !campaign) throw new Error(`could not create the campaign: ${error?.message ?? 'no row'}`)

  const placements: CreatedCampaign['placements'] = []
  for (const p of args.placements.slice(0, FREE_PLACEMENT_LIMIT)) {
    const utmContent = slugify(p.name, 30) || `placement-${placements.length + 1}`
    const slug = await mintSlug(`${args.name}-${p.name}`)
    const { data: row } = await svc.from('tool_placements').insert({
      campaign_id: campaign.id,
      name:        p.name,
      slug,
      utm_content: utmContent,
    }).select('id').single()
    if (!row) continue
    placements.push({
      id:                 row.id,
      name:               p.name,
      slug,
      utmContent,
      trackingUrl:        trackingUrlFor(slug),
      destinationWithUtm: withUtm(args.destinationUrl, {
        campaignType: args.campaignType, campaignName: args.name, placementUtm: utmContent,
      }),
    })
  }

  return {
    campaignId:     campaign.id,
    name:           args.name,
    campaignType:   args.campaignType,
    destinationUrl: args.destinationUrl,
    market:         args.market ?? null,
    placements,
  }
}

/* ── Counting a visit ─────────────────────────────────────────────────────── */

/**
 * Traffic we do not count as a person.
 *
 * The WhatsApp and Facebook entries matter more than the rest here. A link
 * pasted into a WhatsApp group is fetched once by Meta's preview crawler
 * before anyone taps it, and in this market that is most of how a campaign
 * link travels. Counting those as visits would inflate a flyer's numbers by
 * whatever its share of forwarding is — which is exactly the number the
 * marketer is trying to read.
 */
const BOT_PATTERNS = [
  /bot\b/i, /crawl/i, /spider/i, /slurp/i,
  /facebookexternalhit/i, /whatsapp/i, /telegrambot/i, /twitterbot/i, /linkedinbot/i,
  /discordbot/i, /slackbot/i, /skypeuripreview/i, /pinterest/i, /applebot/i,
  /headlesschrome/i, /phantomjs/i, /puppeteer/i, /playwright/i,
  /curl\//i, /wget/i, /python-requests/i, /go-http-client/i, /axios/i, /okhttp/i,
  /preview/i, /monitoring/i, /uptime/i, /pingdom/i, /lighthouse/i, /gtmetrix/i,
]

export function looksAutomated(userAgent: string): boolean {
  if (!userAgent.trim()) return true     // no agent at all is not a browser
  return BOT_PATTERNS.some(p => p.test(userAgent))
}

export function deviceOf(userAgent: string): 'mobile' | 'tablet' | 'desktop' {
  if (/tablet|ipad/i.test(userAgent)) return 'tablet'
  if (/mobile|android|iphone|ipod/i.test(userAgent)) return 'mobile'
  return 'desktop'
}

/**
 * Record one visit to a tool placement.
 *
 * The visitor hash is the IP and the user agent together, salted by the slug
 * so the same phone visiting two placements is not linkable across them, and
 * truncated. It exists to tell a repeat tap from a new person within a day,
 * and for nothing else: no raw IP is stored, which is what lets the page
 * promise that it records a visit rather than a visitor.
 */
export async function recordVisit(args: {
  placementId: string
  campaignId:  string
  slug:        string
  ip:          string
  userAgent:   string
  referrer:    string | null
  ipRegion:    string | null
}): Promise<void> {
  const svc = await createServiceClient()
  const bot = looksAutomated(args.userAgent)
  const visitorHash = hash(`${args.slug}|${args.ip}|${args.userAgent}`).slice(0, 32)

  /* Unique within a day. A billboard gets the same commuter twice, and the
     honest way to report that is two visits and one unique rather than
     picking one of the two to believe. */
  let isUnique = true
  if (!bot) {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: earlier } = await svc
      .from('tool_visits')
      .select('id')
      .eq('placement_id', args.placementId)
      .eq('visitor_hash', visitorHash)
      .gte('created_at', dayAgo)
      .limit(1)
      .maybeSingle()
    isUnique = !earlier
  }

  await svc.from('tool_visits').insert({
    placement_id: args.placementId,
    campaign_id:  args.campaignId,
    visitor_hash: visitorHash,
    ip_region:    args.ipRegion,
    device_type:  deviceOf(args.userAgent),
    referrer:     args.referrer?.slice(0, 300) ?? null,
    is_unique:    isUnique && !bot,
    is_bot:       bot,
  })

  // Counters on the placement, so a dashboard read is one query. Bots are
  // stored but never counted into the headline figure.
  if (!bot) {
    await svc.rpc('increment_tool_placement_visits', {
      p_placement_id: args.placementId,
      p_unique:       isUnique,
    })
  }
}
