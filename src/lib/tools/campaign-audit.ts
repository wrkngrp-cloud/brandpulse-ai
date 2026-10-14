import { callAi, extractJson } from '@/lib/ai/client'
import { fetchPublic, failureSentence, normaliseUrl, rootHost } from './fetch-public'
import { absolute, readPage, type PageFacts } from './html'
import { runPageSpeed, type PageSpeedResult } from './pagespeed'
import type { CoverageNote, Finding, ToolReport } from './report'
import {
  AREA_LABEL, OBJECTIVE_LABEL, SEVERITY_LABEL,
  type AuditArea, type CampaignObjective, type Severity,
} from './audit-vocab'

/**
 * The Campaign Conversion Audit.
 *
 * "Is my landing page ready for the traffic I am paying for" is a question
 * with two halves, and the whole design here is about not mixing them up.
 *
 * One half is measurable. Mobile performance from PageSpeed Insights, failing
 * accessibility audits, whether a viewport meta exists, how many fields the
 * form has, whether the page redirected on the way in, which analytics
 * scripts are present, whether the main call to action's destination resolves.
 * Those are observed, and each one names what observed it.
 *
 * The other half is a judgement: whether the offer is clear, whether a buyer
 * knows who it is for, whether the next step is obvious. A model can read a
 * page and form a view on that, and that view is useful, but it is not
 * measured consumer behaviour and this module never lets it be presented as
 * one. Those findings carry provenance 'interpreted' and the report says, in
 * its own body, that no real visitor was observed.
 *
 * There is deliberately no overall score. A number out of a hundred invites a
 * marketer to chase the number, and we have no conversion data to calibrate
 * one against, so it would be decoration. The findings are ordered by severity
 * instead, and nothing anywhere estimates lost revenue.
 */

export interface AuditFinding {
  area:           AuditArea
  title:          string
  detail:         string
  severity:       Severity
  provenance:     'observed' | 'interpreted'
  confidence:     'high' | 'medium' | 'low'
  /** What we actually saw, quoted or measured. */
  evidence:       string
  recommendation: string
}

export interface CampaignAuditResult {
  pageUrl:     string
  /** Where we ended up, if the page redirected. */
  finalUrl:    string
  objective:   CampaignObjective | null
  market:      string | null
  title:       string | null
  summary:     string
  performance: PageSpeedResult | null
  findings:    AuditFinding[]
  coverage:    CoverageNote[]
  competitor:  { url: string; title: string | null; ctas: string[] } | null
  report:      ToolReport
}

export interface AuditInput {
  pageUrl:           string
  objective?:        CampaignObjective | null
  market?:           string | null
  competitorUrl?:    string | null
}

export type AuditOutcome =
  | { ok: true; result: CampaignAuditResult }
  | { ok: false; reason: 'bad_url' | 'unreachable'; note: string; coverage: CoverageNote[] }

