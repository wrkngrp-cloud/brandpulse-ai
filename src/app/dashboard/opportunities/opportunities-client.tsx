'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowRightIcon, CheckIcon, ExportIcon, ExternalLinkIcon, InfoIcon, MarketIcon,
} from '@/components/brand/icon'
import {
  EVIDENCE_KIND_LABEL, EVIDENCE_KIND_NOTE, INTENT_LABEL, STATUS_LABEL,
  OPPORTUNITY_STATUS, type EvidenceKind, type IntentStage, type OpportunityStatus,
} from '@/lib/tools/demand-labels'

interface EvidenceRow {
  quote?: string
  sourceUrl: string
  sourceName?: string
}

interface Opportunity {
  id: string
  title: string
  customer_problem: string | null
  intent_stage: IntentStage | null
  evidence_kind: EvidenceKind
  evidence: EvidenceRow[] | null
  competitors_visible: string[] | null
  recommended_action: string | null
  priority: number
  status: OpportunityStatus
  created_at: string
}

/**
 * The acquisition backlog.
 *
 * One rule carried over from the free report: the card says what kind of claim
 * it is before it says what to do, because "a competitor ranks for this and you
 * do not" and "your site never mentions this" are different strengths of
 * evidence and a marketer about to spend a month on content deserves to know
 * which one they have.
 */
