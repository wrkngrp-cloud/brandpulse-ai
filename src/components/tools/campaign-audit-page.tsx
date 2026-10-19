'use client'

import { useEffect, useState } from 'react'
import { MarketingShell } from '@/components/landing/marketing-shell'
import { ToolField, ToolHero, ToolSelect, ToolSubmit, HowItReads } from './tool-chrome'
import { PrivacyNote, ReportSkeleton, ResearchProgress, ToolFailure } from './tool-states'
import { ReportView } from './tool-report'
import { trackTool, useToolAnalytics } from './use-tool-analytics'
import { CAMPAIGN_OBJECTIVES, OBJECTIVE_LABEL, type CampaignObjective } from '@/lib/tools/audit-vocab'
import type { CampaignAuditResult } from '@/lib/tools/campaign-audit'
import type { CoverageNote } from '@/lib/tools/report'
import type { Withheld } from '@/lib/tools/gate'
import { GateCleared, ResultGate } from './result-gate'

interface Response {
  token?: string
  runId?: string
  status?: 'complete' | 'failed' | 'insufficient_evidence'
  result?: CampaignAuditResult
  failureNote?: string
  coverage?: CoverageNote[]
  gated?: boolean
  withheld?: Withheld
  error?: string
}

const STEPS = [
  'Loading the page the way a phone would',
  'Measuring mobile performance with PageSpeed Insights',
  'Checking the call to action and its destination',
  'Reading the page for clarity and friction',
  'Ordering what matters before you spend more',
]