export async function runCampaignAudit(input: AuditInput): Promise<AuditOutcome> {
  const target = normaliseUrl(input.pageUrl)
  if (!target) return { ok: false, reason: 'bad_url', note: 'That address did not parse as a web page.', coverage: [] }

  const coverage: CoverageNote[] = []

  // ── 1. The page itself ────────────────────────────────────────────────────
  const page = await fetchPublic(target)
  if (!page.ok) {
    coverage.push({ source: 'The landing page', read: false, note: failureSentence(page.failure) })
    return {
      ok: false, reason: 'unreachable',
      note: `We could not load ${target.hostname}. ${failureSentence(page.failure)} If your ads point at this address, that is worth knowing on its own: check it in a private window on a phone.`,
      coverage,
    }
  }
  const facts = readPage(page.body, page.url)
  coverage.push({ source: `The landing page (${page.status}, ${Math.round(facts.bytes / 1024)}KB of HTML)`, read: true })

  const findings: AuditFinding[] = []

  // ── 2. Measured mobile performance ────────────────────────────────────────
  const performance = await runPageSpeed(page.url)
  if (performance) {
    coverage.push({
      source: performance.fieldAvailable
        ? 'PageSpeed Insights, mobile, with real-user field data'
        : 'PageSpeed Insights, mobile, lab data only',
      read: true,
      note: performance.fieldAvailable
        ? undefined
        : 'This page does not have enough traffic for Chrome’s real-user dataset, so the numbers are one emulated run.',
    })
    findings.push(...performanceFindings(performance))
    findings.push(...accessibilityFindings(performance))
  } else {
    coverage.push({
      source: 'PageSpeed Insights',
      read: false,
      note: process.env.PAGESPEED_API_KEY
        ? 'The service did not answer, so this report makes no claim about how fast the page is.'
        : 'No PAGESPEED_API_KEY is set, so we are on the keyless quota and it did not answer this time. This report therefore makes no claim about how fast the page is.',
    })
  }

  // ── 3. Deterministic checks on the markup ─────────────────────────────────
  findings.push(...markupFindings(facts, page.url, target.toString(), input.objective ?? null))
  findings.push(...await ctaFindings(facts, page.url))
  findings.push(...localFindings(facts, input.objective ?? null))
  findings.push(...trackingFindings(facts))
  coverage.push({ source: 'Calls to action, forms, markup and tracking scripts on the page', read: true })

  // ── 4. A competitor page, for comparison only ─────────────────────────────
  let competitor: CampaignAuditResult['competitor'] = null
  if (input.competitorUrl) {
    const comp = normaliseUrl(input.competitorUrl)
    if (comp && rootHost(comp.hostname) !== rootHost(target.hostname)) {
      const res = await fetchPublic(comp)
      if (res.ok) {
        const compFacts = readPage(res.body, res.url)
        competitor = { url: res.url, title: compFacts.title, ctas: compFacts.ctas.slice(0, 6).map(c => c.text) }
        coverage.push({ source: `${comp.hostname}, for comparison`, read: true })
      } else {
        coverage.push({ source: `${comp.hostname}, for comparison`, read: false, note: failureSentence(res.failure) })
      }
    }
  }

  // ── 5. The judgement half, labelled as such ───────────────────────────────
  const read = await readTheOffer({ facts, objective: input.objective ?? null, market: input.market ?? null, competitor })
  findings.push(...read.findings)
  coverage.push({
    source: 'A model reading the page copy for clarity and friction',
    read: true,
    note: 'An assessment of the page, not a measurement of how customers behaved on it.',
  })

  const ordered = orderFindings(findings)
  const summary = read.summary || fallbackSummary(ordered, facts, performance)

  const report = buildReport({
    host: target.hostname, finalUrl: page.url, requested: target.toString(),
    findings: ordered, summary, coverage, performance,
    objective: input.objective ?? null, market: input.market ?? null,
  })

  return {
    ok: true,
    result: {
      pageUrl:   target.toString(),
      finalUrl:  page.url,
      objective: input.objective ?? null,
      market:    input.market ?? null,
      title:     facts.title,
      summary,
      performance,
      findings:  ordered,
      coverage,
      competitor,
      report,
    },
  }
}

/* ── Measured findings ─────────────────────────────────────────────────────── */

