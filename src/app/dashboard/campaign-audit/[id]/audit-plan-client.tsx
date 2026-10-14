'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  CheckIcon, ExportIcon, ExternalLinkIcon, InfoIcon, RefreshIcon,
} from '@/components/brand/icon'
import { Working } from '@/components/brand/working'
import {
  AREA_LABEL, FINDING_STATUS, FINDING_STATUS_LABEL, SEVERITY_LABEL,
  type AuditArea, type FindingStatus, type Severity,
} from '@/lib/tools/audit-vocab'
import type { PageSpeedResult } from '@/lib/tools/pagespeed'

interface Finding {
  id: string
  area: AuditArea
  title: string
  detail: string | null
  severity: Severity
  provenance: 'observed' | 'interpreted'
  confidence: 'high' | 'medium' | 'low'
  evidence: string | null
  recommendation: string | null
  status: FindingStatus
  resolved_at: string | null
  created_at: string
}

interface Audit {
  id: string
  pageUrl: string
  summary: string | null
  performance: PageSpeedResult | null
  createdAt: string
}

/**
 * The improvement plan.
 *
 * Measured findings and AI readings are kept visually apart, in two blocks
 * with their own headings, because a marketer deciding what to put in front of
 * a developer needs to know which items can be pointed at a number and which
 * are a judgement about the copy. The order inside each block is severity.
 */
