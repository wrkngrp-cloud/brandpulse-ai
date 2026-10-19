import type { ToolReport } from './report'
import type { ToolId } from './registry'

/**
 * What an anonymous visitor sees before they give us an address.
 *
 * The rule this file exists to enforce: the gate is applied on the server, to
 * the payload. Rendering a full report and hiding part of it behind a blur
 * would put the whole thing in the network response, which means the gate is
 * theatre for anyone who opens dev tools — and worse, it would make the page
 * claim something untrue about what it is withholding.
 *
 * What the preview keeps, deliberately:
 *
 *   the summary, so they know what we concluded;
 *   the single strongest finding, complete, with its source link;
 *   the coverage list, so they can see the work actually happened.
 *
 * That last pair is the whole design. A preview that proves we read eleven
 * press stories and found a real dated pricing change at a named competitor
 * is worth an email address. A teaser that says "3 findings available" is
 * worth a throwaway one.
 *
 * What it withholds: the remaining findings, the recommended action, and the
 * limitations block. The limitations go behind the gate not because they are
 * valuable but because they belong to the report, and splitting a report's
 * caveats from its claims is how a caveat gets lost.
 */

export interface Withheld {
  /** How many findings are not in the preview. Shown as a number, never
   *  inflated: it is the real length of the array we are holding back. */
  findings:      number
  nextAction:    boolean
  limitations:   boolean
}

export interface GatedReport {
  report:   ToolReport
  gated:    boolean
  withheld: Withheld
}

/** Trim a report to its preview. Returns the report untouched when unlocked. */
export function gateReport(report: ToolReport, unlocked: boolean): GatedReport {
  if (unlocked) {
    return { report, gated: false, withheld: { findings: 0, nextAction: false, limitations: false } }
  }

  const [first] = report.findings
  return {
    gated: true,
    withheld: {
      findings:    Math.max(0, report.findings.length - (first ? 1 : 0)),
      nextAction:  Boolean(report.nextAction),
      limitations: report.limitations.length > 0,
    },
    report: {
      ...report,
      findings: first ? [first] : [],
      nextAction: undefined,
      // Coverage stays: it is the evidence that we did the work, and it names
      // what we could not read, which is honest in both states.
      limitations: [],
    },
  }
}

/**
 * The same trim applied to a tool's whole result object.
 *
 * Each result carries the display report AND the machine fields the claim
 * importer reads later (moves, opportunities, findings). Both have to be
 * trimmed or the withheld content ships in the JSON anyway.
 */
export function gateResult<T extends Record<string, unknown>>(
  toolId: ToolId, result: T, unlocked: boolean,
): { result: T; gated: boolean; withheld: Withheld } {
  const report = result.report as ToolReport | undefined
  if (!report) {
    return { result, gated: false, withheld: { findings: 0, nextAction: false, limitations: false } }
  }

  const gated = gateReport(report, unlocked)
  if (!gated.gated) return { result, gated: false, withheld: gated.withheld }

  const trimmed: Record<string, unknown> = { ...result, report: gated.report }

  // The machine arrays, by tool. Keeping the first element matches the single
  // finding the preview shows, so the two halves of the payload agree.
  for (const key of MACHINE_ARRAYS[toolId] ?? []) {
    const value = trimmed[key]
    if (Array.isArray(value)) trimmed[key] = value.slice(0, 1)
  }

  return { result: trimmed as T, gated: true, withheld: gated.withheld }
}

/** Which arrays on each tool's result hold the findings themselves. */
const MACHINE_ARRAYS: Partial<Record<ToolId, string[]>> = {
  'brand-gap':          ['divergences'],
  'competitor-tracker': ['moves'],
  'market-demand':      ['opportunities'],
  'campaign-audit':     ['findings'],
}

/* ── The ask, per tool ─────────────────────────────────────────────────────
   The recurring hook is the reason the address is real. Somebody who wants to
   be told when a competitor moves again has to give a working address to get
   it, which is a different transaction from paying a toll to read a page. */

export interface GateCopy {
  /** The headline over the form. Names what is still behind it. */
  headline:   (withheld: Withheld) => string
  /** One line on why the address is worth giving. */
  body:       string
  /** The tick box: the recurring version of this tool. */
  monitoring: string
  button:     string
}

export const GATE_COPY: Record<ToolId, GateCopy> = {
  'brand-gap': {
    headline: w => w.findings === 1
      ? 'One more gap between what you say and what the market says back'
      : `${w.findings} more gaps between what you say and what the market says back`,
    body: 'We will send the full reading to your inbox, with what each source actually said, so you can put it in front of whoever owns your messaging.',
    monitoring: 'Read my brand again in a quarter and tell me whether the gap closed.',
    button: 'Send me the full reading',
  },
  'competitor-tracker': {
    headline: w => w.findings === 1
      ? 'One more verified move, and what to do about it'
      : `${w.findings} more verified moves, and what to do about them`,
    body: 'We will send the full brief to your inbox, with every source, so you can forward it to whoever owns the category plan.',
    monitoring: 'Tell me when this competitor makes another move. We check every Monday.',
    button: 'Send me the full brief',
  },
  'market-demand': {
    headline: w => w.findings === 1
      ? 'One more opportunity, with the evidence behind it'
      : `${w.findings} more opportunities, with the evidence behind each one`,
    body: 'We will send the full report to your inbox, with the searches we ran and who is visible where you are not.',
    monitoring: 'Check my market again in a month and tell me what moved.',
    button: 'Send me the full report',
  },
  'campaign-audit': {
    headline: w => w.findings === 1
      ? 'One more finding on this page'
      : `${w.findings} more findings on this page`,
    body: 'We will send the full audit to your inbox, measured numbers and all, in a form you can hand to whoever maintains the page.',
    monitoring: 'Re-audit this page in 30 days and tell me what I fixed.',
    button: 'Send me the full audit',
  },
  // The offline tracker does not gate. Its result is a set of QR codes
  // somebody is about to print, and withholding two of three would damage the
  // product rather than qualify anybody. Its copy lives here so the capture
  // component can be shared; the ask is delivery, not access.
  'offline-tracker': {
    headline: () => 'Keep your campaign dashboard',
    body: 'Right now the only way back to these numbers is the address in your browser. We will email you the link so a closed tab does not lose it.',
    monitoring: 'Send me a weekly summary of what each placement brought in.',
    button: 'Email me the link',
  },
  'pr-scoreboard': {
    headline: () => 'Watch this every Monday',
    body: 'We re-run the same four brands each week and write to you when your share moves.',
    monitoring: 'Send me the Monday email. Nothing else.',
    button: 'Send it to me',
  },
}

/** The roles a BDM can actually act on, and the one thing we cannot infer
 *  from a website. Seniority is embedded in the label rather than asked for
 *  separately, so the form stays at three fields. */
export const LEAD_ROLES = [
  'Founder or MD',
  'CMO or marketing director',
  'Head of marketing, or marketing manager',
  'Brand manager',
  'Growth or performance marketer',
  'Media, OOH or events manager',
  'Agency or consultant',
  'Something else',
] as const

export type LeadRole = (typeof LEAD_ROLES)[number]