export function performanceFindings(ps: PageSpeedResult): AuditFinding[] {
  const out: AuditFinding[] = []
  // Field data first when it exists: real people on real networks beats one
  // emulated run, and the finding says which it is.
  const source = ps.fieldAvailable ? ps.field : ps.lab
  const label  = ps.fieldAvailable ? 'real visitors to this page over the last 28 days' : 'one emulated mid-range Android on a slow 4G connection'

  for (const metric of source) {
    if (metric.rating === 'good') continue
    out.push({
      area:       'performance',
      title:      `${metric.label} is ${metric.rating === 'poor' ? 'poor' : 'below the threshold'} on mobile: ${metric.display}`,
      detail:     `Measured by PageSpeed Insights across ${label}. Google treats this as ${metric.rating === 'poor' ? 'poor' : 'needing improvement'}.`,
      severity:   metric.rating === 'poor' ? 'high' : 'medium',
      provenance: 'observed',
      confidence: ps.fieldAvailable ? 'high' : 'medium',
      evidence:   `${metric.label}: ${metric.display} (${metric.rating})`,
      recommendation: metric.label.toLowerCase().includes('layout shift')
        ? 'Set explicit width and height on images and reserve space for anything that loads late, so the page stops jumping under the thumb.'
        : metric.label.toLowerCase().includes('blocking')
          ? 'Defer the scripts that are not needed for the first screen. Tag managers and chat widgets are the usual culprits.'
          : 'Compress and correctly size the largest image on the first screen, and serve it in a modern format. That is normally most of this number.',
    })
  }

  if (ps.opportunities.length) {
    const top = ps.opportunities[0]
    out.push({
      area:       'performance',
      title:      `${top.title} would save about ${(top.savingsMs / 1000).toFixed(1)} seconds`,
      detail:     `PageSpeed Insights lists ${ps.opportunities.length} ${ps.opportunities.length === 1 ? 'opportunity' : 'opportunities'} worth more than 150ms on this page. This is the largest.`,
      severity:   top.savingsMs > 2000 ? 'high' : 'medium',
      provenance: 'observed',
      confidence: 'medium',
      evidence:   ps.opportunities.map(o => `${o.title}: ${(o.savingsMs / 1000).toFixed(1)}s`).join('; '),
      recommendation: 'Hand this list to whoever maintains the page. These are Lighthouse’s own estimates of time saved, so they are a work queue rather than a guess.',
    })
  }

  return out
}

export function accessibilityFindings(ps: PageSpeedResult): AuditFinding[] {
  return ps.failedAccessibility.slice(0, 4).map(a => ({
    area:       'accessibility' as AuditArea,
    title:      a.title,
    detail:     `${a.description} Lighthouse found ${a.items} ${a.items === 1 ? 'element' : 'elements'} failing this check.`,
    severity:   /contrast|tap|target|label|name/i.test(a.title) ? 'medium' : 'low',
    provenance: 'observed' as const,
    confidence: 'high' as const,
    evidence:   `${a.title}: ${a.items} failing ${a.items === 1 ? 'element' : 'elements'}`,
    recommendation: /contrast/i.test(a.title)
      ? 'Raise the contrast on the failing text. On a phone in Lagos sunlight this is the difference between a readable offer and a blank page.'
      : /tap|target/i.test(a.title)
        ? 'Make the tap targets bigger and further apart. A mis-tap on a slow connection usually ends the visit.'
        : 'Fix the failing elements so screen readers and keyboard users can complete the same journey.',
  }))
}

