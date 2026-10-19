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
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
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
  'audit-vocab.ts':        ['src/lib/tools/audit-vocab.ts', s => s],
  'pagespeed.ts':          ['src/lib/tools/pagespeed.ts', s => s],
  'campaign-audit.ts':     ['src/lib/tools/campaign-audit.ts', s => s
    .replace("import { callAi, extractJson } from '@/lib/ai/client'",
      "import { callAi, extractJson } from './ai-stub'")],
  'leads.ts':              ['src/lib/tools/leads.ts', s => s
    .replace("import { createServiceClient } from '@/lib/supabase/server'",
      "const createServiceClient = async (): Promise<any> => { throw new Error('no database in this check') }")],
  'gate.ts':               ['src/lib/tools/gate.ts', s => s],
  'brand-gap.ts':          ['src/lib/tools/brand-gap.ts', s => s
    .replace("import { callAi, extractJson } from '@/lib/ai/client'",
      "import { callAi, extractJson } from './ai-stub'")
    .replace("from '@/lib/press/nigerian-press'", "from './press-stub'")
    .replace("from '@/lib/ai/assistants'", "from './assistants-stub'")],
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

writeFileSync(`${OUT}/assistants-stub.ts`, `
export type AssistantPlatform = 'chatgpt' | 'gemini' | 'perplexity'
export const ASSISTANT_PLATFORMS: AssistantPlatform[] = ['chatgpt', 'gemini', 'perplexity']
export function configuredAssistants(): AssistantPlatform[] { return [] }
export async function queryAssistant(_p: AssistantPlatform, _q: string, _o?: { maxTokens?: number }): Promise<string | null> { return null }
`)

