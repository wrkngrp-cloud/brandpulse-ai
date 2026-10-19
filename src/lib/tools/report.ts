/**
 * The shape every free-tool report shares.
 *
 * Four kinds of claim, and the UI renders each differently, because the whole
 * credibility of these tools rests on a marketer being able to tell at a
 * glance which is which:
 *
 *   observed      — a source says this, and here is the link.
 *   estimated     — we calculated it, and here is the method.
 *   interpreted   — a model read the evidence and formed a view.
 *   recommended   — an action we suggest.
 *
 * A finding without evidence is not a finding. Where a tool cannot establish
 * something it says so in `limitations`, which is rendered, not buried.
 */

export type Provenance = 'observed' | 'estimated' | 'interpreted' | 'recommended'
export type Confidence = 'high' | 'medium' | 'low'

export interface Evidence {
  /** What the source actually said. Verbatim, never paraphrased into a claim. */
  quote?:     string
  /**
   * Optional, for the one source that genuinely has no address: an answer an
   * AI assistant gave when we asked it about a brand. Inventing a URL for
   * that would be the worst kind of fake citation, so the field is absent and
   * the card renders the quote unlinked under its source name.
   */
  sourceUrl?: string
  sourceName?: string
  publishedAt?: string | null
}

export interface Finding {
  title:       string
  detail?:     string
  /** Why a marketer should care. Interpretation, labelled as such. */
  significance?: string
  provenance:  Provenance
  confidence:  Confidence
  evidence:    Evidence[]
  tag?:        string
}

export interface CoverageNote {
  source:  string
  /** True when we read it. False means we could not, and `note` says why. */
  read:    boolean
  note?:   string
}

export interface ToolReport {
  title:        string
  /** Two or three sentences a marketer could paste into an email. */
  summary:      string
  findings:     Finding[]
  /** One action, the strongest. More than one and nobody does any of them. */
  nextAction?:  string
  coverage:     CoverageNote[]
  /** What this report cannot tell you. Always populated. */
  limitations:  string[]
  generatedAt:  string
}

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  observed:    'Observed',
  estimated:   'Estimated',
  interpreted: 'AI reading',
  recommended: 'Recommended',
}

export const PROVENANCE_NOTE: Record<Provenance, string> = {
  observed:    'A source says this. The link is attached.',
  estimated:   'Calculated by us. The method is stated.',
  interpreted: 'A model read the evidence above and formed this view.',
  recommended: 'An action we suggest, not a measurement.',
}