export function markupFindings(
  facts: PageFacts, finalUrl: string, requested: string, objective: CampaignObjective | null,
): AuditFinding[] {
  const out: AuditFinding[] = []

  if (!facts.hasViewportMeta) {
    out.push({
      area: 'friction',
      title: 'The page has no mobile viewport tag',
      detail: 'Without it, a phone renders the page at desktop width and zooms out, so the text arrives too small to read and every tap target shrinks with it.',
      severity: 'high', provenance: 'observed', confidence: 'high',
      evidence: 'No <meta name="viewport"> in the document head.',
      recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to the head. It is one line and it is the single biggest mobile fix available here.',
    })
  }

  if (normalise(finalUrl) !== normalise(requested)) {
    out.push({
      area: 'friction',
      title: 'The campaign URL redirects before the page loads',
      detail: `We asked for ${requested} and ended up at ${finalUrl}. Every redirect costs a round trip, and on a Nigerian mobile connection that is real time before anything is visible. It also drops any parameter the redirect does not forward, which is how UTM data goes missing.`,
      severity: 'medium', provenance: 'observed', confidence: 'high',
      evidence: `${requested} → ${finalUrl}`,
      recommendation: 'Point the ads at the final address, and check that your UTM parameters survive the hop before you scale spend.',
    })
  }

  /* A thin page is only a finding when it is thin in the way a
     browser-rendered page is thin: no headline, or nothing to act on. A short
     landing page that still carries a headline and a call to action is a
     deliberately terse page, not a broken one, and flagging it would train a
     marketer to ignore this check. */
  if (facts.textLength < 400 && (facts.headings.length === 0 || facts.ctas.length === 0)) {
    out.push({
      area: 'clarity',
      title: 'Almost nothing on this page is readable without JavaScript',
      detail: `The HTML carries ${facts.textLength} characters of text. The page is built in the browser, which means a slow or interrupted connection shows a blank screen, and search engines and link previews see very little.`,
      severity: 'medium', provenance: 'observed', confidence: 'high',
      evidence: `${facts.textLength} characters of server-rendered text in a ${Math.round(facts.bytes / 1024)}KB document.`,
      recommendation: 'Server-render at least the headline, the offer and the main call to action. Everything else can hydrate afterwards.',
    })
  }

  if (!facts.title) {
    out.push({
      area: 'clarity',
      title: 'The page has no title',
      detail: 'The title is what appears in a browser tab, a search result and a WhatsApp link preview. A link to this page shared in a group chat shows nothing useful.',
      severity: 'medium', provenance: 'observed', confidence: 'high',
      evidence: 'No <title> element.',
      recommendation: 'Write a title that names the offer and the brand, under about sixty characters.',
    })
  }

  if (!facts.description) {
    out.push({
      area: 'clarity',
      title: 'No meta description or og:description',
      detail: 'This is the sentence under the title in a search result and in a WhatsApp or Twitter preview. Without it, the platform picks a line of your page at random.',
      severity: 'low', provenance: 'observed', confidence: 'high',
      evidence: 'No description meta tag found.',
      recommendation: 'Add one sentence that says what the offer is and who it is for.',
    })
  }

  const biggestForm = facts.forms.sort((a, b) => b.fieldCount - a.fieldCount)[0]
  if (biggestForm && biggestForm.fieldCount > 6) {
    out.push({
      area: 'friction',
      title: `The form asks for ${biggestForm.fieldCount} things`,
      detail: `Fields: ${biggestForm.fields.filter(Boolean).slice(0, 10).join(', ')}. Each one is a reason to stop, and on a phone keyboard that cost is higher than it looks on a laptop.`,
      severity: biggestForm.fieldCount > 9 ? 'high' : 'medium',
      provenance: 'observed', confidence: 'high',
      evidence: `A form with ${biggestForm.fieldCount} visible fields posting to ${biggestForm.action ?? 'the same page'}.`,
      recommendation: 'Ask for the minimum that lets you follow up, usually a name and one way to reach them, and collect the rest in the conversation that follows.',
    })
  }

  if (objective === 'lead_generation' && !facts.forms.length && !facts.ctas.some(c => c.kind === 'whatsapp' || c.kind === 'tel')) {
    out.push({
      area: 'cta',
      title: 'This is a lead generation campaign and the page has no way to leave a lead',
      detail: 'No form, no WhatsApp link and no phone number that we can see in the markup.',
      severity: 'high', provenance: 'observed', confidence: 'medium',
      evidence: 'No <form>, no wa.me link and no tel: link found on the page.',
      recommendation: 'Put one way to make contact above the fold. In this market a WhatsApp link usually outperforms a form.',
    })
  }

  return out
}

/* ── Calls to action, including whether they still work ──────────────────── */