execSync(
  `npx tsc --strict --target es2022 --module esnext --moduleResolution bundler --skipLibCheck --outDir ${OUT} ${Object.keys(files).map(f => `${OUT}/${f}`).join(' ')} ${OUT}/ai-stub.ts ${OUT}/press-stub.ts ${OUT}/assistants-stub.ts`,
  { stdio: 'inherit' },
)
// tsc emits .js; the directory has no package.json, so rename for ESM.
for (const f of [...Object.keys(files).map(f => f.replace('.ts', '')), 'ai-stub', 'press-stub', 'assistants-stub']) {
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
const auditMod    = await import(`${OUT}/campaign-audit.mjs`)
const leads       = await import(`${OUT}/leads.mjs`)
const gate        = await import(`${OUT}/gate.mjs`)
const vocab       = await import(`${OUT}/audit-vocab.mjs`)
const brandGap    = await import(`${OUT}/brand-gap.mjs`)

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
const routeFile = route => {
  const base = `src/app${route}`
  return ['page.tsx', 'route.ts'].some(f => existsSync(`${base}/${f}`))
}
// Counts are not asserted: the lineup changes as tools are added and retired,
// and a test that has to be edited every time one moves is a test that gets
// edited rather than read. The invariants below are what must always hold.
const listed = registry.FREE_TOOLS
ok('at least three tools are listed', listed.length >= 3)
ok('everything in FREE_TOOLS is listed', listed.every(t => t.listed))
eq('listed ids unique',    new Set(listed.map(t => t.id)).size, listed.length)
eq('listed routes unique', new Set(listed.map(t => t.route)).size, listed.length)
eq('scoreboard route',  registry.toolById('pr-scoreboard').route, '/scoreboard')
ok('every route absolute', listed.every(t => t.route.startsWith('/')))
ok('every tool has a blurb and a CTA', listed.every(t => t.blurb && t.cta && t.detail))
eq('grouped covers every listed tool',
   registry.toolsByCategory().reduce((n, g) => n + g.tools.length, 0), listed.length)

// A retired tool keeps its identity so the lead desk and the funnel can still
// name it, and keeps its page so a link someone holds still resolves. What it
// loses is its place in the lineup.
const retired = registry.TOOL_IDS.filter(id => !listed.some(t => t.id === id))
ok('the offline tracker is retired from the lineup', retired.includes('offline-tracker'))
for (const id of retired) {
  const tool = registry.toolById(id)
  ok(`${id} still resolves by id`, Boolean(tool) && tool.listed === false)
  ok(`${id} keeps its page`, routeFile(tool.route))
  ok(`${id} is not suggested to anyone`,
     listed.every(t => registry.nextTool(t.id)?.tool.id !== id))
}
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


// ── The audit's measured checks ─────────────────────────────────────────────
console.log('\n── markup findings: measured, never a judgement')
const BARE = `<!doctype html><html><head></head><body>
<div id="app"></div><script src="/app.js"></script>
</body></html>`
const bareFacts = html.readPage(BARE, 'https://acme.ng/offer')
let fs_ = auditMod.markupFindings(bareFacts, 'https://acme.ng/offer', 'https://acme.ng/offer', 'lead_generation')
const titles = fs_.map(f => f.title)
ok('no viewport flagged',   titles.some(t => /viewport/i.test(t)))
ok('client-rendered flagged', titles.some(t => /without JavaScript/i.test(t)))
ok('no title flagged',      titles.some(t => /no title/i.test(t)))
ok('no description flagged',titles.some(t => /description/i.test(t)))
ok('no way to leave a lead',titles.some(t => /no way to leave a lead/i.test(t)))
ok('all measured',          fs_.every(f => f.provenance === 'observed'))
ok('every one has evidence',fs_.every(f => f.evidence.length > 0))
ok('every one has a fix',   fs_.every(f => f.recommendation.length > 0))

console.log('\n── a redirect on the campaign URL is a finding')
fs_ = auditMod.markupFindings(bareFacts, 'https://acme.ng/offer-v2', 'https://acme.ng/offer', null)
ok('redirect flagged', fs_.some(f => /redirects/i.test(f.title)))
fs_ = auditMod.markupFindings(bareFacts, 'https://acme.ng/offer/', 'https://acme.ng/offer', null)
ok('trailing slash is not a redirect', !fs_.some(f => /redirects/i.test(f.title)))

console.log('\n── a good page produces none of those')
const GOOD = `<!doctype html><html lang="en-NG"><head>
<title>Open an Acme account in five minutes</title>
<meta name="description" content="No paperwork. Open an account and start sending money today.">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="https://www.googletagmanager.com/gtag/js?id=G-X"></script></head><body>
<h1>Open an Acme account in five minutes</h1>
<p>No paperwork, no branch visit. We charge ₦10 per transfer and nothing else. Thousands of traders across Lagos use Acme every day to pay suppliers and get paid.</p>
<a href="/signup">Open an account</a>
<a href="https://wa.me/2348012345678">Ask us on WhatsApp</a>
<form action="/lead" method="post"><input name="phone"><input type="submit"></form>
</body></html>`
const goodFacts = html.readPage(GOOD, 'https://acme.ng/offer')
fs_ = auditMod.markupFindings(goodFacts, 'https://acme.ng/offer', 'https://acme.ng/offer', 'lead_generation')
eq('nothing flagged on a sound page', fs_.length, 0)
// A terse page is not a broken page: short copy with a headline and a call to
// action must not trip the client-rendered check.
const TERSE = `<html lang="en"><head><title>Order jollof</title>
<meta name="description" content="Order jollof in Lagos."><meta name="viewport" content="width=device-width"></head>
<body><h1>Order jollof</h1><a href="https://wa.me/2348000000000">Order on WhatsApp</a></body></html>`
eq('terse page not flagged as client-rendered',
   auditMod.markupFindings(html.readPage(TERSE, 'https://acme.ng/'), 'https://acme.ng/', 'https://acme.ng/', null)
     .some(f => /without JavaScript/i.test(f.title)), false)

console.log('\n── local market readiness')
fs_ = auditMod.localFindings(goodFacts, 'lead_generation')
ok('whatsapp link satisfies the channel check', !fs_.some(f => /no whatsapp/i.test(f.title)))
ok('naira price satisfies the currency check',  !fs_.some(f => /naira/i.test(f.title)))
fs_ = auditMod.localFindings(bareFacts, 'whatsapp_enquiries')
const noChannel = fs_.find(f => /no whatsapp/i.test(f.title))
ok('missing channel flagged', Boolean(noChannel))
eq('and high when the campaign buys WhatsApp enquiries', noChannel.severity, 'high')

const MENTIONS = `<html><head><meta name="viewport" content="width=device-width"></head><body>
<h1>Order now</h1><p>Message us on WhatsApp to order. Price ₦5,000.</p></body></html>`
fs_ = auditMod.localFindings(html.readPage(MENTIONS, 'https://acme.ng/'), 'purchases')
ok('mentioned but not linked flagged', fs_.some(f => /mentioned but not linked/i.test(f.title)))

console.log('\n── tracking is reported as present or absent, never as working')
let tracking = auditMod.trackingFindings(bareFacts)
eq('absent is high severity', [tracking.length, tracking[0].severity], [1, 'high'])
tracking = auditMod.trackingFindings(goodFacts)
ok('present is reported low', tracking[0].severity === 'low')
ok('and makes no claim it works', /cannot be seen from outside/i.test(tracking[0].detail))

console.log('\n── the AI reading can never be labelled as measured')
aiStub.setNextResponse(JSON.stringify({
  summary: 'The offer is clear.',
  findings: [
    // The model is asked for an area and a severity; it is never allowed to
    // claim its reading was observed, whatever it returns.
    { area: 'clarity', title: 'The headline does not say who this is for', detail: 'd', severity: 'high', evidence: 'e', recommendation: 'r' },
    { area: 'performance', title: 'Out-of-scope area falls back to clarity', severity: 'nonsense', evidence: 'e', recommendation: 'r' },
  ],
}))
const reading = await auditMod.readTheOffer({ facts: goodFacts, objective: null, market: 'Nigeria', competitor: null })
eq('summary carried', reading.summary, 'The offer is clear.')
eq('both findings kept', reading.findings.length, 2)
ok('all interpreted', reading.findings.every(f => f.provenance === 'interpreted'))
eq('out-of-scope area becomes clarity', reading.findings[1].area, 'clarity')
eq('bad severity becomes medium',       reading.findings[1].severity, 'medium')
aiStub.setNextResponse('not json')
eq('unparseable reading yields nothing', (await auditMod.readTheOffer({ facts: goodFacts, objective: null, market: null, competitor: null })).findings.length, 0)

console.log('\n── ordering: measured before interpreted at equal severity')
const ordered = auditMod.orderFindings([
  { area: 'clarity', title: 'low interpreted', detail: '', severity: 'low', provenance: 'interpreted', confidence: 'medium', evidence: '', recommendation: '' },
  { area: 'clarity', title: 'high interpreted', detail: '', severity: 'high', provenance: 'interpreted', confidence: 'medium', evidence: '', recommendation: '' },
  { area: 'performance', title: 'high measured', detail: '', severity: 'high', provenance: 'observed', confidence: 'high', evidence: 'x', recommendation: '' },
  { area: 'tracking', title: 'medium measured', detail: '', severity: 'medium', provenance: 'observed', confidence: 'high', evidence: 'x', recommendation: '' },
])
eq('order', ordered.map(f => f.title), ['high measured', 'high interpreted', 'medium measured', 'low interpreted'])

console.log('\n── audit vocabulary is complete')
ok('a label per area',     vocab.AUDIT_AREAS.every(a => vocab.AREA_LABEL[a]))
ok('a label per status',   vocab.FINDING_STATUS.every(s => vocab.FINDING_STATUS_LABEL[s]))
ok('a label per objective',vocab.CAMPAIGN_OBJECTIVES.every(o => vocab.OBJECTIVE_LABEL[o]))


/* ── Wiring. These are the regressions that do not show up in a type error:
      a tool in the dropdown with no page behind it, a renamed nav label, a
      dashboard module with no product tour, the PR Scoreboard's route moving. */
console.log('\n── navigation and routing wiring')

for (const tool of registry.FREE_TOOLS) {
  ok(`${tool.name} has a page at ${tool.route}`, routeFile(tool.route))
}
ok('the /tools directory exists',               routeFile('/tools'))
ok('the claim landing page exists',             routeFile('/tools/claim'))
ok('the PR Scoreboard keeps /scoreboard',       routeFile('/scoreboard'))
ok('/tools/pr-scoreboard alias exists',         routeFile('/tools/pr-scoreboard'))
ok('the scoreboard scan API is untouched',      routeFile('/api/scoreboard/scan'))
ok('the scoreboard lead API is untouched',      routeFile('/api/scoreboard/lead'))
ok('the public response page exists',           existsSync('src/app/respond/[campaignId]/page.tsx'))

const nav = readFileSync('src/components/landing/landing-page.tsx', 'utf8')
const menu = readFileSync('src/components/landing/free-tools-menu.tsx', 'utf8')
ok('the nav renders the Free Tools menu',   nav.includes('<FreeToolsMenu />'))
ok('and its mobile variant',                nav.includes('<FreeToolsMenu mobile />'))
ok('the label is exactly "Free Tools"',     /&gt;\s*Free Tools\s*&lt;|>\s*Free Tools\s*</.test(menu))
ok('the old singular label is gone',        !/>\s*Free tool\s*</.test(nav))
ok('the dropdown heading reads "Free intelligence tools"', menu.includes('Free intelligence tools'))
ok('the menu is driven by the registry',    menu.includes("from '@/lib/tools/registry'"))
ok('the directory is driven by the registry',
   readFileSync('src/components/landing/tools-directory.tsx', 'utf8').includes("from '@/lib/tools/registry'"))
ok('the directory headline is the agreed one',
   readFileSync('src/components/landing/tools-directory.tsx', 'utf8').includes('Better marketing decisions start here.'))

// Every dashboard module these tools open into needs a product tour and a nav
// entry, which CLAUDE.md requires of any new module.
const tours = readFileSync('src/lib/tour-definitions.ts', 'utf8')
const navRail = readFileSync('src/components/dashboard/dashboard-nav.tsx', 'utf8')
const meta = readFileSync('src/components/dashboard/page-meta.ts', 'utf8')
for (const [route, module] of [
  ['/dashboard/competitive/watchlist', 'competitor_watchlist'],
  ['/dashboard/opportunities',         'opportunities'],
  ['/dashboard/offline-tracker',       'offline_tracker'],
  ['/dashboard/campaign-audit',        'campaign_audit'],
]) {
  ok(`${route} exists`,            routeFile(route))
  ok(`${route} maps to a tour`,    tours.includes(`'${route}':`) && tours.includes(`${module}: [`))
  ok(`${route} is in the nav`,     navRail.includes(`href: '${route}'`))
  ok(`${route} has page meta`,     meta.includes(`'${route}':`))
}

// The redirect namespace is shared. If /go stops looking in tool_placements,
// every printed QR code from this tool silently breaks.
const go = readFileSync('src/app/go/[slug]/route.ts', 'utf8')
ok('/go resolves tool placements',   go.includes("from('tool_placements')"))
ok('/go still resolves print placements', go.includes("from('print_placements')"))
ok('/go still resolves OOH sites',   go.includes("from('ooh_sites')"))
ok('/go records a visit',            go.includes('recordVisit'))

// Every anonymous table must carry RLS, and none of them may open anon access.
const migration = readFileSync('supabase/migrations/20261014090000_free_tools.sql', 'utf8')
for (const table of [
  'tool_runs', 'tool_events', 'tool_campaigns', 'tool_placements', 'tool_visits',
  'tool_responses', 'competitor_moves', 'competitor_watches',
  'acquisition_opportunities', 'page_audits', 'page_audit_findings',
]) {
  ok(`${table} enables RLS`, migration.includes(`alter table ${table} enable row level security`))
}
ok('no policy is granted to anon', !/to\s+anon/i.test(migration))
ok('enquiries are not readable by the lead desk',
   !/create policy tool_responses_read[\s\S]{0,200}is_lead_desk/.test(migration))


// ── Lead capture: a later run must never cost us data ───────────────────────
console.log('\n── fillBlanks: blanks are filled, nothing is overwritten')
eq('fills a missing name',
   leads.fillBlanks({ name: null, role: 'CMO or marketing director' }, { name: 'Ada', role: null }),
   { name: 'Ada' })
eq('never overwrites a name already there',
   leads.fillBlanks({ name: 'Ada Obi' }, { name: 'A' }), {})
// The bug this exists for: a second, sparser form once erased the first one's
// answers, because an empty field sends an explicit null.
eq('a blank second form erases nothing',
   leads.fillBlanks({ name: 'Ada Obi', role: 'Brand manager', company: 'Acme' },
                    { name: null, role: null, company: null }), {})
eq('fills several blanks at once',
   leads.fillBlanks({ name: null, company: null, role: 'Brand manager' },
                    { name: 'Ada', company: 'Acme', role: 'Founder or MD' }),
   { name: 'Ada', company: 'Acme' })
eq('empty string counts as a blank incoming value',
   leads.fillBlanks({ name: null }, { name: '' }), {})

console.log('\n── company is derived from the website, not asked for')
eq('from the competitor tool inputs',
   leads.companyFromInputs({ yourWebsite: 'https://acme.ng/about', competitorWebsite: 'https://rival.ng' }),
   { company: 'Acme', website: 'https://acme.ng' })
eq('from an audited page', leads.companyFromInputs({ pageUrl: 'https://shop.jara.com.ng/offer?x=1' }).company, 'Shop')
eq('www is stripped', leads.companyFromInputs({ website: 'https://www.acme.ng' }).company, 'Acme')
eq('nothing to go on', leads.companyFromInputs({ market: 'Nigeria' }), { company: null, website: null })

console.log('\n── the gate withholds on the server, not in the browser')
const fullReport = {
  title: 'T', summary: 'S',
  findings: [
    { title: 'first', provenance: 'observed', confidence: 'high', evidence: [{ sourceUrl: 'https://a.ng' }] },
    { title: 'second', provenance: 'observed', confidence: 'high', evidence: [{ sourceUrl: 'https://b.ng' }] },
    { title: 'third', provenance: 'observed', confidence: 'high', evidence: [{ sourceUrl: 'https://c.ng' }] },
  ],
  nextAction: 'do the thing',
  coverage: [{ source: 'the press', read: true }],
  limitations: ['one', 'two'],
  generatedAt: '2026-10-18T00:00:00.000Z',
}
const preview = gate.gateReport(fullReport, false)
eq('one finding survives',        preview.report.findings.length, 1)
eq('and it is the strongest',     preview.report.findings[0].title, 'first')
eq('with its evidence intact',    preview.report.findings[0].evidence[0].sourceUrl, 'https://a.ng')
eq('two withheld',                preview.withheld.findings, 2)
eq('the next action is withheld', preview.report.nextAction, undefined)
eq('the limitations are withheld',preview.report.limitations, [])
// Coverage stays: it is the proof the work happened, and it names what we
// could not read, which is honest on either side of the gate.
eq('coverage stays',              preview.report.coverage.length, 1)
eq('the summary stays',           preview.report.summary, 'S')

const open_ = gate.gateReport(fullReport, true)
eq('unlocked keeps everything',   [open_.report.findings.length, open_.report.limitations.length, open_.gated],
   [3, 2, false])

console.log('\n── and the machine arrays are trimmed with it')
const result = { report: fullReport, moves: [{ a: 1 }, { a: 2 }, { a: 3 }], competitor: { name: 'Rival' } }
const gatedResult = gate.gateResult('competitor-tracker', result, false)
eq('moves trimmed to match the preview', gatedResult.result.moves.length, 1)
eq('other fields untouched', gatedResult.result.competitor.name, 'Rival')
eq('unlocked leaves the array alone',
   gate.gateResult('competitor-tracker', result, true).result.moves.length, 3)
eq('opportunities trimmed too',
   gate.gateResult('market-demand', { report: fullReport, opportunities: [1, 2, 3] }, false).result.opportunities.length, 1)
eq('audit findings trimmed too',
   gate.gateResult('campaign-audit', { report: fullReport, findings: [1, 2, 3, 4] }, false).result.findings.length, 1)

console.log('\n── every tool in the lineup has gate copy')
ok('copy for each listed tool', registry.FREE_TOOLS.every(t => {
  const c = gate.GATE_COPY[t.id]
  return c && typeof c.headline === 'function' && c.body && c.monitoring && c.button
}))
ok('the headline counts what is actually withheld',
   gate.GATE_COPY['competitor-tracker'].headline({ findings: 2 }).includes('2'))
ok('and reads naturally for one',
   !gate.GATE_COPY['competitor-tracker'].headline({ findings: 1 }).includes('1 more verified moves'))

// ── Brand Perception Gap ────────────────────────────────────────────────────
console.log('\n── the brand gap only writes down what a page actually says')
const sitePage = {
  url: 'https://jara.ng', title: 'Jara Foods', description: null, canonical: null, lang: 'en',
  text: 'Jara Foods makes affordable soups for busy Lagos families. We believe good food should never be a luxury. Every pack is cooked the way your mother would.',
  textLength: 160, headings: [], links: [], ctas: [], forms: [], images: 0, imagesWithoutAlt: 0,
  hasViewportMeta: true, trackers: [], scriptCount: 0, inlineStyleBlocks: 0, bytes: 1000,
}
aiStub.setNextResponse(JSON.stringify({
  audience: 'busy Lagos families',
  promise: 'affordable soups',
  category: 'Food & Beverage',
  values: [
    { label: 'Affordability', quote: 'We believe good food should never be a luxury.' },
    // Invented: nowhere on the page. Must be dropped rather than softened.
    { label: 'Sustainability', quote: 'Every pack is carbon neutral by 2027.' },
  ],
  voiceAdjectives: ['warm', 'plain'],
  tone: 'Warm and direct',
  segments: [{ name: 'Lagos households', demographics: '25-45', geography: 'Lagos' }],
}))
const stated = await brandGap.readStated({ name: 'Jara Foods', market: 'Nigeria', pages: [sitePage] })
eq('a quoted value survives',        stated.values.map(v => v.label), ['Affordability'])
eq('an unquoted value is dropped',   stated.values.length, 1)
eq('the quote keeps its source',     stated.values[0].sourceUrl, 'https://jara.ng')
eq('audience and promise recorded',  [stated.audience, stated.promise], ['busy Lagos families', 'affordable soups'])
eq('a known category is kept',       stated.category, 'Food & Beverage')

aiStub.setNextResponse(JSON.stringify({ category: 'Other', values: [] }))
const vague = await brandGap.readStated({ name: 'X', market: 'Nigeria', pages: [sitePage] })
eq('"Other" is not a category',      vague.category, null)
eq('an empty read stays empty',      [vague.audience, vague.values.length], [null, 0])

console.log('\n── and only names a gap an outside source supports')
const press = [{ title: 'Jara Foods expands', link: 'https://punchng.com/jara', pubDate: 'Mon, 06 Oct 2026 09:00:00 GMT', snippet: 'Jara Foods is best known for its speed of delivery across Lagos.' }]
aiStub.setNextResponse(JSON.stringify({
  described: [
    { source: 1, attribute: 'Fast delivery', quote: 'best known for its speed of delivery' },
    // A source index that does not exist. Dropped on the way back.
    { source: 9, attribute: 'Premium pricing', quote: 'invented' },
  ],
  divergences: [
    { kind: 'unclaimed', stated: '', described: 'Fast delivery', significance: 's', recommendation: 'r', sources: [1], confidence: 'high' },
    // An outside claim citing nothing is an opinion. Dropped.
    { kind: 'contradicted', stated: 'Affordable', described: 'Expensive', significance: 's', recommendation: 'r', sources: [], confidence: 'high' },
    // Absence is evidenced by their own words, so this one survives with the
    // site quote attached.
    { kind: 'missing', stated: 'Affordability', described: '', significance: 's', recommendation: 'r', sources: [], confidence: 'bogus' },
  ],
}))
const gap = await brandGap.readGap({ name: 'Jara Foods', market: 'Nigeria', stated, press, answers: [] })
eq('a cited attribute survives',        gap.traits.map(t => t.attribute), ['Fast delivery'])
eq('an invented source index is gone',  gap.traits.length, 1)
eq('kinds that survive',                gap.divergences.map(d => d.kind), ['unclaimed', 'missing'])
eq('the uncited contradiction is gone', gap.divergences.filter(d => d.kind === 'contradicted').length, 0)
eq('absence cites their own words',     gap.divergences[1].evidence[0].sourceName, 'Their own website')
eq('a nonsense confidence is normalised', gap.divergences[1].confidence, 'medium')
eq('press evidence keeps its link',     gap.divergences[0].evidence[0].sourceUrl, 'https://punchng.com/jara')

console.log('\n── an assistant answer is evidence with no address, never a fake link')
aiStub.setNextResponse(JSON.stringify({
  described: [{ source: 1, attribute: 'A fintech', quote: 'Jara Foods is often described as a fintech' }],
  divergences: [{ kind: 'contradicted', stated: 'A food brand', described: 'A fintech', significance: 's', recommendation: 'r', sources: [1], confidence: 'medium' }],
}))
const fromAssistant = await brandGap.readGap({
  name: 'Jara Foods', market: 'Nigeria', stated, press: [],
  answers: ['Jara Foods is often described as a fintech operating in Lagos.'],
})
eq('the attribute is recorded',      fromAssistant.traits[0].attribute, 'A fintech')
eq('with no invented URL',           fromAssistant.traits[0].sourceUrl, null)
eq('and no invented URL on the card', fromAssistant.divergences[0].evidence[0].sourceUrl, undefined)
// The platform is never named anywhere a visitor can read it.
ok('the model is never named', !JSON.stringify(fromAssistant).match(/gpt|gemini|perplexity|claude|sonar/i))

console.log('\n── an assistant that does not know the brand is not a description')
for (const refusal of [
  'I do not know this brand.',
  "I don't have information about a company called Jara Foods.",
  'I could not find any record of this brand.',
  'Jara Foods does not appear to be a well-known company.',
]) ok(`filtered: "${refusal.slice(0, 32)}"`, brandGap.looksLikeNotKnown(refusal))
for (const answer of [
  'Jara Foods is a Lagos food brand known for affordable soups.',
  'It is best known for fast delivery. I would describe it as practical.',
]) ok(`kept: "${answer.slice(0, 32)}"`, !brandGap.looksLikeNotKnown(answer))

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} checks passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