export function CampaignAuditPage() {
  useToolAnalytics({ event: 'free_tool_viewed', toolId: 'campaign-audit' })

  const [pageUrl, setPageUrl] = useState('')
  const [objective, setObjective] = useState<CampaignObjective | ''>('')
  const [market, setMarket] = useState('Nigeria')
  const [competitor, setCompetitor] = useState('')
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState(0)
  const [res, setRes] = useState<Response | null>(null)
  const [error, setError] = useState<string | null>(null)
  /* The unlocked result arrives from the unlock endpoint rather than being
     revealed client-side: the preview never contained it. */
  const [unlocked, setUnlocked] = useState<CampaignAuditResult | null>(null)
  const [unlockedEmail, setUnlockedEmail] = useState<string | undefined>()

  useEffect(() => {
    if (!busy) return
    // PageSpeed is the long step, so the list pauses there rather than
    // marching on and implying the audit is nearly done.
    const id = setInterval(() => setStep(s => Math.min(s + 1, STEPS.length - 1)), 11_000)
    return () => clearInterval(id)
  }, [busy])

  async function run(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setStep(0); setError(null); setRes(null)
    try {
      const r = await fetch('/api/tools/campaign-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageUrl,
          objective: objective || undefined,
          market: market || undefined,
          competitorUrl: competitor || undefined,
        }),
      })
      const data = await r.json() as Response
      if (!r.ok) throw new Error(data.error ?? 'That did not work.')
      setRes(data)
      if (data.status === 'complete') {
        trackTool({ event: 'free_tool_result_viewed', toolId: 'campaign-audit', runId: data.runId })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.')
    } finally { setBusy(false) }
  }

  const shown = unlocked ?? res?.result
  const report = res?.status === 'complete' ? shown?.report : undefined
  const isGated = Boolean(res?.gated) && !unlocked
  const perf = shown?.performance

  return (
    <MarketingShell>
      <ToolHero headline={<>Before you spend more on ads, check where your landing page could lose customers.</>}>
        Find mobile performance issues, broken customer journeys, unclear offers and conversion
        friction before scaling your campaign. We load the page, measure it on a phone, test the
        call to action, and read the copy the way a first-time visitor would.
      </ToolHero>

      <div className="mx-auto max-w-4xl px-6">
        <form onSubmit={run} className="space-y-4">
          <ToolField id="ca-url" label="Your landing page" value={pageUrl} onChange={setPageUrl}
            placeholder="yourbrand.com/offer" required inputMode="url"
            hint="The exact address your ads point at, including any path." />
          <div className="grid gap-3 sm:grid-cols-3">
            <ToolSelect id="ca-obj" label="What the campaign is buying" value={objective}
              onChange={v => setObjective(v as CampaignObjective | '')}
              options={[
                { value: '', label: 'Not sure yet' },
                ...CAMPAIGN_OBJECTIVES.map(o => ({ value: o, label: OBJECTIVE_LABEL[o] })),
              ]} />
            <ToolField id="ca-market" label="Market" value={market} onChange={setMarket} placeholder="Nigeria" />
            <ToolField id="ca-comp" label="A competitor page, if you like" value={competitor}
              onChange={setCompetitor} placeholder="competitor.com/offer" inputMode="url" />
          </div>
          <ToolSubmit busy={busy} busyLabel="Auditing the page" label="Audit my landing page"
            disabled={pageUrl.trim().length < 4} />
          <PrivacyNote>
            We load your page the way a visitor would and measure it. We never submit a form, and
            never follow a link that looks like it would place an order, take a payment or cancel
            anything. No account, and no email asked for.
          </PrivacyNote>
        </form>

        {busy && (
          <div className="mt-10 space-y-5">
            <ResearchProgress steps={STEPS} done={step} />
            <p className="text-[12.5px]" style={{ color: 'var(--lp-mut)' }}>
              The performance measurement is a real Lighthouse run on an emulated phone, so this
              part takes most of a minute. Worth the wait.
            </p>
            <ReportSkeleton />
          </div>
        )}

        {error && !busy && <div className="mt-10"><ToolFailure title="That did not run" body={error} /></div>}

        {res && res.status === 'failed' && !busy && (
          <div className="mt-10">
            <ToolFailure title="We could not load that page"
              body={res.failureNote ?? 'The page did not answer.'}
              note="If your ads point at this address, that is worth knowing on its own." />
          </div>
        )}
      </div>

      {report && shown && res && (
        <div className="mt-12">
          {/* Measured numbers, above the findings and clearly separated from
              the model's reading of the copy. */}
          {perf && (
            <div className="mx-auto max-w-4xl px-6">
              <div className="rounded-sm border p-6" style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-chip)' }}>
                <p className="bg-label" style={{ color: 'var(--lp-mut)' }}>
                  Measured on mobile · {perf.fieldAvailable ? 'real visitors, last 28 days' : 'one emulated mid-range Android'}
                </p>
                <div className="mt-4 flex flex-wrap gap-x-10 gap-y-4">
                  {perf.performanceScore !== null && (
                    <Metric label="Performance" value={String(perf.performanceScore)}
                      tone={perf.performanceScore >= 90 ? 'good' : perf.performanceScore >= 50 ? 'mid' : 'bad'} />
                  )}
                  {perf.accessibilityScore !== null && (
                    <Metric label="Accessibility" value={String(perf.accessibilityScore)}
                      tone={perf.accessibilityScore >= 90 ? 'good' : perf.accessibilityScore >= 50 ? 'mid' : 'bad'} />
                  )}
                  {(perf.fieldAvailable ? perf.field : perf.lab).slice(0, 4).map(m => (
                    <Metric key={m.label} label={m.label} value={m.display}
                      tone={m.rating === 'good' ? 'good' : m.rating === 'poor' ? 'bad' : 'mid'} />
                  ))}
                </div>
                {!perf.fieldAvailable && (
                  <p className="mt-4 text-[12px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>
                    This page does not have enough traffic for Chrome&apos;s real-user dataset, so these
                    are one emulated run. Treat them as directional.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="mt-8">
            <ReportView
              report={report}
              toolId="campaign-audit"
              runToken={res.token ?? null}
              ctaHeadline="Turn these findings into an improvement plan, and verify your fixes."
              ctaBody="In BrandGauge every finding becomes a task with a status, your audit history is kept, and re-running the audit shows what you actually fixed. Compare the page against a competitor's, and keep the before and after."
              gated={isGated}
              gate={
                isGated
                  ? <ResultGate
                      toolId="campaign-audit"
                      runToken={res.token ?? null}
                      withheld={res.withheld ?? { findings: 0, nextAction: true, limitations: true }}
                      onUnlocked={result => {
                        setUnlocked(result as CampaignAuditResult)
                        trackTool({ event: 'free_tool_result_engaged', toolId: 'campaign-audit', props: { action: 'unlocked' } })
                      }}
                    />
                  : unlocked ? <GateCleared email={unlockedEmail} /> : null
              }
              ctaPrimary="Build my campaign improvement plan"
            />
          </div>
        </div>
      )}

      {!res && !busy && (
        <HowItReads steps={[
          ['Measured first', 'Mobile performance from PageSpeed Insights, failing accessibility checks, viewport, form length, redirects, page weight, and whether your main call to action still loads.'],
          ['Then read, and labelled as read', 'A model reads the copy for whether the offer, the audience and the next step are clear. That is a judgement about the page, never a measurement of how customers behaved, and the report says so on every card.'],
          ['No score, no invented money', 'There is no number out of a hundred, because we have no conversion data to calibrate one. And nothing here estimates lost revenue, because that needs your margins.'],
        ]} />
      )}

      <div className="pb-24" />
    </MarketingShell>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'good' | 'mid' | 'bad' }) {
  const color = tone === 'good' ? 'var(--pos)' : tone === 'bad' ? 'var(--tx-flare)' : 'var(--lp-ink)'
  return (
    <div>
      <p className="bg-label" style={{ color: 'var(--lp-mut)' }}>{label}</p>
      <p className="bg-num mt-1 text-[22px] leading-none" style={{ color }}>{value}</p>
    </div>
  )
}
