import { callAi, extractJson } from '@/lib/ai/client'
import { fetchPublic, failureSentence, normaliseUrl, rootHost, robotsDisallows, pathAllowed } from './fetch-public'
import { findSectionLinks, readPage, type PageFacts } from './html'
import { getSearchProvider, QUERY_BUDGET, type SearchAnswer } from './search-provider'
import type { CoverageNote, Evidence, Finding, ToolReport } from './report'
import { EVIDENCE_KIND_LABEL, INTENT_LABEL, type EvidenceKind, type IntentStage } from './demand-labels'

/**
 * The Market Demand Gap Finder.
 *
 * "Where is customer demand my brand is not capturing" is the question, and
 * the honest answer depends entirely on what we are licensed to measure. This
 * module is built around that dependency rather than hiding it.
 *
 * With a search provider (SERPAPI_KEY), we can see who is visible for the
 * searches a buyer in this market would actually run, and whether the company
 * appears. That is a visibility gap, evidenced by result URLs.
 *
 * Without one, we can still establish something real and never guessed: the
 * company's own site does not address an intent its buyers plainly have. That
 * is a content gap, evidenced by the company's own pages.
 *
 * What this module never produces, in either mode: a search volume, a growth
 * rate, a keyword difficulty, a CPC, a traffic estimate or a market share. No
 * free source gives those, the paid search endpoint we use does not return
 * them either, and a plausible-looking number is worse than no number. Where
 * demand cannot be measured, the report says so and reports the gap it can
 * actually stand behind.
 */

export { INTENT_LABEL, EVIDENCE_KIND_LABEL, type IntentStage, type EvidenceKind } from './demand-labels'

export interface Opportunity {
  title:              string
  customerProblem:    string
  intentStage:        IntentStage
  evidenceKind:       EvidenceKind
  evidence:           Evidence[]
  competitorsVisible: string[]
  recommendedAction:  string
  priority:           number
  why:                string
}

export interface MarketDemandResult {
  business: {
    name:       string
    website:    string
    market:     string
    products:   string[]
    customers:  string[]
    valueProps: string[]
    category:   string
  }
  /** What the provider was asked, and what came back. Named in the report. */
  searched:      { query: string; stage: IntentStage; youRanked: boolean; provider: string }[]
  provider:      string | null
  opportunities: Opportunity[]
  report:        ToolReport
}

export interface DemandInput {
  website:           string
  market:            string
  productCategory?:  string | null
  competitorWebsite?: string | null
}

export type DemandOutcome =
  | { ok: true; result: MarketDemandResult }
  | { ok: false; reason: 'bad_url' | 'site_unreadable' | 'too_thin' | 'no_opportunities'; note: string; coverage: CoverageNote[] }

const PRODUCT_PATTERNS = [/product/i, /service/i, /solution/i, /\/pricing/i, /\/plans?/i, /what-we-do/i, /\/features?/i]