/**
 * Checks the main call to action's destination resolves.
 *
 * Only navigation is tested, and only with a GET, which is what a browser
 * does when a person taps a link. Anything that looks like it would do
 * something in the real world is skipped by name — a cart, a checkout, a
 * payment, a logout, an unsubscribe — because a GET on one of those could
 * place an order or cancel somebody's account. Forms are never submitted at
 * all.
 */
const UNSAFE_PATH = /(cart|checkout|pay|payment|order|buy|purchase|subscribe|unsubscribe|logout|signout|delete|remove|cancel|confirm|verify|activate|redeem|claim)/i

async function ctaFindings(facts: PageFacts, pageUrl: string): Promise<AuditFinding[]> {
  const out: AuditFinding[] = []

  if (!facts.ctas.length) {
    out.push({
      area: 'cta',
      title: 'We could not find a call to action on this page',
      detail: 'Nothing in the markup reads like an action: no button or link whose words tell a visitor what to do next. A page that arrives from a paid ad with no obvious next step spends the click and keeps nothing.',
      severity: 'high', provenance: 'observed', confidence: 'medium',
      evidence: `${facts.links.length} links and no button or link text matching a conversion action.`,
      recommendation: 'Put one clear action near the top, in the words a customer would use: "Order on WhatsApp", "Open an account", "Book a demo".',
    })
    return out
  }

  const distinct = new Set(facts.ctas.map(c => c.text.toLowerCase().trim())).size
  if (distinct > 5) {
    out.push({
      area: 'cta',
      title: `${distinct} different actions compete on this page`,
      detail: `We read: ${[...new Set(facts.ctas.map(c => c.text.trim()))].slice(0, 8).join(', ')}. When everything is offered, the visitor picks nothing.`,
      severity: 'medium', provenance: 'observed', confidence: 'medium',
      evidence: `${distinct} distinct call-to-action labels in the markup.`,
      recommendation: 'Choose one primary action for this campaign and make everything else visibly secondary.',
    })
  }

  // The first CTA that is a plain navigation link is the one worth testing.
  const testable = facts.ctas.find(c => {
    if (c.kind !== 'link' || !c.href) return false
    const abs = absolute(c.href, pageUrl)
    if (!abs) return false
    try { return !UNSAFE_PATH.test(new URL(abs).pathname + new URL(abs).search) } catch { return false }
  })

  if (testable?.href) {
    const abs = absolute(testable.href, pageUrl)
    if (abs) {
      const res = await fetchPublic(abs, { timeoutMs: 8_000 })
      if (!res.ok && res.failure !== 'unsupported_type') {
        out.push({
          area: 'cta',
          title: `The “${testable.text.trim()}” link does not load`,
          detail: `We followed it and ${failureSentence(res.failure).toLowerCase()} Someone who taps your main action lands on this.`,
          severity: 'high', provenance: 'observed', confidence: res.failure === 'timeout' ? 'medium' : 'high',
          evidence: `${abs} → ${res.failure}${res.status ? ` (HTTP ${res.status})` : ''}`,
          recommendation: 'Open it on a phone yourself and fix the destination before any more spend goes through this page.',
        })
      }
    }
  }

  return out
}

/* ── Local market readiness ───────────────────────────────────────────────── */

