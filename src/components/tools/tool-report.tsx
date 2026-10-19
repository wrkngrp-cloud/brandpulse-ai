'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Icon, ArrowRightIcon as ArrowRight, ExternalLinkIcon, CheckIcon, AlertIcon, InfoIcon } from '@/components/brand/icon'
import { PROVENANCE_LABEL, PROVENANCE_NOTE, type Finding, type ToolReport } from '@/lib/tools/report'
import { nextTool, type ToolId } from '@/lib/tools/registry'
import { trackTool } from './use-tool-analytics'

/**
 * How a free-tool report looks, once, for all of them.
 *
 * The one job this component has beyond legibility: never let an AI reading
 * pass for a measurement. Every finding wears its provenance, every piece of
 * evidence carries its link, and the limitations block is rendered at normal
 * size at the foot of the report rather than set small and grey. A marketer
 * who takes one of these into a meeting has to be able to defend it.
 */

export function ReportView({
  report, toolId, runToken, ctaHeadline, ctaBody, ctaPrimary, gated = false, gate,
}: {
  report: ToolReport
  toolId: ToolId
  /** Present once the analysis is stored, so the CTA can carry the claim. */
  runToken?: string | null
  ctaHeadline: string
  ctaBody: string
  ctaPrimary: string
  /** True while the report is a preview and the rest is behind the email gate. */
  gated?: boolean
  /** The gate itself, or the acknowledgement once it has been answered. */
  gate?: React.ReactNode
}) {
  const next = nextTool(toolId)

  return (
    <div className="mx-auto max-w-4xl px-6">
      {/* ── The result ─────────────────────────────────────────────── */}
      <section className="border-t pt-10" style={{ borderColor: 'var(--lp-line)' }}>
        <p className="bg-label" style={{ color: 'var(--tx-flare)' }}>Your result</p>
        <h2 className="mt-3 text-2xl font-medium tracking-tight sm:text-3xl"
          style={{ fontFamily: 'var(--font)', color: 'var(--lp-ink)' }}>
          {report.title}
        </h2>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed" style={{ color: 'var(--lp-ink)' }}>
          {report.summary}
        </p>
        <p className="mt-3 text-[12px]" style={{ color: 'var(--lp-mut)' }}>
          Researched {new Date(report.generatedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </section>

      {/* ── Findings ───────────────────────────────────────────────── */}
      {report.findings.length > 0 && (
        <section className="mt-10 space-y-4">
          {report.findings.map((f, i) => <FindingCard key={i} finding={f} />)}
        </section>
      )}

      {report.findings.length === 0 && (
        <section className="mt-10 rounded-sm border p-6"
          style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-card)' }}>
          <p className="flex items-center gap-2 text-[15px] font-medium" style={{ color: 'var(--lp-ink)' }}>
            <AlertIcon className="h-4 w-4" style={{ color: 'var(--tx-flare)' }} />
            Nothing we could verify
          </p>
          <p className="mt-2.5 text-[13.5px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>
            We would rather tell you that than invent a finding. What we read is listed below.
          </p>
        </section>
      )}

      {/* ── The one next action ────────────────────────────────────── */}
      {report.nextAction && (
        <section className="mt-6 rounded-sm border p-6"
          style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-chip)' }}>
          <p className="bg-label" style={{ color: 'var(--lp-mut)' }}>Recommended next action</p>
          <p className="mt-2.5 text-[14.5px] leading-relaxed" style={{ color: 'var(--lp-ink)' }}>{report.nextAction}</p>
        </section>
      )}

      {/* ── What we read, and what we could not ────────────────────── */}
      <section className="mt-10 border-t pt-8" style={{ borderColor: 'var(--lp-line)' }}>
        <p className="bg-label" style={{ color: 'var(--lp-mut)' }}>What this is based on</p>
        <ul className="mt-4 space-y-2">
          {report.coverage.map((c, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[13px]" style={{ color: 'var(--lp-ink)' }}>
              {c.read
                ? <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: 'var(--pos)' }} />
                : <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: 'var(--tx-flare)' }} />}
              <span>
                {c.source}
                {c.note && <span style={{ color: 'var(--lp-mut)' }}> — {c.note}</span>}
              </span>
            </li>
          ))}
        </ul>

        {report.limitations.length > 0 && (
          <>
            <p className="bg-label mt-8" style={{ color: 'var(--lp-mut)' }}>What this cannot tell you</p>
            <ul className="mt-4 space-y-2.5">
              {report.limitations.map((l, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[13px] leading-relaxed" style={{ color: 'var(--lp-ink)' }}>
                  <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: 'var(--lp-mut)' }} />
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {gate}

      {/* ── Continue in BrandGauge ─────────────────────────────────── */}
      {/* Suppressed while the report is a preview. The email ask and the
          sign-up ask compete for the same moment, and offering both is how
          neither gets answered. Once the gate is cleared this is the only
          thing left to do. */}
      {!gated && (
        <BetaContinuation
          toolId={toolId} runToken={runToken}
          headline={ctaHeadline} body={ctaBody} primary={ctaPrimary}
        />
      )}

      {/* ── One contextual tool suggestion, after the CTA ──────────── */}
      {!gated && next && (
        <section className="mt-12 border-t pt-8" style={{ borderColor: 'var(--lp-line)' }}>
          <p className="text-[13.5px]" style={{ color: 'var(--lp-mut)' }}>{next.line}</p>
          <Link href={next.tool.route}
            onClick={() => trackTool({ event: 'free_tool_result_engaged', toolId, props: { to: next.tool.id } })}
            className="mt-2.5 inline-flex items-center gap-2 text-[14px] font-medium"
            style={{ color: 'var(--tx-flare)' }}>
            <Icon name={next.tool.icon} className="h-4 w-4" />
            {next.tool.name} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </section>
      )}
    </div>
  )
}

export function FindingCard({ finding }: { finding: Finding }) {
  return (
    <article className="rounded-sm border p-6" style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-card)' }}>
      <div className="flex flex-wrap items-center gap-2">
        {finding.tag && (
          <span className="rounded-sm px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em]"
            style={{ background: 'var(--lp-chip)', color: 'var(--lp-ink)' }}>
            {finding.tag}
          </span>
        )}
        <ProvenancePill finding={finding} />
      </div>

      <h3 className="mt-3 text-[16px] font-medium leading-snug tracking-tight" style={{ color: 'var(--lp-ink)' }}>
        {finding.title}
      </h3>

      {finding.detail && (
        <p className="mt-2.5 text-[13.5px] leading-relaxed" style={{ color: 'var(--lp-ink)' }}>{finding.detail}</p>
      )}

      {finding.significance && (
        <div className="mt-4 border-l-2 pl-4" style={{ borderColor: 'var(--flare)' }}>
          <p className="bg-label" style={{ color: 'var(--lp-mut)' }}>Why it matters · AI reading</p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: 'var(--lp-ink)' }}>{finding.significance}</p>
        </div>
      )}

      {finding.evidence.length > 0 && (
        <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--lp-line)' }}>
          <p className="bg-label" style={{ color: 'var(--lp-mut)' }}>Evidence</p>
          <ul className="mt-2.5 space-y-2.5">
            {finding.evidence.map((e, i) => (
              <li key={i}>
                {e.quote && (
                  /* Verbatim, unglossed. The quote is the thing that makes the
                     claim checkable; paraphrasing it into our own words is how
                     a report stops being evidence. */
                  <p className="text-[13px] leading-relaxed" style={{ color: 'var(--lp-ink)' }}>“{e.quote}”</p>
                )}
                {e.sourceUrl ? (
                  <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer nofollow"
                    className="mt-1 inline-flex max-w-full items-center gap-1.5 text-[12px] underline-offset-2 hover:underline"
                    style={{ color: 'var(--tx-flare)' }}>
                    <ExternalLinkIcon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{e.sourceName ?? hostOf(e.sourceUrl)}</span>
                    {e.publishedAt && <span style={{ color: 'var(--lp-mut)' }}>· {e.publishedAt}</span>}
                  </a>
                ) : (
                  /* A source with no address. Named, not linked, and never
                     dressed up as a link that goes nowhere. */
                  <p className="mt-1 text-[12px]" style={{ color: 'var(--lp-mut)' }}>
                    {e.sourceName ?? 'Source not published'}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  )
}

function ProvenancePill({ finding }: { finding: Finding }) {
  return (
    <span title={PROVENANCE_NOTE[finding.provenance]}
      className="rounded-sm border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em]"
      style={{ borderColor: 'var(--lp-line)', color: 'var(--lp-mut)' }}>
      {PROVENANCE_LABEL[finding.provenance]} · {finding.confidence} confidence
    </span>
  )
}

/**
 * The continuation, not a paywall.
 *
 * The report above is already finished and already theirs. This offers the
 * next thing, and the token rides along so nothing has to be typed twice.
 */
export function BetaContinuation({
  toolId, runToken, headline, body, primary,
}: {
  toolId: ToolId
  runToken?: string | null
  headline: string
  body: string
  primary: string
}) {
  const claimPath = runToken ? `/tools/claim?token=${encodeURIComponent(runToken)}` : '/dashboard'
  const href = `/auth/signup?next=${encodeURIComponent(claimPath)}`

  // Once per mount. On a ref callback this re-fired on every render and turned
  // one impression into a dozen.
  useEffect(() => { trackTool({ event: 'beta_cta_viewed', toolId }) }, [toolId])

  return (
    <section className="mt-12 rounded-sm border p-7"
      style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-card)' }}>
      <h2 className="max-w-2xl text-xl font-medium tracking-tight sm:text-2xl"
        style={{ fontFamily: 'var(--font)', color: 'var(--lp-ink)' }}>
        {headline}
      </h2>
      <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>{body}</p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={href}
          onClick={() => trackTool({ event: 'beta_cta_clicked', toolId, props: { cta: 'primary' } })}
          className="flex items-center gap-2 rounded-sm px-6 py-3 text-[14px] font-bold text-on-hot bg-press"
          style={{ background: 'var(--flare)' }}>
          {primary} <ArrowRight className="h-4 w-4" />
        </Link>
        <Link href="/features"
          onClick={() => trackTool({ event: 'beta_cta_clicked', toolId, props: { cta: 'secondary' } })}
          className="rounded-sm border px-6 py-3 text-[14px] font-medium bg-press"
          style={{ borderColor: 'var(--lp-line)', color: 'var(--lp-ink)' }}>
          Explore BrandGauge
        </Link>
      </div>

      <p className="mt-5 text-[12px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>
        BrandGauge is free while we are in open beta. No card, and nothing to connect:
        {' '}you can bring in your social and ad accounts later, or never.
        {runToken && ' Your report above comes with you.'}
      </p>
    </section>
  )
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}
