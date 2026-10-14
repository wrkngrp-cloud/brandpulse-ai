/**
 * Reading a page without a DOM.
 *
 * Every tool here needs the same few things out of HTML: the title, the
 * description, the visible words, the links, the buttons that look like calls
 * to action, whether there is a form, and which analytics scripts are present.
 * A headless browser would read client-rendered pages too, but it is a large
 * piece of infrastructure for five free tools, and a page that renders nothing
 * without JavaScript is itself a finding the audit should report rather than
 * paper over. So: regex, and a coverage note when the page came back empty.
 */

export interface PageFacts {
  url:          string
  title:        string | null
  description:  string | null
  canonical:    string | null
  lang:         string | null
  /** Visible text, collapsed, capped. */
  text:         string
  /** How many characters of text the page had before the cap. A page under
   *  ~200 almost certainly renders client-side. */
  textLength:   number
  headings:     { level: number; text: string }[]
  links:        { href: string; text: string }[]
  /** Anchors and buttons whose words read like a conversion action. */
  ctas:         { text: string; href: string | null; kind: 'link' | 'button' | 'whatsapp' | 'tel' | 'mailto' }[]
  forms:        { action: string | null; method: string; fieldCount: number; fields: string[] }[]
  images:       number
  imagesWithoutAlt: number
  hasViewportMeta: boolean
  /** Analytics and pixel scripts we can see in the markup. Presence only —
   *  whether they fire correctly is not observable from here. */
  trackers:     string[]
  scriptCount:  number
  inlineStyleBlocks: number
  bytes:        number
}

const strip = (s: string) =>
  s.replace(/<[^>]+>/g, ' ')
   .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
   .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#0?39;|&apos;/gi, "'")
   .replace(/&[a-z]+;/gi, ' ')
   .replace(/\s+/g, ' ')
   .trim()

const attr = (tag: string, name: string): string | null => {
  const m = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag)
  return m ? (m[2] ?? m[3] ?? m[4] ?? '').trim() : null
}

const CTA_WORDS = [
  'buy', 'order', 'shop', 'get started', 'start', 'sign up', 'signup', 'register',
  'subscribe', 'book', 'apply', 'request', 'download', 'install', 'try', 'demo',
  'contact', 'call', 'chat', 'whatsapp', 'enquire', 'enquiry', 'inquire', 'quote',
  'join', 'open an account', 'create account', 'add to cart', 'checkout', 'pay',
  'talk to', 'speak to', 'learn more', 'see pricing', 'get a quote',
]