export async function runMarketDemand(input: DemandInput): Promise<DemandOutcome> {
  const site = normaliseUrl(input.website)
  if (!site) return { ok: false, reason: 'bad_url', note: 'That address did not parse as a website.', coverage: [] }

  const market = input.market.trim() || 'Nigeria'
  const coverage: CoverageNote[] = []

  // ── 1. What this business actually sells ─────────────────────────────────
  const home = await fetchPublic(site)
  if (!home.ok) {
    coverage.push({ source: `${site.hostname}`, read: false, note: failureSentence(home.failure) })
    return {
      ok: false, reason: 'site_unreadable',
      note: `We could not read ${site.hostname}. ${failureSentence(home.failure)} Everything here is built from your public website, so there is nothing to work from until we can reach it.`,
      coverage,
    }
  }
  const facts = readPage(home.body, home.url)
  coverage.push({ source: `${site.hostname} homepage`, read: true })

  /* A page that renders entirely in the browser gives us almost no text, and
     a report built on two hundred characters would be a report built on
     nothing. Better to say so. */
  if (facts.textLength < 220) {
    coverage.push({
      source: `${site.hostname} readable content`,
      read: false,
      note: `Only ${facts.textLength} characters of text. The page probably renders in the browser rather than on the server.`,
    })
    return {
      ok: false, reason: 'too_thin',
      note: `We reached ${site.hostname} but it returned almost no readable text, which usually means the page is built in the browser. We cannot tell what you sell from that, and guessing is not worth your time. A page with server-rendered copy, or a different page on the same site, will work.`,
      coverage,
    }
  }

  // Their own product and pricing pages, when they link to them. Paths we
  // guessed at, so robots.txt is honoured.
  const origin = new URL(home.url).origin
  const disallows = await robotsDisallows(origin)
  const extraPages: PageFacts[] = []
  for (const candidate of findSectionLinks(facts, PRODUCT_PATTERNS, 2)) {
    try { if (!pathAllowed(new URL(candidate).pathname, disallows)) continue } catch { continue }
    const res = await fetchPublic(candidate)
    if (res.ok) {
      extraPages.push(readPage(res.body, res.url))
      coverage.push({ source: `${new URL(candidate).pathname} on ${site.hostname}`, read: true })
    }
  }

  // ── 2. The business, and the searches its buyers would run ───────────────
  const understanding = await understandBusiness({ facts, extraPages, market, category: input.productCategory ?? null })
  if (!understanding) {
    return {
      ok: false, reason: 'too_thin',
      note: 'We read your site but could not form a clear enough picture of what you sell to go looking for gaps. Try the page that describes your product most directly.',
      coverage,
    }
  }

  // ── 3. Competitor site, if they gave one ─────────────────────────────────
  let competitorFacts: PageFacts | null = null
  let competitorHost: string | null = null
  if (input.competitorWebsite) {
    const comp = normaliseUrl(input.competitorWebsite)
    if (comp) {
      competitorHost = rootHost(comp.hostname)
      const res = await fetchPublic(comp)
      if (res.ok) {
        competitorFacts = readPage(res.body, res.url)
        coverage.push({ source: `${comp.hostname}, for comparison`, read: true })
      } else {
        coverage.push({ source: `${comp.hostname}, for comparison`, read: false, note: failureSentence(res.failure) })
      }
    }
  }

  // ── 4. Search evidence, if we are licensed to read it ────────────────────
  const provider = getSearchProvider()
  const searched: MarketDemandResult['searched'] = []
  const answers: { answer: SearchAnswer; stage: IntentStage }[] = []
  const yourHost = rootHost(site.hostname)

  if (provider) {
    // The budget is the cost control. Queries are taken in the order the model
    // ranked them, so the ones spent are the ones it judged most commercial.
    for (const q of understanding.queries.slice(0, QUERY_BUDGET)) {
      const answer = await provider.search(q.query, market)
      if (!answer) continue
      const youRanked = answer.results.some(r => {
        try { return rootHost(new URL(r.url).hostname) === yourHost } catch { return false }
      })
      answers.push({ answer, stage: q.stage })
      searched.push({ query: q.query, stage: q.stage, youRanked, provider: answer.provider })
    }
    coverage.push({
      source: `${searched.length} buyer searches sampled in ${market} (${provider.name})`,
      read: searched.length > 0,
      note: searched.length ? undefined : 'The search provider did not answer, so this report falls back to what your own site covers.',
    })
  } else {
    coverage.push({
      source: 'Licensed search data',
      read: false,
      note: 'No search data provider is configured, so nothing here claims a search volume or a ranking. The gaps below are read off your own site and your competitor’s.',
    })
  }

  // ── 5. Opportunities, from whatever evidence we actually have ────────────
  const opportunities = await findOpportunities({
    understanding, answers, facts, extraPages, competitorFacts, competitorHost,
    market, yourHost, hasProvider: answers.length > 0,
  })

  if (!opportunities.length) {
    return {
      ok: false, reason: 'no_opportunities',
      note: `We read ${site.hostname}${answers.length ? ` and sampled ${answers.length} buyer searches in ${market}` : ''} and could not establish an acquisition gap we would stand behind. That is a better answer than three invented ones. If you tell us the product category you care about, the searches we look at get sharper.`,
      coverage,
    }
  }

  const report = buildReport({
    business: understanding, host: site.hostname, market, opportunities, coverage,
    searchedCount: searched.length, providerName: provider?.name ?? null,
  })

  return {
    ok: true,
    result: {
      business: {
        name:       understanding.name,
        website:    home.url,
        market,
        products:   understanding.products,
        customers:  understanding.customers,
        valueProps: understanding.valueProps,
        category:   understanding.category,
      },
      searched,
      provider: provider?.name ?? null,
      opportunities,
      report,
    },
  }
}

/* ── Step one: read the business, and write the searches ──────────────────── */

export interface Understanding {
  name:       string
  category:   string
  products:   string[]
  customers:  string[]
  valueProps: string[]
  problems:   string[]
  queries:    { query: string; stage: IntentStage; why: string }[]
}

