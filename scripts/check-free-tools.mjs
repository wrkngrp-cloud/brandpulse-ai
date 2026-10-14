/**
 * Check the Free Tools libraries without a network, a database or an API key.
 *
 * Four things here are worth checking offline, and all four are the kind of
 * thing that breaks silently:
 *
 *   the SSRF screening in fetch-public, because a regression there is a
 *   security hole rather than a wrong number;
 *
 *   the HTML reader, because every tool's findings are built on what it
 *   extracts, and it is regex over real-world markup;
 *
 *   the competitor classifier's source guard, which is what stops a model
 *   inventing a citation — the AI call is stubbed, so this costs nothing;
 *
 *   the registry and safeNext, which the navigation and the auth round trip
 *   both depend on.
 *
 * Run: npm run tools:check
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'

const OUT = `${process.env.TMPDIR ?? '/tmp'}/bg-free-tools`
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

/* Compile the modules standalone. The @/ alias imports that would drag in the
   Supabase client or the Anthropic SDK are stubbed, so nothing here can reach
   the network even by accident. */
const files = {
  'fetch-public.ts':       ['src/lib/tools/fetch-public.ts', s => s],
  'html.ts':               ['src/lib/tools/html.ts', s => s],
  'moves.ts':              ['src/lib/tools/moves.ts', s => s],
  'report.ts':             ['src/lib/tools/report.ts', s => s],
  'safe-next.ts':          ['src/lib/safe-next.ts', s => s],
  'registry.ts':           ['src/lib/tools/registry.ts', s => s.replace(
    "import type { BrandIconName } from '@/components/brand/icon'",
    'type BrandIconName = string',
  )],
  'demand-labels.ts':      ['src/lib/tools/demand-labels.ts', s => s],
  'search-provider.ts':    ['src/lib/tools/search-provider.ts', s => s],
  'market-demand.ts':      ['src/lib/tools/market-demand.ts', s => s
    .replace("import { callAi, extractJson } from '@/lib/ai/client'",
      "import { callAi, extractJson } from './ai-stub'")],
  'campaign-labels.ts':    ['src/lib/tools/campaign-labels.ts', s => s],
  'offline-tracker.ts':    ['src/lib/tools/offline-tracker.ts', s => s
    // The database is not reachable from this check, and nothing exercised
    // here touches it: withUtm, slugify, looksAutomated and deviceOf are pure.
    .replace("import { createServiceClient } from '@/lib/supabase/server'",
      "const createServiceClient = async (): Promise<any> => { throw new Error('no database in this check') }")],
  'competitor-tracker.ts': ['src/lib/tools/competitor-tracker.ts', s => s
    .replace("import { callAi, extractJson } from '@/lib/ai/client'",
      "import { callAi, extractJson } from './ai-stub'")
    .replace("from '@/lib/press/nigerian-press'", "from './press-stub'")
    .replace("from './fetch-public'", "from './fetch-public'")
  ],
}

for (const [name, [path, transform]] of Object.entries(files)) {
  writeFileSync(`${OUT}/${name}`, transform(readFileSync(path, 'utf8')))
}

// The AI call, stubbed. Each test sets what the "model" returns next.
writeFileSync(`${OUT}/ai-stub.ts`, `
export let nextResponse = '{"moves":[]}'
export function setNextResponse(s: string) { nextResponse = s }
export async function callAi(_opts: unknown): Promise<string> { return nextResponse }
export function extractJson<T>(raw: string): T {
  const a = raw.indexOf('{'), b = raw.lastIndexOf('}')
  if (a === -1 || b <= a) throw new Error('no json')
  return JSON.parse(raw.slice(a, b + 1)) as T
}
`)
writeFileSync(`${OUT}/press-stub.ts`, `
export interface RssItem { title: string; link: string; pubDate: string; snippet: string }
export interface FeedRead { items: RssItem[]; ok: boolean; error?: string }
export async function fetchGoogleNewsRss(_q: string, _signal?: AbortSignal): Promise<FeedRead> { return { items: [], ok: true } }
export function pressQuery(name: string): string { return name }
export function publicationFromUrl(url: string): string {
  try { return new URL(url).hostname.replace('www.', '') } catch { return 'Unknown' }
}
export function parsePubDate(s: string): string {
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? '1970-01-01' : d.toISOString().slice(0, 10)
}
export function reachFor(_p: string) { return 0 }
export function emvFor(_r: number) { return 0 }
export const MONITORED_DOMAINS: string[] = []
export const EMV_CPM = 500
export function classifyRegulatory(_h: string) { return null }
export type RegulatoryKind = 'notice'
`)