export function AuditPlanClient({
  audit, findings: initial, history,
}: {
  audit: Audit
  findings: Finding[]
  history: { id: string; createdAt: string; count: number; high: number }[]
}) {
  const claimed = useSearchParams().get('claimed')
  const router = useRouter()
  const [findings, setFindings] = useState(initial)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [rerunning, setRerunning] = useState(false)

  const measured   = useMemo(() => findings.filter(f => f.provenance === 'observed'), [findings])
  const interpreted = useMemo(() => findings.filter(f => f.provenance === 'interpreted'), [findings])
  const open  = findings.filter(f => f.status === 'open' || f.status === 'planned').length
  const fixed = findings.filter(f => f.status === 'fixed').length

  async function setStatus(finding: Finding, status: FindingStatus) {
    setSavingId(finding.id)
    const before = findings
    setFindings(fs => fs.map(f => (f.id === finding.id ? { ...f, status } : f)))
    try {
      const res = await fetch('/api/campaign-audit/finding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: finding.id, status }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'That did not save.')
    } catch (err) {
      setFindings(before)
      toast.error(err instanceof Error ? err.message : 'That did not save.')
    } finally { setSavingId(null) }
  }

  async function rerun() {
    setRerunning(true)
    try {
      const res = await fetch('/api/campaign-audit/rerun', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditId: audit.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'That re-audit did not run.')
      toast.success(
        data.resolved > 0
          ? `${data.resolved} ${data.resolved === 1 ? 'finding' : 'findings'} did not come back. ${data.findings} on the new audit.`
          : `New audit done: ${data.findings} ${data.findings === 1 ? 'finding' : 'findings'}.`,
      )
      router.push(`/dashboard/campaign-audit/${data.auditId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'That re-audit did not run.')
    } finally { setRerunning(false) }
  }

  /** A plain-text summary for a developer ticket or a team channel. */
  function copyPlan() {
    const lines = [
      `Campaign improvement plan — ${audit.pageUrl}`,
      `Audited ${new Date(audit.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      '',
      'MEASURED',
      ...measured.map(f => formatFinding(f)),
      '',
      'AI READING OF THE PAGE COPY (a judgement, not measured customer behaviour)',
      ...interpreted.map(f => formatFinding(f)),
      '',
      'No overall score and no revenue estimate: there is no conversion data behind this.',
    ]
    navigator.clipboard.writeText(lines.join('\n'))
      .then(() => toast.success('Plan copied, ready to paste.'))
      .catch(() => toast.error('Your browser would not let us copy that.'))
  }

  const perf = audit.performance

  return (
    <div className="space-y-6">
      {claimed === 'campaign-audit' && (
        <div className="rounded-sm border border-line bg-flare-wash p-4">
          <p className="flex items-center gap-2 text-[14px] font-medium text-tx">
            <CheckIcon className="h-4 w-4 text-pos" /> Your audit is here
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-tx-2">
            Every finding is now a task with a status. Fix what matters, then re-run the audit:
            anything that does not come back is marked fixed, so the history shows the work.
          </p>
        </div>
      )}

      <section data-tour="audit-header" className="rounded-sm border border-line bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            {audit.summary && <p className="max-w-2xl text-[14px] leading-relaxed text-tx">{audit.summary}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-5">
              <Stat label="Open" value={open} />
              <Stat label="Fixed" value={fixed} />
              <Stat label="Audits of this page" value={history.length} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={rerun} disabled={rerunning}
              className="flex items-center gap-1.5 rounded-sm bg-flare px-4 py-2 text-[13px] font-bold text-on-hot bg-press disabled:opacity-50">
              {rerunning ? <Working className="h-3.5 w-3.5" /> : <RefreshIcon className="h-3.5 w-3.5" />}
              Re-run the audit
            </button>
            <button type="button" onClick={copyPlan}
              className="flex items-center gap-1.5 rounded-sm border border-line px-4 py-2 text-[13px] font-medium text-tx bg-press">
              <ExportIcon className="h-3.5 w-3.5" /> Copy plan
            </button>
            <a href={audit.pageUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-sm border border-line px-4 py-2 text-[13px] font-medium text-tx bg-press">
              <ExternalLinkIcon className="h-3.5 w-3.5" /> Open the page
            </a>
          </div>
        </div>

        {perf && (
          <div className="mt-5 border-t border-line pt-4">
            <p className="bg-label text-tx-3">
              Measured on mobile · {perf.fieldAvailable ? 'real visitors, 28 days' : 'one emulated mid-range Android'}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
              {perf.performanceScore !== null && <Stat label="Performance" value={perf.performanceScore} />}
              {perf.accessibilityScore !== null && <Stat label="Accessibility" value={perf.accessibilityScore} />}
              {(perf.fieldAvailable ? perf.field : perf.lab).slice(0, 4).map(m => (
                <div key={m.label}>
                  <p className="bg-label text-tx-3">{m.label}</p>
                  <p className="bg-num mt-0.5 text-[17px] leading-none"
                    style={{ color: m.rating === 'good' ? 'var(--pos)' : m.rating === 'poor' ? 'var(--tx-flare)' : 'var(--tx)' }}>
                    {m.display}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {measured.length > 0 && (
        <section data-tour="audit-measured" className="space-y-3">
          <div>
            <h2 className="text-[15px] font-medium text-tx">Measured</h2>
            <p className="mt-0.5 text-[12.5px] text-tx-3">
              Each of these was checked by a tool. The evidence is the measurement.
            </p>
          </div>
          {measured.map(f => (
            <FindingCard key={f.id} finding={f} saving={savingId === f.id} onStatus={setStatus} />
          ))}
        </section>
      )}

      {interpreted.length > 0 && (
        <section data-tour="audit-interpreted" className="space-y-3">
          <div>
            <h2 className="text-[15px] font-medium text-tx">AI reading of the page</h2>
            <p className="mt-0.5 max-w-2xl text-[12.5px] leading-relaxed text-tx-3">
              A model read your copy and formed a view on whether the offer, the audience and the
              next step are clear. Useful, and not a measurement: no real visitor was observed.
            </p>
          </div>
          {interpreted.map(f => (
            <FindingCard key={f.id} finding={f} saving={savingId === f.id} onStatus={setStatus} />
          ))}
        </section>
      )}

      {history.length > 1 && (
        <section data-tour="audit-history" className="rounded-sm border border-line bg-card p-5">
          <h2 className="text-[15px] font-medium text-tx">This page over time</h2>
          <ul className="mt-3 divide-y divide-line">
            {history.map(h => (
              <li key={h.id} className="flex items-center justify-between py-2.5">
                <span className="text-[13px] text-tx">
                  {new Date(h.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {h.id === audit.id && <span className="ml-2 text-tx-3">this one</span>}
                </span>
                <span className="text-[12.5px] text-tx-2">
                  <span className="bg-num">{h.count}</span> findings
                  {h.high > 0 && <>, <span className="bg-num">{h.high}</span> high</>}
                  {h.id !== audit.id && (
                    <Link href={`/dashboard/campaign-audit/${h.id}`} className="ml-3 text-tx-flare">open</Link>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="flex max-w-2xl items-start gap-2 text-[12px] leading-relaxed text-tx-3">
        <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        There is no overall score here on purpose: we hold no conversion data for this page, so a
        number out of a hundred would be decoration. Nothing here estimates what a fix is worth
        either, because that needs your conversion rate and your margins.
      </p>
    </div>
  )
}

function FindingCard({
  finding, saving, onStatus,
}: { finding: Finding; saving: boolean; onStatus: (f: Finding, s: FindingStatus) => void }) {
  return (
    <article className="rounded-sm border border-line bg-card p-5"
      style={{ opacity: finding.status === 'fixed' || finding.status === 'wont_fix' ? 0.65 : undefined }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-sm bg-shell px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-tx-2">
          {AREA_LABEL[finding.area]}
        </span>
        <span className="rounded-sm border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em]"
          style={finding.severity === 'high'
            ? { borderColor: 'var(--flare)', color: 'var(--tx-flare)' }
            : { borderColor: 'var(--line)', color: 'var(--tx-3)' }}>
          {SEVERITY_LABEL[finding.severity]}
        </span>
        <span className="rounded-sm border border-line px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-tx-3">
          {finding.provenance === 'observed' ? 'Measured' : 'AI reading'} · {finding.confidence} confidence
        </span>
      </div>

      <h3 className="mt-3 text-[15px] font-medium leading-snug text-tx">{finding.title}</h3>
      {finding.detail && <p className="mt-2 text-[13.5px] leading-relaxed text-tx-2">{finding.detail}</p>}

      {finding.evidence && (
        <div className="mt-3 border-l-2 border-line pl-4">
          <p className="bg-label text-tx-3">What we saw</p>
          <p className="bg-num mt-1 break-words text-[12.5px] text-tx-2">{finding.evidence}</p>
        </div>
      )}

      {finding.recommendation && (
        <div className="mt-3 border-l-2 border-flare pl-4">
          <p className="bg-label text-tx-3">What to do</p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-tx">{finding.recommendation}</p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <span className="bg-label text-tx-3">Status</span>
        {FINDING_STATUS.map(s => (
          <button key={s} type="button" disabled={saving || finding.status === s}
            onClick={() => onStatus(finding, s)}
            className="rounded-sm border px-2.5 py-1 text-[12px] font-medium bg-press disabled:opacity-100"
            style={finding.status === s
              ? { background: 'var(--flare)', color: 'var(--on-hot)', borderColor: 'var(--flare)' }
              : { borderColor: 'var(--line)', color: 'var(--tx-2)' }}>
            {FINDING_STATUS_LABEL[s]}
          </button>
        ))}
        {finding.resolved_at && (
          <span className="text-[12px] text-tx-3">
            fixed {new Date(finding.resolved_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
    </article>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="bg-label text-tx-3">{label}</p>
      <p className="bg-num mt-0.5 text-[20px] leading-none text-tx">{value}</p>
    </div>
  )
}

function formatFinding(f: Finding): string {
  return [
    `- [${f.severity.toUpperCase()}] ${f.title}  (${FINDING_STATUS_LABEL[f.status]})`,
    f.evidence ? `    Evidence: ${f.evidence}` : null,
    f.recommendation ? `    Fix: ${f.recommendation}` : null,
  ].filter(Boolean).join('\n')
}