export function OpportunitiesClient({
  brandName, brandWebsite, opportunities: initial,
}: {
  brandName: string
  brandWebsite: string | null
  opportunities: Opportunity[]
}) {
  const claimed = useSearchParams().get('claimed')
  const [rows, setRows] = useState(initial)
  const [showDismissed, setShowDismissed] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)

  const visible = useMemo(
    () => rows.filter(r => showDismissed || r.status !== 'dismissed'),
    [rows, showDismissed],
  )
  const done = rows.filter(r => r.status === 'done').length
  const working = rows.filter(r => r.status === 'planned' || r.status === 'in_progress').length

  async function update(row: Opportunity, patch: { status?: OpportunityStatus; priority?: number }) {
    setSavingId(row.id)
    const before = rows
    setRows(rs => rs.map(r => (r.id === row.id ? { ...r, ...patch } : r)))
    try {
      const res = await fetch('/api/opportunities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, ...patch }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'That did not save.')
    } catch (err) {
      setRows(before)
      toast.error(err instanceof Error ? err.message : 'That did not save.')
    } finally { setSavingId(null) }
  }

  /** A summary a marketer can paste into a team channel or a deck. Plain text
   *  rather than a PDF: it is going into someone else's document. */
  function copySummary() {
    const lines = [
      `${brandName} — customer acquisition opportunities`,
      `Generated from BrandGauge, ${new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      '',
      ...visible.filter(r => r.status !== 'dismissed').map((r, i) => [
        `${i + 1}. ${r.title}  [${EVIDENCE_KIND_LABEL[r.evidence_kind]}, ${STATUS_LABEL[r.status]}]`,
        r.customer_problem ? `   Customer problem: ${r.customer_problem}` : null,
        r.competitors_visible?.length ? `   Visible instead of us: ${r.competitors_visible.join(', ')}` : null,
        r.recommended_action ? `   Action: ${r.recommended_action}` : null,
        r.evidence?.length ? `   Evidence: ${r.evidence.map(e => e.sourceUrl).slice(0, 3).join(' , ')}` : null,
      ].filter(Boolean).join('\n')),
      '',
      'What this does not include: no search volumes, growth rates or traffic estimates. Nothing here estimates revenue impact.',
    ]
    navigator.clipboard.writeText(lines.join('\n'))
      .then(() => toast.success('Summary copied, ready to paste.'))
      .catch(() => toast.error('Your browser would not let us copy that.'))
  }

  if (!rows.length) {
    return (
      <div className="rounded-sm border border-line bg-card px-6 py-12 text-center">
        <MarketIcon className="mx-auto h-6 w-6 text-tx-flare" />
        <p className="mt-4 text-[15px] font-medium text-tx">No opportunities yet</p>
        <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-tx-3">
          Run the free Market Demand Gap Finder on {brandWebsite ? brandWebsite.replace(/^https?:\/\//, '') : 'your website'} and
          everything it finds lands here with its evidence, ready to prioritise.
        </p>
        <Link href="/tools/market-demand"
          className="mt-6 inline-flex items-center gap-2 rounded-sm bg-flare px-5 py-2.5 text-[13.5px] font-bold text-on-hot bg-press">
          Find my market opportunities <ArrowRightIcon className="h-3.5 w-3.5" />
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {claimed === 'market-demand' && (
        <div className="rounded-sm border border-line bg-flare-wash p-4">
          <p className="flex items-center gap-2 text-[14px] font-medium text-tx">
            <CheckIcon className="h-4 w-4 text-pos" /> Your research is here
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-tx-2">
            Every opportunity the free tool found is below, with the evidence it rests on. Mark
            what you are planning and what you have finished, and the list becomes a plan rather
            than a report.
          </p>
        </div>
      )}

      <div data-tour="opportunities-summary" className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-line bg-card px-5 py-4">
        <div className="flex flex-wrap gap-6">
          <Stat label="Open" value={rows.filter(r => r.status === 'identified').length} />
          <Stat label="Being worked" value={working} />
          <Stat label="Done" value={done} />
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-[12.5px] text-tx-3">
            <input type="checkbox" checked={showDismissed} onChange={e => setShowDismissed(e.target.checked)}
              className="accent-[var(--flare)]" />
            Show dismissed
          </label>
          <button type="button" onClick={copySummary}
            className="flex items-center gap-1.5 rounded-sm border border-line px-3 py-1.5 text-[12.5px] font-medium text-tx bg-press">
            <ExportIcon className="h-3.5 w-3.5" /> Copy team summary
          </button>
        </div>
      </div>

      <div data-tour="opportunities-list" className="space-y-4">
        {visible.map(row => (
          <article key={row.id}
            className="rounded-sm border border-line bg-card p-5"
            style={{ opacity: row.status === 'dismissed' ? 0.6 : undefined }}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-num rounded-sm bg-shell px-2 py-0.5 text-[11px] text-tx-2">
                P{row.priority}
              </span>
              <span className="rounded-sm border border-line px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-tx-3"
                title={EVIDENCE_KIND_NOTE[row.evidence_kind]}>
                {EVIDENCE_KIND_LABEL[row.evidence_kind]}
              </span>
              {row.intent_stage && (
                <span className="rounded-sm border border-line px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-tx-3">
                  {INTENT_LABEL[row.intent_stage]}
                </span>
              )}
            </div>

            <h3 className="mt-3 text-[15px] font-medium leading-snug text-tx">{row.title}</h3>

            <p className="mt-2 flex items-start gap-2 text-[12.5px] leading-relaxed text-tx-3">
              <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {EVIDENCE_KIND_NOTE[row.evidence_kind]}
            </p>

            {row.customer_problem && (
              <p className="mt-3 text-[13.5px] leading-relaxed text-tx">
                <span className="font-medium">The customer problem. </span>{row.customer_problem}
              </p>
            )}

            {row.competitors_visible && row.competitors_visible.length > 0 && (
              <p className="mt-2 text-[13px] leading-relaxed text-tx-2">
                Visible here instead of you: {row.competitors_visible.join(', ')}.
              </p>
            )}

            {row.recommended_action && (
              <div className="mt-3 border-l-2 border-flare pl-4">
                <p className="bg-label text-tx-3">What to do</p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-tx">{row.recommended_action}</p>
              </div>
            )}

            {row.evidence && row.evidence.length > 0 && (
              <div className="mt-4 border-t border-line pt-3">
                <p className="bg-label text-tx-3">Evidence</p>
                <ul className="mt-2 space-y-1.5">
                  {row.evidence.slice(0, 5).map((e, i) => (
                    <li key={i}>
                      <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer nofollow"
                        className="inline-flex max-w-full items-center gap-1.5 text-[12px] text-tx-flare underline-offset-2 hover:underline">
                        <ExternalLinkIcon className="h-3 w-3 shrink-0" />
                        <span className="truncate">{e.sourceName ?? e.sourceUrl}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
              <span className="bg-label text-tx-3">Status</span>
              {OPPORTUNITY_STATUS.map(s => (
                <button key={s} type="button" disabled={savingId === row.id || row.status === s}
                  onClick={() => update(row, { status: s })}
                  className="rounded-sm border px-2.5 py-1 text-[12px] font-medium bg-press disabled:opacity-100"
                  style={row.status === s
                    ? { background: 'var(--flare)', color: 'var(--on-hot)', borderColor: 'var(--flare)' }
                    : { borderColor: 'var(--line)', color: 'var(--tx-2)' }}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>

      <p className="text-[12px] leading-relaxed text-tx-3">
        No figure here is a revenue projection. We hold no conversion or margin data for
        {' '}{brandName}, so the order is how strong the evidence is, not how much money each one
        is worth.
      </p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="bg-label text-tx-3">{label}</p>
      <p className="bg-num mt-1 text-[22px] leading-none text-tx">{value}</p>
    </div>
  )
}