const TRACKER_SIGNATURES: [string, RegExp][] = [
  ['Google Analytics 4',   /gtag\/js\?id=G-|googletagmanager\.com\/gtag/i],
  ['Google Tag Manager',   /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]+/],
  ['Meta Pixel',           /connect\.facebook\.net\/[^"']*fbevents\.js|fbq\(/i],
  ['TikTok Pixel',         /analytics\.tiktok\.com/i],
  ['LinkedIn Insight',     /snap\.licdn\.com/i],
  ['Hotjar',               /static\.hotjar\.com/i],
  ['Microsoft Clarity',    /clarity\.ms/i],
  ['Mixpanel',             /cdn\.mxpnl\.com|mixpanel/i],
  ['PostHog',              /posthog\.com\/static|posthog\.init/i],
  ['Segment',              /cdn\.segment\.com/i],
  ['Google Ads conversion',/googleads\.g\.doubleclick\.net|gtag\('config',\s*'AW-/i],
]

export function readPage(html: string, url: string): PageFacts {
  const head = html.slice(0, 200_000)

  const titleRaw = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1]
  const metaTags = head.match(/<meta\b[^>]*>/gi) ?? []
  const description = metaTags.map(t => {
    const n = (attr(t, 'name') ?? attr(t, 'property') ?? '').toLowerCase()
    return n === 'description' || n === 'og:description' ? attr(t, 'content') : null
  }).find(Boolean) ?? null
  const hasViewportMeta = metaTags.some(t => (attr(t, 'name') ?? '').toLowerCase() === 'viewport')

  const canonical = (head.match(/<link\b[^>]*>/gi) ?? [])
    .map(t => ((attr(t, 'rel') ?? '').toLowerCase() === 'canonical' ? attr(t, 'href') : null))
    .find(Boolean) ?? null

  const lang = attr(/<html\b[^>]*>/i.exec(html)?.[0] ?? '', 'lang')

  const bodyHtml = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
  const fullText  = strip(bodyHtml)

  const headings: PageFacts['headings'] = []
  for (const m of bodyHtml.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    const text = strip(m[2])
    if (text) headings.push({ level: Number(m[1]), text: text.slice(0, 200) })
  }

  const links: PageFacts['links'] = []
  const ctas:  PageFacts['ctas']  = []
  for (const m of bodyHtml.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attr(`<a ${m[1]}>`, 'href')
    const text = strip(m[2]).slice(0, 120)
    const aria = attr(`<a ${m[1]}>`, 'aria-label')
    const label = text || aria || ''
    if (href) links.push({ href, text: label })
    if (!href) continue
    const low = href.toLowerCase()
    if (low.startsWith('https://wa.me') || low.includes('api.whatsapp.com') || low.includes('whatsapp://')) {
      ctas.push({ text: label || 'WhatsApp', href, kind: 'whatsapp' }); continue
    }
    if (low.startsWith('tel:'))    { ctas.push({ text: label || 'Call',  href, kind: 'tel' });    continue }
    if (low.startsWith('mailto:')) { ctas.push({ text: label || 'Email', href, kind: 'mailto' }); continue }
    const l = label.toLowerCase()
    if (l && CTA_WORDS.some(w => l.includes(w)) && l.length < 60) {
      ctas.push({ text: label, href, kind: 'link' })
    }
  }
  for (const m of bodyHtml.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
    const text = strip(m[2]).slice(0, 120) || attr(`<button ${m[1]}>`, 'aria-label') || ''
    const l = text.toLowerCase()
    if (l && CTA_WORDS.some(w => l.includes(w))) ctas.push({ text, href: null, kind: 'button' })
  }

  const forms: PageFacts['forms'] = []
  for (const m of bodyHtml.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)) {
    const open  = `<form ${m[1]}>`
    const inner = m[2]
    const fields: string[] = []
    for (const f of inner.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)) {
      const tag  = `<${f[1]} ${f[2]}>`
      const type = (attr(tag, 'type') ?? '').toLowerCase()
      if (type === 'hidden' || type === 'submit' || type === 'button') continue
      fields.push(attr(tag, 'name') ?? attr(tag, 'placeholder') ?? attr(tag, 'aria-label') ?? f[1].toLowerCase())
    }
    forms.push({
      action: attr(open, 'action'),
      method: (attr(open, 'method') ?? 'get').toLowerCase(),
      fieldCount: fields.length,
      fields: fields.slice(0, 25),
    })
  }

  const imgTags = bodyHtml.match(/<img\b[^>]*>/gi) ?? []
  const imagesWithoutAlt = imgTags.filter(t => {
    const alt = attr(t, 'alt')
    return alt === null
  }).length

  const trackers = TRACKER_SIGNATURES.filter(([, re]) => re.test(html)).map(([name]) => name)

  return {
    url,
    title: titleRaw ? strip(titleRaw).slice(0, 300) : null,
    description: description ? strip(description).slice(0, 400) : null,
    canonical,
    lang,
    text: fullText.slice(0, 12_000),
    textLength: fullText.length,
    headings: headings.slice(0, 60),
    links: links.slice(0, 400),
    ctas: dedupeCtas(ctas).slice(0, 25),
    forms: forms.slice(0, 10),
    images: imgTags.length,
    imagesWithoutAlt,
    hasViewportMeta,
    trackers,
    scriptCount: (html.match(/<script\b/gi) ?? []).length,
    inlineStyleBlocks: (html.match(/<style\b/gi) ?? []).length,
    bytes: Buffer.byteLength(html, 'utf8'),
  }
}

function dedupeCtas(ctas: PageFacts['ctas']): PageFacts['ctas'] {
  const seen = new Set<string>()
  return ctas.filter(c => {
    const key = `${c.kind}:${c.text.toLowerCase()}:${c.href ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Absolute URL for a possibly-relative href, or null when it is not a web
 *  address we can follow (mailto:, tel:, javascript:, a bare fragment). */
export function absolute(href: string, base: string): string | null {
  if (/^(mailto|tel|javascript|sms|whatsapp):/i.test(href) || href.startsWith('#')) return null
  try {
    const u = new URL(href, base)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

/** Internal links whose path looks like one of the named kinds. Used to find a
 *  pricing or newsroom page without crawling a whole site. */
export function findSectionLinks(facts: PageFacts, patterns: RegExp[], limit = 4): string[] {
  const base = facts.url
  const out: string[] = []
  const seen = new Set<string>()
  let origin: string
  try { origin = new URL(base).origin } catch { return [] }

  for (const link of facts.links) {
    const abs = absolute(link.href, base)
    if (!abs || !abs.startsWith(origin)) continue
    let path: string
    try { path = new URL(abs).pathname.toLowerCase() } catch { continue }
    const label = link.text.toLowerCase()
    if (!patterns.some(p => p.test(path) || p.test(label))) continue
    const clean = abs.split('#')[0]
    if (seen.has(clean)) continue
    seen.add(clean)
    out.push(clean)
    if (out.length >= limit) break
  }
  return out
}