export function localFindings(facts: PageFacts, objective: CampaignObjective | null): AuditFinding[] {
  const out: AuditFinding[] = []
  const text = facts.text.toLowerCase()

  const hasWhatsapp = facts.ctas.some(c => c.kind === 'whatsapp') || /whatsapp/i.test(facts.text)
  const hasPhone    = facts.ctas.some(c => c.kind === 'tel')

  if (!hasWhatsapp && !hasPhone) {
    out.push({
      area: 'local_readiness',
      title: 'No WhatsApp link and no tappable phone number',
      detail: 'A large share of buyers in this market want to ask a question before they commit, and they ask it on WhatsApp. A page with no human channel loses the ones who were nearly convinced.',
      severity: objective === 'whatsapp_enquiries' ? 'high' : 'medium',
      provenance: 'observed', confidence: 'high',
      evidence: 'No wa.me or api.whatsapp.com link, and no tel: link, in the markup.',
      recommendation: 'Add a wa.me link with a prefilled message naming this campaign, so the enquiry arrives with context.',
    })
  } else if (hasWhatsapp && !facts.ctas.some(c => c.kind === 'whatsapp')) {
    out.push({
      area: 'local_readiness',
      title: 'WhatsApp is mentioned but not linked',
      detail: 'The page talks about WhatsApp, and we could not find a wa.me link to tap. Typing a number out of a web page on a phone is enough friction to lose the enquiry.',
      severity: 'medium', provenance: 'observed', confidence: 'medium',
      evidence: 'The word WhatsApp appears in the copy with no wa.me or api.whatsapp.com link present.',
      recommendation: 'Make it a tappable wa.me link with the number in international format.',
    })
  }

  if ((objective === 'purchases' || /price|₦|naira|buy|order/i.test(text)) &&
      !/(₦|naira|ngn)/i.test(facts.text)) {
    out.push({
      area: 'local_readiness',
      title: 'No price in Naira anywhere on the page',
      detail: 'A buyer deciding whether to order wants the number in their own currency. Pricing in dollars, or not at all, pushes the decision off the page.',
      severity: 'medium', provenance: 'observed', confidence: 'medium',
      evidence: 'No ₦, "naira" or "NGN" found in the page text.',
      recommendation: 'Show the Naira price, or say plainly what happens next if the price depends on the order.',
    })
  }

  // A heavy page is a cost as well as a wait where data is bought in bundles.
  if (facts.bytes > 600_000) {
    out.push({
      area: 'local_readiness',
      title: `The HTML alone is ${Math.round(facts.bytes / 1024)}KB before images or scripts`,
      detail: 'Most of this market buys data in bundles, so page weight is money as well as time. A heavy page gets abandoned by people who can afford your product but not your landing page.',
      severity: facts.bytes > 1_200_000 ? 'high' : 'medium',
      provenance: 'observed', confidence: 'high',
      evidence: `${Math.round(facts.bytes / 1024)}KB of HTML, ${facts.scriptCount} script tags, ${facts.images} images.`,
      recommendation: 'Cut what the first screen does not need. The usual wins are unused fonts, a tag manager loading five tools, and full-size images scaled down in CSS.',
    })
  }

  return out
}

/* ── Tracking, as far as it is observable ─────────────────────────────────── */

export function trackingFindings(facts: PageFacts): AuditFinding[] {
  if (!facts.trackers.length) {
    return [{
      area: 'tracking',
      title: 'No analytics or conversion tracking is visible in the page source',
      detail: 'We found no Google Analytics, Tag Manager, Meta Pixel, TikTok Pixel or similar script. Without one, you can buy traffic to this page and never learn what it did.',
      severity: 'high', provenance: 'observed', confidence: 'medium',
      evidence: `${facts.scriptCount} script tags, none matching a known analytics or pixel signature.`,
      recommendation: 'Install analytics and whichever ad platform pixel you buy on, and fire a conversion event on the action this campaign wants.',
    }]
  }
  return [{
    area: 'tracking',
    title: `Tracking present: ${facts.trackers.join(', ')}`,
    detail: 'These scripts are in the page source. Whether they are configured correctly, and whether a conversion event actually fires on the action that matters, cannot be seen from outside the page and we make no claim about it.',
    severity: 'low', provenance: 'observed', confidence: 'high',
    evidence: facts.trackers.join(', '),
    recommendation: 'Fire the real conversion event once in a test and confirm it arrives in the platform you buy on. Presence in the source is not proof it works.',
  }]
}

/* ── The judgement half ───────────────────────────────────────────────────── */