const UNDERSTAND_SYSTEM = `You read a company's public website and work out what it sells, who buys it, and how those buyers search. You are working in African markets, Nigeria most often, so the searches you write must be the ones real buyers there type, in the words they use, including the local phrasing where that is how people actually search.

Rules:
- Work only from the website text given. Do not import facts about the company from anywhere else.
- Buyer searches must be commercially relevant to what this company sells. Not brand searches for the company's own name, and not generic one-word topics.
- Spread them across the stages: problem_aware, solution_discovery, brand_alternatives, comparison, purchase. Order them with the most commercially valuable first, because only the first few will be looked up.
- Plain English. No em dashes. Never use the words delve, underscore, pivotal, crucial, robust, vibrant, leverage, seamless or tapestry.

Return ONLY JSON:
{"name":"","category":"","products":[],"customers":[],"valueProps":[],"problems":[],"queries":[{"query":"","stage":"purchase","why":""}]}

Six to eight queries. "problems" are the customer problems in the customer's own words, not the company's marketing language.`

export async function understandBusiness(args: {
  facts: PageFacts
  extraPages: PageFacts[]
  market: string
  category: string | null
}): Promise<Understanding | null> {
  const pages = [args.facts, ...args.extraPages]
    .map(p => `PAGE ${p.url}\nTitle: ${p.title ?? '(none)'}\nHeadings: ${p.headings.slice(0, 12).map(h => h.text).join(' | ')}\nText: ${p.text.slice(0, 3000)}`)
    .join('\n\n')

  const user = `Market: ${args.market}\n${args.category ? `The company says its product category is: ${args.category}\n` : ''}\n${pages}`

  try {
    const raw = await callAi({
      tier: 'structural',
      system: UNDERSTAND_SYSTEM,
      messages: [{ role: 'user', content: user }],
      maxTokens: 2200,
    })
    const parsed = extractJson<Partial<Understanding>>(raw)
    const valid: IntentStage[] = ['problem_aware', 'solution_discovery', 'brand_alternatives', 'comparison', 'purchase']
    const queries = (parsed.queries ?? [])
      .filter(q => q?.query && q.query.trim().length > 4)
      .map(q => ({
        query: q.query.trim().slice(0, 120),
        stage: (valid.includes(q.stage as IntentStage) ? q.stage : 'solution_discovery') as IntentStage,
        why:   (q.why ?? '').trim(),
      }))
    if (!queries.length) return null
    return {
      name:       (parsed.name ?? args.facts.title ?? 'Your business').trim().slice(0, 80),
      category:   (parsed.category ?? args.category ?? 'your category').trim().slice(0, 80),
      products:   (parsed.products ?? []).slice(0, 8),
      customers:  (parsed.customers ?? []).slice(0, 8),
      valueProps: (parsed.valueProps ?? []).slice(0, 8),
      problems:   (parsed.problems ?? []).slice(0, 8),
      queries,
    }
  } catch (err) {
    console.error('[market-demand] understanding failed:', err)
    return null
  }
}

/* ── Step two: the opportunities ──────────────────────────────────────────── */

interface ModelOpportunity {
  title:              string
  customerProblem:    string
  stage:              string
  evidenceKind:       string
  /** Indices into the numbered evidence list. Anything outside it is dropped. */
  evidence:           number[]
  competitorsVisible: string[]
  recommendedAction:  string
  why:                string
}

const OPPORTUNITY_SYSTEM = `You turn research about one company's market into customer acquisition opportunities a marketer can act on this quarter. You are given what the company sells, the searches its buyers run, and a numbered list of evidence.

The evidence list is the only thing you may cite, and this is the part that matters most:

1. Every opportunity names the evidence numbers that support it. An opportunity you cannot support with a number does not go in the list.
2. Never state a search volume, a growth rate, a keyword difficulty, a cost per click, a traffic figure or a market share. You have not been given any, and inventing one would make this report worthless. Talk about who is visible and what is missing, not about how big anything is.
3. Classify what each opportunity rests on:
   - "demand_evidence" only when a search results page in the evidence shows real competitors ranking for a commercial query. Even then, this means demand is plausible, not measured.
   - "visibility_gap" when a results page shows others appearing for a query the company does not appear for.
   - "content_gap" when the company's own site does not address an intent its buyers plainly have.
4. At most three opportunities, strongest first. Fewer is correct when fewer are defensible. An empty list is a valid answer.
5. The recommended action must be something a marketing team could start in a week. Be specific about what to build or publish and who it is for.
6. Plain English, active voice. No em dashes. Never use the words delve, underscore, pivotal, crucial, robust, vibrant, leverage, seamless or tapestry.

Return ONLY JSON:
{"opportunities":[{"title":"","customerProblem":"","stage":"purchase","evidenceKind":"visibility_gap","evidence":[1,2],"competitorsVisible":[],"recommendedAction":"","why":""}]}`