execSync(
  `npx tsc --strict --target es2022 --module esnext --moduleResolution bundler --skipLibCheck --outDir ${OUT} ${Object.keys(files).map(f => `${OUT}/${f}`).join(' ')} ${OUT}/ai-stub.ts ${OUT}/press-stub.ts`,
  { stdio: 'inherit' },
)
// tsc emits .js; the directory has no package.json, so rename for ESM.
for (const f of [...Object.keys(files).map(f => f.replace('.ts', '')), 'ai-stub', 'press-stub']) {
  execSync(`mv ${OUT}/${f}.js ${OUT}/${f}.mjs`)
  const p = `${OUT}/${f}.mjs`
  writeFileSync(p, readFileSync(p, 'utf8').replace(/from ['"]\.\/([a-z-]+)['"]/g, "from './$1.mjs'"))
}

const fetchPublic = await import(`${OUT}/fetch-public.mjs`)
const html        = await import(`${OUT}/html.mjs`)
const registry    = await import(`${OUT}/registry.mjs`)
const tracker     = await import(`${OUT}/competitor-tracker.mjs`)
const aiStub      = await import(`${OUT}/ai-stub.mjs`)
const safe        = await import(`${OUT}/safe-next.mjs`)
const demand      = await import(`${OUT}/market-demand.mjs`)
const search      = await import(`${OUT}/search-provider.mjs`)
const offline     = await import(`${OUT}/offline-tracker.mjs`)
const labels      = await import(`${OUT}/campaign-labels.mjs`)

let pass = 0, fail = 0
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) { pass++; console.log(`  ok    ${name}`) }
  else { fail++; console.log(`  FAIL  ${name}\n        got  ${g}\n        want ${w}`) }
}
const ok = (name, cond) => eq(name, !!cond, true)

// ── safeNext ────────────────────────────────────────────────────────────────
console.log('\n── safeNext: the auth round trip cannot become an open redirect')
eq('relative path kept',    safe.safeNext('/tools/claim?token=abc'), '/tools/claim?token=abc')
eq('absolute URL refused',  safe.safeNext('https://evil.test/x'), '/dashboard')
eq('protocol-relative',     safe.safeNext('//evil.test'), '/dashboard')
eq('backslash refused',     safe.safeNext('/\\evil.test'), '/dashboard')
eq('scheme refused',        safe.safeNext('javascript:alert(1)'), '/dashboard')
eq('non-string refused',    safe.safeNext(undefined), '/dashboard')
eq('custom fallback',       safe.safeNext('', '/tools'), '/tools')

// ── URL normalising ─────────────────────────────────────────────────────────
console.log('\n── normaliseUrl')
eq('bare domain',    fetchPublic.normaliseUrl('acme.ng')?.toString(), 'https://acme.ng/')
eq('upper + space',  fetchPublic.normaliseUrl('  ACME.NG/path ')?.toString(), 'https://acme.ng/path')
eq('http kept',      fetchPublic.normaliseUrl('http://acme.ng')?.toString(), 'http://acme.ng/')
eq('credentials',    fetchPublic.normaliseUrl('https://user:pw@acme.ng'), null)
eq('typo, no dot',   fetchPublic.normaliseUrl('acmeng'), null)
// localhost parses on purpose, so the screen can call it blocked rather than
// invalid. The fetch below is what refuses it.
eq('localhost parses', fetchPublic.normaliseUrl('localhost')?.toString(), 'https://localhost/')
eq('empty',          fetchPublic.normaliseUrl('   '), null)
eq('rootHost',       fetchPublic.rootHost('WWW.Acme.NG'), 'acme.ng')

// ── SSRF screening. The whole point of fetch-public. ────────────────────────
console.log('\n── fetchPublic refuses anything pointing inside the network')
for (const [label, url] of [
  ['loopback v4',       'http://127.0.0.1/'],
  ['loopback name',     'http://localhost/'],
  ['cloud metadata',    'http://169.254.169.254/latest/meta-data/'],
  ['private 10/8',      'http://10.0.0.1/'],
  ['private 172.16/12', 'http://172.20.1.1/'],
  ['private 192.168',   'http://192.168.1.1/'],
  ['carrier NAT',       'http://100.100.1.1/'],
  ['loopback v6',       'http://[::1]/'],
  ['v4-mapped v6',      'http://[::ffff:10.0.0.1]/'],
  ['internal tld',      'http://db.internal/'],
]) {
  const res = await fetchPublic.fetchPublic(url)
  eq(`${label} blocked`, [res.ok, res.failure], [false, 'blocked_address'])
}
eq('ftp refused', (await fetchPublic.fetchPublic('ftp://acme.ng/x')).failure, 'invalid_url')

console.log('\n── robots.txt parsing')
ok('plain path allowed',      fetchPublic.pathAllowed('/pricing', ['/admin']))
ok('disallowed prefix',      !fetchPublic.pathAllowed('/admin/users', ['/admin']))
ok('blanket disallow',       !fetchPublic.pathAllowed('/anything', ['/']))
ok('no rules, all allowed',   fetchPublic.pathAllowed('/news', []))

// ── The HTML reader ─────────────────────────────────────────────────────────
console.log('\n── readPage')
const PAGE = `<!doctype html><html lang="en-NG"><head>
<title>Acme Pay | Send money across Nigeria</title>
<meta name="description" content="Send money to any bank in Nigeria in seconds.">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="https://acme.ng/">
<script src="https://www.googletagmanager.com/gtag/js?id=G-ABC123"></script>
<script>fbq('init','123')</script>
</head><body>
<h1>Send money across Nigeria</h1>
<h2>Why Acme</h2>
<p>Instant transfers to every bank. No hidden fees.</p>
<a href="/pricing">See pricing</a>
<a href="/news/launch">Newsroom</a>
<a href="https://wa.me/2348012345678">Chat on WhatsApp</a>
<a href="tel:+2348012345678">Call us</a>
<a href="mailto:hi@acme.ng">Email</a>
<a href="/signup">Get started</a>
<a href="/about">About the team</a>
<button type="button">Add to cart</button>
<button type="button">Toggle theme</button>
<img src="/hero.png" alt="A trader in Balogun market">
<img src="/logo.png">
<form action="/lead" method="post">
  <input type="text" name="full_name"><input type="email" name="email">
  <input type="hidden" name="csrf"><select name="state"></select>
  <textarea name="message"></textarea><input type="submit" value="Send">
</form>
<style>.x{color:red}</style>
</body></html>`
const facts = html.readPage(PAGE, 'https://acme.ng/')
eq('title',            facts.title, 'Acme Pay | Send money across Nigeria')
eq('description',      facts.description, 'Send money to any bank in Nigeria in seconds.')
eq('canonical',        facts.canonical, 'https://acme.ng/')
eq('lang',             facts.lang, 'en-NG')
eq('viewport meta',    facts.hasViewportMeta, true)
eq('headings',         facts.headings.length, 2)
// The fixture loads gtag, not gtm.js, so GTM must NOT be reported: a tracker
// we claim and the page does not have is the same class of error as a finding
// with no source.
eq('trackers',         facts.trackers.sort(), ['Google Analytics 4', 'Meta Pixel'])
eq('GTM not claimed',  facts.trackers.includes('Google Tag Manager'), false)
eq('images',           [facts.images, facts.imagesWithoutAlt], [2, 1])
eq('form fields',      facts.forms[0].fieldCount, 4)
eq('form action',      [facts.forms[0].action, facts.forms[0].method], ['/lead', 'post'])
eq('script text gone', facts.text.includes('fbq'), false)
eq('style text gone',  facts.text.includes('color:red'), false)
const ctaKinds = facts.ctas.map(c => c.kind)
ok('whatsapp CTA found', ctaKinds.includes('whatsapp'))
ok('tel CTA found',      ctaKinds.includes('tel'))
ok('mailto CTA found',   ctaKinds.includes('mailto'))
ok('link CTA found',     facts.ctas.some(c => c.kind === 'link' && /get started/i.test(c.text)))
ok('button CTA found',   facts.ctas.some(c => c.kind === 'button' && /add to cart/i.test(c.text)))
ok('non-CTA button out', !facts.ctas.some(c => /toggle theme/i.test(c.text)))
ok('non-CTA link out',   !facts.ctas.some(c => /about the team/i.test(c.text)))

console.log('\n── absolute() and findSectionLinks()')
eq('relative resolved', html.absolute('/x', 'https://acme.ng/a/b'), 'https://acme.ng/x')
eq('mailto refused',    html.absolute('mailto:a@b.ng', 'https://acme.ng/'), null)
eq('javascript refused',html.absolute('javascript:void(0)', 'https://acme.ng/'), null)
eq('fragment refused',  html.absolute('#top', 'https://acme.ng/'), null)
eq('pricing found',  html.findSectionLinks(facts, [/pricing/i], 2), ['https://acme.ng/pricing'])
eq('news found',     html.findSectionLinks(facts, [/\/news/i], 2), ['https://acme.ng/news/launch'])
eq('external out',   html.findSectionLinks(facts, [/wa\.me/i], 2), [])

// ── The registry, which the nav and the directory both read ─────────────────
console.log('\n── registry')
eq('five tools',        registry.FREE_TOOLS.length, 5)
eq('ids unique',        new Set(registry.FREE_TOOLS.map(t => t.id)).size, 5)
eq('routes unique',     new Set(registry.FREE_TOOLS.map(t => t.route)).size, 5)
eq('scoreboard route',  registry.toolById('pr-scoreboard').route, '/scoreboard')
ok('every route absolute', registry.FREE_TOOLS.every(t => t.route.startsWith('/')))
ok('every tool has a blurb and a CTA', registry.FREE_TOOLS.every(t => t.blurb && t.cta && t.detail))
eq('grouped covers all', registry.toolsByCategory().reduce((n, g) => n + g.tools.length, 0), 5)
ok('next tool for every tool', registry.FREE_TOOLS.every(t => {
  const n = registry.nextTool(t.id)
  return n && n.tool.id !== t.id && n.line.length > 10
}))

// ── The classifier's source guard ───────────────────────────────────────────
console.log('\n── classifyMoves: a citation it cannot point at is dropped')
const compFacts = html.readPage(PAGE, 'https://rival.ng/')
const pressItem = {
  title: 'Rival raises price of transfers',
  link: 'https://businessday.ng/rival-price',
  pubDate: 'Mon, 06 Oct 2026 09:00:00 GMT',
  snippet: 'Rival said transfer fees would rise to N75 from next month.',
}
const base = { competitorName: 'Rival', compFacts, sectionPages: [], press: [pressItem], yourFacts: null, market: 'Nigeria' }

aiStub.setNextResponse(JSON.stringify({ moves: [
  { source: 1,  category: 'pricing', headline: 'Transfer fee rises to N75', significance: 's', implication: 'i', quote: 'fees would rise to N75', confidence: 'high' },
  { source: 99, category: 'pricing', headline: 'Invented from nowhere',     significance: 's', implication: 'i', quote: 'q', confidence: 'high' },
] }))
let moves = await tracker.classifyMoves(base)
eq('hallucinated source dropped', moves.length, 1)
eq('real one kept',               moves[0].headline, 'Transfer fee rises to N75')
eq('press source attached',       [moves[0].sourceUrl, moves[0].sourceKind], ['https://businessday.ng/rival-price', 'press'])
eq('press date attached',         moves[0].publishedAt, '2026-10-06')
ok('fingerprint present',         /^[0-9a-f]{40}$/.test(moves[0].fingerprint))

console.log('\n── classifyMoves: an undated page cannot carry a change claim')
aiStub.setNextResponse(JSON.stringify({ moves: [
  { source: 2, category: 'product_launch', headline: 'They just launched a card', significance: 's', implication: 'i', quote: 'q', confidence: 'high' },
] }))
moves = await tracker.classifyMoves({
  ...base,
  sectionPages: [{ url: 'https://rival.ng/pricing', facts: compFacts, kind: 'pricing' }],
})
eq('launch demoted to positioning', moves[0].category, 'positioning')
eq('site source kind',              moves[0].sourceKind, 'site_page')
eq('confidence capped',             moves[0].confidence, 'medium')
eq('no date claimed',               moves[0].publishedAt, null)

console.log('\n── classifyMoves: malformed and empty answers')
aiStub.setNextResponse('not json at all')
eq('unparseable answer yields nothing', (await tracker.classifyMoves(base)).length, 0)
aiStub.setNextResponse(JSON.stringify({ moves: [{ source: 1, category: 'pricing', headline: '   ' }] }))
eq('empty headline dropped', (await tracker.classifyMoves(base)).length, 0)
aiStub.setNextResponse(JSON.stringify({ moves: [
  { source: 1, category: 'not_a_category', headline: 'Something', confidence: 'certain' },
] }))
moves = await tracker.classifyMoves(base)
eq('unknown category falls back', moves[0].category, 'company')
eq('unknown confidence falls back', moves[0].confidence, 'medium')
aiStub.setNextResponse(JSON.stringify({ moves: Array.from({ length: 9 }, (_, i) => (
  { source: 1, category: 'pricing', headline: `Move ${i}`, confidence: 'low' }
)) }))
eq('capped at three', (await tracker.classifyMoves(base)).length, 3)


// ── The demand finder's evidence guards ─────────────────────────────────────
console.log('\n── search provider')
eq('nigeria code',  search.marketCode('Nigeria'), 'ng')
eq('ghana code',    search.marketCode(' ghana '), 'gh')
eq('unknown falls back to ng', search.marketCode('Atlantis'), 'ng')
eq('no key, no provider', (() => { delete process.env.SERPAPI_KEY; return search.getSearchProvider() })(), null)

console.log('\n── findOpportunities: an opportunity with no evidence is dropped')
const ownPage = html.readPage(PAGE, 'https://acme.ng/')
const understanding = {
  name: 'Acme Pay', category: 'payments', products: ['transfers'], customers: ['traders'],
  valueProps: ['instant'], problems: ['transfers fail'],
  queries: [{ query: 'send money to nigeria', stage: 'purchase', why: '' }],
}
const demandBase = {
  understanding, answers: [], facts: ownPage, extraPages: [],
  competitorFacts: null, competitorHost: null,
  market: 'Nigeria', yourHost: 'acme.ng', hasProvider: false,
}

aiStub.setNextResponse(JSON.stringify({ opportunities: [
  { title: 'Nothing supports this', customerProblem: 'p', stage: 'purchase', evidenceKind: 'visibility_gap', evidence: [], recommendedAction: 'a', why: 'w' },
  { title: 'This one cites our own page', customerProblem: 'p', stage: 'purchase', evidenceKind: 'content_gap', evidence: [1], recommendedAction: 'a', why: 'w' },
] }))
let opps = await demand.findOpportunities(demandBase)
eq('unsupported opportunity dropped', opps.length, 1)
eq('supported one kept', opps[0].title, 'This one cites our own page')
ok('evidence has a URL', opps[0].evidence[0].sourceUrl.startsWith('https://acme.ng'))

console.log('\n── findOpportunities: no provider means no visibility claim')
aiStub.setNextResponse(JSON.stringify({ opportunities: [
  { title: 'Competitors outrank you', customerProblem: 'p', stage: 'comparison', evidenceKind: 'demand_evidence', evidence: [1], recommendedAction: 'a', why: 'w' },
] }))
opps = await demand.findOpportunities(demandBase)
eq('demand claim demoted to content gap', opps[0].evidenceKind, 'content_gap')

console.log('\n── findOpportunities: with results, a visibility claim stands')
const withResults = {
  ...demandBase,
  hasProvider: true,
  answers: [{
    stage: 'purchase',
    answer: {
      query: 'send money to nigeria',
      provider: 'Google Search via SerpAPI',
      results: [
        { title: 'Rival Transfers', url: 'https://rival.ng/send', snippet: 'Send money home', position: 1 },
        { title: 'Other Rival', url: 'https://other.ng/send', snippet: 'Cheap transfers', position: 2 },
      ],
    },
  }],
}
aiStub.setNextResponse(JSON.stringify({ opportunities: [
  { title: 'You are absent from the main purchase search', customerProblem: 'p', stage: 'purchase', evidenceKind: 'visibility_gap', evidence: [1, 2], competitorsVisible: ['Rival', 'Other Rival'], recommendedAction: 'a', why: 'w' },
] }))
opps = await demand.findOpportunities(withResults)
eq('visibility gap kept', opps[0].evidenceKind, 'visibility_gap')
eq('both results cited', opps[0].evidence.length, 2)
eq('competitors carried', opps[0].competitorsVisible, ['Rival', 'Other Rival'])
eq('unknown stage falls back', (await (async () => {
  aiStub.setNextResponse(JSON.stringify({ opportunities: [
    { title: 'T', stage: 'nonsense', evidenceKind: 'visibility_gap', evidence: [1] },
  ] }))
  return (await demand.findOpportunities(withResults))[0].intentStage
})()), 'solution_discovery')

aiStub.setNextResponse('garbage')
eq('unparseable answer yields nothing', (await demand.findOpportunities(withResults)).length, 0)
aiStub.setNextResponse(JSON.stringify({ opportunities: Array.from({ length: 7 }, (_, i) => (
  { title: `O${i}`, stage: 'purchase', evidenceKind: 'visibility_gap', evidence: [1] }
)) }))
eq('capped at three', (await demand.findOpportunities(withResults)).length, 3)

console.log('\n── understandBusiness refuses to work from nothing')
aiStub.setNextResponse(JSON.stringify({ name: 'Acme', category: 'payments', queries: [] }))
eq('no queries, no understanding', await demand.understandBusiness({ facts: ownPage, extraPages: [], market: 'Nigeria', category: null }), null)
aiStub.setNextResponse(JSON.stringify({
  name: 'Acme Pay', category: 'payments', products: ['transfers'], customers: ['traders'],
  valueProps: [], problems: [],
  queries: [{ query: 'how to send money to nigeria', stage: 'problem_aware', why: 'w' }, { query: 'x', stage: 'purchase', why: '' }],
}))
const u2 = await demand.understandBusiness({ facts: ownPage, extraPages: [], market: 'Nigeria', category: null })
eq('too-short query dropped', u2.queries.length, 1)
eq('stage kept',              u2.queries[0].stage, 'problem_aware')


// ── Offline tracker: UTMs, slugs and bot filtering ──────────────────────────
console.log('\n── withUtm keeps what the customer already put on the URL')
let tagged = offline.withUtm('https://acme.ng/offer?sku=123&ref=abc', {
  campaignType: 'outdoor', campaignName: 'Q4 Lagos Billboards', placementUtm: 'ikeja-bridge',
})
let u = new URL(tagged)
eq('existing params kept',  [u.searchParams.get('sku'), u.searchParams.get('ref')], ['123', 'abc'])
eq('utm_source added',      u.searchParams.get('utm_source'), 'brandgauge')
eq('medium from type',      u.searchParams.get('utm_medium'), 'ooh')
eq('campaign slugified',    u.searchParams.get('utm_campaign'), 'q4-lagos-billboards')
eq('content is placement',  u.searchParams.get('utm_content'), 'ikeja-bridge')
eq('path untouched',        u.pathname, '/offer')

tagged = offline.withUtm('https://acme.ng/o?utm_source=radio&utm_campaign=mine', {
  campaignType: 'radio', campaignName: 'Drive time', placementUtm: 'coolfm',
})
u = new URL(tagged)
eq('their utm_source respected',   u.searchParams.get('utm_source'), 'radio')
eq('their utm_campaign respected', u.searchParams.get('utm_campaign'), 'mine')
eq('missing ones still filled',    u.searchParams.get('utm_medium'), 'radio')

eq('bare domain gets a scheme', new URL(offline.withUtm('acme.ng/x', {
  campaignType: 'flyer', campaignName: 'Yaba', placementUtm: 'market',
})).protocol, 'https:')
eq('unparseable destination returned as-is',
   offline.withUtm('not a url at all', { campaignType: 'other', campaignName: 'c', placementUtm: 'p' }),
   'not a url at all')

console.log('\n── slugify')
eq('spaces and case',  offline.slugify('Third Mainland Bridge ', 40), 'third-mainland-bridge')
// Default cap cuts on a word boundary: this is typed off a poster, so a whole
// word short beats a truncated one.
eq('word-boundary cut', offline.slugify('Third Mainland Bridge '), 'third-mainland')
eq('short name untouched', offline.slugify('Ikeja'), 'ikeja')
eq('punctuation out',  offline.slugify('Shoprite (Lekki) — end cap'), 'shoprite-lekki')
eq('no trailing dash', offline.slugify('Ikeja!!!').endsWith('-'), false)
eq('empty stays empty', offline.slugify('!!!'), '')

console.log('\n── automated traffic is not a visit')
for (const ua of [
  'WhatsApp/2.23.20.0 A',
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'Twitterbot/1.0',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'curl/8.4.0',
  'python-requests/2.31.0',
  'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0.0.0',
  '',
]) ok(`filtered: ${ua.slice(0, 28) || '(no user agent)'}`, offline.looksAutomated(ua))

for (const ua of [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 13; Infinix X6819) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
]) ok(`counted: ${ua.slice(0, 24)}`, !offline.looksAutomated(ua))

console.log('\n── device detection')
eq('iphone',  offline.deviceOf('iPhone; CPU iPhone OS 17_1'), 'mobile')
eq('android', offline.deviceOf('Linux; Android 13; Infinix X6819 Mobile'), 'mobile')
eq('ipad',    offline.deviceOf('iPad; CPU OS 17_1 like Mac OS X'), 'tablet')
eq('desktop', offline.deviceOf('Windows NT 10.0; Win64; x64'), 'desktop')

console.log('\n── campaign labels cover every type')
ok('a label per type', labels.CAMPAIGN_TYPES.every(t => labels.CAMPAIGN_TYPE_LABEL[t]))
ok('a placement hint per type', labels.CAMPAIGN_TYPES.every(t => labels.PLACEMENT_HINT[t]))
eq('free placement limit', labels.FREE_PLACEMENT_LIMIT, 3)

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} checks passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