const READ_SYSTEM = `You are a conversion-focused marketer reading one landing page the way a first-time visitor would, on a phone, on a slow connection, in an African market. You are given the page's title, headings and text, and sometimes a competitor's page for contrast.

Answer four questions about the page as written: what the offer is, who it is for, why it matters, and what the visitor should do next. Where the page does not answer one of them clearly, that is a finding.

Rules:
- Work only from the text given. Never claim a page element you were not shown.
- Never state how customers behaved, what a page's conversion rate is, how much money is being lost, or what a change would be worth. You have no such data. Say what is unclear and why it would cost a buyer's attention.
- Each finding must quote the page, or say plainly that the thing is absent.
- At most four findings. Fewer is correct when the page is clear.
- Severity: high when a buyer could not work out what to do, medium when they would hesitate, low when it is a polish issue.
- Plain English, active voice, specific. No em dashes. Never use the words delve, underscore, pivotal, crucial, robust, vibrant, leverage, seamless or tapestry.

Return ONLY JSON:
{"summary":"","findings":[{"area":"clarity","title":"","detail":"","severity":"high","evidence":"","recommendation":""}]}

"area" is one of: clarity, friction, cta, local_readiness.
"summary" is two or three sentences a marketer could paste into an email, saying what this page does well and where it loses people.`

export async function readTheOffer(args: {
  facts: PageFacts
  objective: CampaignObjective | null
  market: string | null
  competitor: CampaignAuditResult['competitor']
}): Promise<{ summary: string; findings: AuditFinding[] }> {
  const f = args.facts
  const user = `${args.objective ? `This campaign is buying: ${OBJECTIVE_LABEL[args.objective]}\n` : ''}${args.market ? `Market: ${args.market}\n` : ''}
PAGE ${f.url}
Title: ${f.title ?? '(none)'}
Description: ${f.description ?? '(none)'}
Headings: ${f.headings.map(h => `H${h.level}: ${h.text}`).slice(0, 20).join(' | ')}
Calls to action found in the markup: ${f.ctas.map(c => `${c.text} (${c.kind})`).join(', ') || '(none found)'}
Forms: ${f.forms.length ? f.forms.map(fm => `${fm.fieldCount} fields (${fm.fields.filter(Boolean).slice(0, 8).join(', ')})`).join('; ') : '(none)'}
Text:
"""${f.text.slice(0, 6000)}"""
${args.competitor ? `\nFOR CONTRAST, a competitor's page ${args.competitor.url}\nTitle: ${args.competitor.title ?? '(none)'}\nTheir calls to action: ${args.competitor.ctas.join(', ')}` : ''}`

  try {
    const raw = await callAi({
      tier: 'structural',
      system: READ_SYSTEM,
      messages: [{ role: 'user', content: user }],
      maxTokens: 2600,
    })
    const parsed = extractJson<{
      summary?: string
      findings?: { area?: string; title?: string; detail?: string; severity?: string; evidence?: string; recommendation?: string }[]
    }>(raw)

    const allowed: AuditArea[] = ['clarity', 'friction', 'cta', 'local_readiness']
    const findings = (parsed.findings ?? []).flatMap<AuditFinding>(x => {
      if (!x?.title?.trim()) return []
      return [{
        area:       (allowed.includes(x.area as AuditArea) ? x.area : 'clarity') as AuditArea,
        title:      x.title.trim().slice(0, 200),
        detail:     (x.detail ?? '').trim(),
        severity:   (['high', 'medium', 'low'].includes(x.severity ?? '') ? x.severity : 'medium') as Severity,
        // Never 'observed'. A model's reading of copy is a reading, and the
        // card and the report both say so.
        provenance: 'interpreted',
        confidence: 'medium',
        evidence:   (x.evidence ?? '').trim(),
        recommendation: (x.recommendation ?? '').trim(),
      }]
    }).slice(0, 4)

    return { summary: (parsed.summary ?? '').trim(), findings }
  } catch (err) {
    console.error('[campaign-audit] page reading failed:', err)
    return { summary: '', findings: [] }
  }
}