export async function findOpportunities(args: {
  understanding: Understanding
  answers: { answer: SearchAnswer; stage: IntentStage }[]
  facts: PageFacts
  extraPages: PageFacts[]
  competitorFacts: PageFacts | null
  competitorHost: string | null
  market: string
  yourHost: string
  hasProvider: boolean
}): Promise<Opportunity[]> {
  /* The numbered evidence list, built from things we actually hold. The model
     answers with indices, so it cannot cite a URL we never fetched. */
  const evidence: Evidence[] = []
  const lines: string[] = []

  for (const { answer, stage } of args.answers) {
    const youRanked = answer.results.some(r => {
      try { return rootHost(new URL(r.url).hostname) === args.yourHost } catch { return false }
    })
    for (const r of answer.results.slice(0, 5)) {
      evidence.push({
        quote: r.snippet || r.title,
        sourceUrl: r.url,
        sourceName: `Result ${r.position} for “${answer.query}” in ${args.market}`,
      })
      lines.push(`[${evidence.length}] SEARCH RESULT · query "${answer.query}" (${stage}) · position ${r.position} · ${hostOf(r.url)}${youRanked ? '' : ' · the company does NOT appear on this page'}\n${r.title}\n${r.snippet}`)
    }
  }

  for (const page of [args.facts, ...args.extraPages]) {
    evidence.push({
      quote: page.headings.slice(0, 6).map(h => h.text).join(' · ') || page.title || undefined,
      sourceUrl: page.url,
      sourceName: `Your own page: ${pathOf(page.url)}`,
    })
    lines.push(`[${evidence.length}] THE COMPANY'S OWN PAGE · ${page.url}\nTitle: ${page.title ?? '(none)'}\nHeadings: ${page.headings.slice(0, 15).map(h => h.text).join(' | ')}\nText: ${page.text.slice(0, 1800)}`)
  }

  if (args.competitorFacts) {
    evidence.push({
      quote: args.competitorFacts.title ?? undefined,
      sourceUrl: args.competitorFacts.url,
      sourceName: `Competitor page: ${args.competitorHost ?? hostOf(args.competitorFacts.url)}`,
    })
    lines.push(`[${evidence.length}] A COMPETITOR'S PAGE · ${args.competitorFacts.url}\nTitle: ${args.competitorFacts.title ?? '(none)'}\nHeadings: ${args.competitorFacts.headings.slice(0, 15).map(h => h.text).join(' | ')}\nText: ${args.competitorFacts.text.slice(0, 1800)}`)
  }

  const u = args.understanding
  const user = `Company: ${u.name}
Category: ${u.category}
Market: ${args.market}
Sells: ${u.products.join(', ') || 'unclear'}
Buyers: ${u.customers.join(', ') || 'unclear'}
Its own value propositions: ${u.valueProps.join(', ') || 'unclear'}
Customer problems, in buyers' words: ${u.problems.join(' | ') || 'unclear'}

Buyer searches we identified: ${u.queries.map(q => `"${q.query}" (${q.stage})`).join(', ')}
${args.hasProvider
  ? `We looked up the first ${args.answers.length} of those in ${args.market} and the results are in the evidence below.`
  : `We have NO search data for this run. No provider is configured. So every opportunity here must be a content gap read off the company's own pages, and the report will say that no search data was measured.`}

EVIDENCE

${lines.join('\n\n')}`

  let parsed: { opportunities?: ModelOpportunity[] }
  try {
    const raw = await callAi({
      tier: 'structural',
      system: OPPORTUNITY_SYSTEM,
      messages: [{ role: 'user', content: user }],
      maxTokens: 3200,
    })
    parsed = extractJson<{ opportunities?: ModelOpportunity[] }>(raw)
  } catch (err) {
    console.error('[market-demand] opportunity pass failed:', err)
    return []
  }

  const stages: IntentStage[] = ['problem_aware', 'solution_discovery', 'brand_alternatives', 'comparison', 'purchase']
  const kinds: EvidenceKind[] = ['demand_evidence', 'visibility_gap', 'content_gap']

  return (parsed.opportunities ?? []).flatMap<Opportunity>((o, i) => {
    if (!o?.title?.trim()) return []
    const cited = (o.evidence ?? [])
      .map(n => evidence[Number(n) - 1])
      .filter((e): e is Evidence => Boolean(e))
    // An opportunity we cannot attach evidence to is dropped, not softened.
    if (!cited.length) return []

    let kind: EvidenceKind = kinds.includes(o.evidenceKind as EvidenceKind) ? o.evidenceKind as EvidenceKind : 'content_gap'
    /* Without a provider there is no search evidence in the room, whatever the
       model labelled it. Demoted rather than dropped, because the underlying
       observation about the company's own site is still real. */
    if (!args.hasProvider && kind !== 'content_gap') kind = 'content_gap'

    return [{
      title:              o.title.trim().slice(0, 200),
      customerProblem:    (o.customerProblem ?? '').trim(),
      intentStage:        (stages.includes(o.stage as IntentStage) ? o.stage : 'solution_discovery') as IntentStage,
      evidenceKind:       kind,
      evidence:           cited.slice(0, 5),
      competitorsVisible: (o.competitorsVisible ?? []).slice(0, 6).map(c => String(c).slice(0, 80)),
      recommendedAction:  (o.recommendedAction ?? '').trim(),
      priority:           Math.min(5, i + 1),
      why:                (o.why ?? '').trim(),
    }]
  }).slice(0, 3)
}

/* ── The report ───────────────────────────────────────────────────────────── */

function buildReport(args: {
  business: Understanding
  host: string
  market: string
  opportunities: Opportunity[]
  coverage: CoverageNote[]
  searchedCount: number
  providerName: string | null
}): ToolReport {
  const { opportunities, market, searchedCount, providerName } = args

  const findings: Finding[] = opportunities.map(o => ({
    title: o.title,
    detail: [o.customerProblem && `The customer problem: ${o.customerProblem}`,
             o.competitorsVisible.length && `Visible here instead of you: ${o.competitorsVisible.join(', ')}.`,
             o.recommendedAction && `What to do: ${o.recommendedAction}`]
      .filter(Boolean).join(' '),
    significance: o.why || undefined,
    // A visibility or content gap is observed: the page either shows you or it
    // does not. The ranking of which gap matters most is our reading, and the
    // card marks that separately.
    provenance: 'observed',
    confidence: o.evidenceKind === 'content_gap' ? 'medium' : 'high',
    tag: `${EVIDENCE_KIND_LABEL[o.evidenceKind]} · ${INTENT_LABEL[o.intentStage]}`,
    evidence: o.evidence,
  }))

  const summary = providerName
    ? `We read ${args.host}, worked out how buyers in ${market} search for what you sell, and looked up ${searchedCount} of those searches. ${opportunities.length} ${opportunities.length === 1 ? 'opportunity' : 'opportunities'} below, each one showing who is visible where you are not.`
    : `We read ${args.host} and worked out how buyers in ${market} search for what you sell. We have no licensed search data on this run, so nothing below claims a search volume or a ranking: these are gaps between what your buyers plainly need to know and what your own site says.`

  const limitations = [
    'Nothing here is a search volume, a growth rate, a keyword difficulty, a cost per click or a traffic estimate. No free source provides those, the search endpoint we use does not return them, and a plausible-looking number would make this report worth less than nothing.',
    providerName
      ? `We sampled ${searchedCount} ${searchedCount === 1 ? 'search' : 'searches'}, not your whole market. A results page shows who is visible today, in one place, for one phrasing. It is evidence that buyers are being served by someone, not proof of how many buyers there are.`
      : 'With no search provider configured we cannot see who ranks for anything. Every gap below is read off your own pages and your competitor’s, which is verifiable but narrower: it shows what you are not saying, not what you are not being found for.',
    'What you sell and who buys it are read from your public website. If the site undersells part of your business, this report will too.',
    'Commercial impact is not estimated anywhere. We have no revenue, conversion or margin data for your business, so an opportunity being first in this list means the evidence is strongest, not that it is worth the most money.',
  ]

  return {
    title: 'Your Customer Acquisition Opportunity Report',
    summary,
    findings,
    nextAction: opportunities[0]?.recommendedAction
      || `Pick the strongest gap above and put one page behind it, written for the buyer in ${market} rather than for your category.`,
    coverage: args.coverage,
    limitations,
    generatedAt: new Date().toISOString(),
  }
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}
function pathOf(url: string): string {
  try { return new URL(url).pathname } catch { return url }
}