/* ── Ordering and the report ──────────────────────────────────────────────── */

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 }

export function orderFindings(findings: AuditFinding[]): AuditFinding[] {
  return [...findings].sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    if (bySeverity !== 0) return bySeverity
    // Measured before interpreted at the same severity: a marketer should hit
    // the things we can prove first.
    if (a.provenance !== b.provenance) return a.provenance === 'observed' ? -1 : 1
    return 0
  })
}

function fallbackSummary(findings: AuditFinding[], facts: PageFacts, ps: PageSpeedResult | null): string {
  const high = findings.filter(f => f.severity === 'high').length
  if (!findings.length) {
    return `We checked ${facts.url} and found nothing we would hold up a campaign for. ${ps ? 'Mobile performance measured within Google’s thresholds.' : 'The performance check did not run, so this says nothing about speed.'}`
  }
  return `${findings.length} ${findings.length === 1 ? 'finding' : 'findings'} on this page${high ? `, ${high} of which would cost you customers before you scale spend` : ''}. The measured ones come first; the reading of your copy is marked as a reading.`
}

function buildReport(args: {
  host: string
  finalUrl: string
  requested: string
  findings: AuditFinding[]
  summary: string
  coverage: CoverageNote[]
  performance: PageSpeedResult | null
  objective: CampaignObjective | null
  market: string | null
}): ToolReport {
  const findings: Finding[] = args.findings.map(f => ({
    title: f.title,
    detail: [f.detail, f.recommendation && `What to do: ${f.recommendation}`].filter(Boolean).join(' '),
    provenance: f.provenance,
    confidence: f.confidence,
    tag: `${AREA_LABEL[f.area]} · ${SEVERITY_LABEL[f.severity]}`,
    // The evidence is a measurement or a quote from the page rather than a
    // third-party source, so the page itself is the link.
    evidence: f.evidence
      ? [{ quote: f.evidence, sourceUrl: args.finalUrl, sourceName: `Measured on ${args.host}` }]
      : [{ sourceUrl: args.finalUrl, sourceName: `The page we audited` }],
  }))

  const first = args.findings.find(f => f.severity === 'high') ?? args.findings[0]

  return {
    title: 'Your Campaign Readiness Audit',
    summary: args.summary,
    findings,
    nextAction: first
      ? `Start with this: ${first.recommendation || first.title}`
      : 'Nothing here needs fixing before you scale. Re-run this after your next change to the page.',
    coverage: args.coverage,
    limitations: [
      'There is no overall score here on purpose. We have no conversion data for your page, so a number out of a hundred would be decoration, and chasing it would be worse than useless.',
      'Nothing in this report estimates lost revenue or what a fix is worth. That needs your conversion rate and your margins, and we have neither.',
      'The findings marked as an AI reading are a judgement about the page as written, not measured customer behaviour. No real visitor was observed.',
      args.performance
        ? args.performance.fieldAvailable
          ? 'Mobile performance comes from PageSpeed Insights, including real-user data from Chrome over the last 28 days.'
          : 'Mobile performance comes from one emulated run on a mid-range Android. This page does not have enough traffic for Chrome’s real-user dataset, so treat the numbers as directional.'
        : 'The performance check did not run on this attempt, so this report makes no claim about how fast the page is.',
      'We never submitted a form and never followed a link that looked like it would place an order, take a payment or cancel anything, so the parts of your journey behind those are untested.',
      'Analytics and pixels are reported as present or absent in the page source. Whether they are configured correctly, and whether a conversion fires on the action that matters, is not observable from outside.',
    ],
    generatedAt: new Date().toISOString(),
  }
}

function normalise(url: string): string {
  try {
    const u = new URL(url)
    return `${u.origin}${u.pathname.replace(/\/$/, '')}`
  } catch { return url }
}
