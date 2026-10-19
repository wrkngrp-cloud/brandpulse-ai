'use client'

import { useEffect, useState } from 'react'
import { MarketingShell } from '@/components/landing/marketing-shell'
import { ToolField, ToolHero, ToolSubmit, HowItReads } from './tool-chrome'
import { PrivacyNote, ReportSkeleton, ResearchProgress, ToolFailure } from './tool-states'
import { ReportView } from './tool-report'
import { trackTool, useToolAnalytics } from './use-tool-analytics'
import type { CompetitorTrackerResult } from '@/lib/tools/competitor-tracker'
import type { CoverageNote } from '@/lib/tools/report'
import type { Withheld } from '@/lib/tools/gate'
import { GateCleared, ResultGate } from './result-gate'

interface Response {
  token?: string
  runId?: string
  status?: 'complete' | 'failed' | 'insufficient_evidence'
  result?: CompetitorTrackerResult
  failureNote?: string
  coverage?: CoverageNote[]
  gated?: boolean
  withheld?: Withheld
  error?: string
}

const STEPS = [
  'Reading their homepage',
  'Looking for pricing and newsroom pages',
  'Searching thirty days of Nigerian business press',
  'Reading your site, for what this means for you',
  'Weighing what actually matters',
]

export function CompetitorTrackerPage() {
  const track = useToolAnalytics({ event: 'free_tool_viewed', toolId: 'competitor-tracker' })

  const [yourWebsite, setYourWebsite] = useState('')
  const [competitorWebsite, setCompetitorWebsite] = useState('')
  const [market, setMarket] = useState('')
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState(0)
  const [res, setRes] = useState<Response | null>(null)
  const [error, setError] = useState<string | null>(null)
  /* The unlocked result arrives from the unlock endpoint rather than being
     revealed client-side: the preview never contained it. */
  const [unlocked, setUnlocked] = useState<CompetitorTrackerResult | null>(null)
  const [unlockedEmail, setUnlockedEmail] = useState<string | undefined>()

  /* The step list is honest about what the server is doing, in the order it
     does it, but it cannot know the exact moment each finishes — one request,
     one response. It advances on a timer calibrated to a typical run and stops
     at the last step rather than looping, so it never claims to be finished
     before the answer arrives. No spinner: the design system bans them, and a
     named list of sources tells the visitor more anyway. */
  useEffect(() => {
    if (!busy) return
    const id = setInterval(() => setStep(s => Math.min(s + 1, STEPS.length - 1)), 4200)
    return () => clearInterval(id)
  }, [busy])

  async function run(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setStep(0); setError(null); setRes(null)
    try {
      const r = await fetch('/api/tools/competitor-tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yourWebsite, competitorWebsite, market: market || undefined }),
      })
      const data = await r.json() as Response
      if (!r.ok) throw new Error(data.error ?? 'That did not work.')
      setRes(data)
      if (data.status === 'complete') {
        trackTool({ event: 'free_tool_result_viewed', toolId: 'competitor-tracker', runId: data.runId })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.')
    } finally {
      setBusy(false)
    }
  }

  const shown = unlocked ?? res?.result
  const report = res?.status === 'complete' ? shown?.report : undefined
  const isGated = Boolean(res?.gated) && !unlocked

  return (
    <MarketingShell>
      <ToolHero headline={<>Your competitors are making moves.<br className="hidden sm:block" /> Know which ones matter.</>}>
        Discover important product launches, pricing changes, partnerships and strategic
        developments you may have missed. We read their own website and thirty days of Nigerian
        business press, and every finding comes with the link it came from. Two addresses.
        Connect nothing.
      </ToolHero>

      <div className="mx-auto max-w-4xl px-6">
        <form onSubmit={run} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <ToolField id="ct-you" label="Your website" value={yourWebsite} onChange={setYourWebsite}
              placeholder="yourbrand.com" required inputMode="url"
              hint="So the brief says what their move means for you." />
            <ToolField id="ct-them" label="Competitor website" value={competitorWebsite} onChange={setCompetitorWebsite}
              placeholder="competitor.com" required inputMode="url"
              hint="One competitor. Start with the one that worries you." />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <ToolField id="ct-market" label="Market, if you like" value={market} onChange={setMarket}
                placeholder="Nigeria" />
            </div>
            <ToolSubmit busy={busy} busyLabel="Reading the sources" label="Analyze a competitor"
              disabled={yourWebsite.trim().length < 4 || competitorWebsite.trim().length < 4} />
          </div>
          <PrivacyNote>
            We fetch two public web pages and a public news feed. Nothing of yours is connected and
            nothing is posted anywhere. We ask for an email after the brief, not before it.
          </PrivacyNote>
        </form>

        {busy && (
          <div className="mt-10 space-y-5">
            <ResearchProgress steps={STEPS} done={step} />
            <ReportSkeleton />
          </div>
        )}

        {error && !busy && (
          <div className="mt-10">
            <ToolFailure title="That did not run" body={error} retry={() => { setError(null) }} />
          </div>
        )}

        {res && res.status !== 'complete' && !busy && (
          <div className="mt-10 space-y-5">
            <ToolFailure
              title={res.status === 'insufficient_evidence' ? 'Nothing we could verify' : 'We could not read enough'}
              body={res.failureNote ?? 'We could not establish enough to brief you honestly.'}
              note="We would rather show you this than invent three developments to fill a page."
            />
            {res.coverage && res.coverage.length > 0 && (
              <div className="rounded-sm border p-6" style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-card)' }}>
                <p className="bg-label" style={{ color: 'var(--lp-mut)' }}>What we tried</p>
                <ul className="mt-3 space-y-1.5 text-[13px]" style={{ color: 'var(--lp-ink)' }}>
                  {res.coverage.map((c, i) => (
                    <li key={i}>
                      {c.read ? '✓' : '—'} {c.source}
                      {c.note && <span style={{ color: 'var(--lp-mut)' }}> — {c.note}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {report && shown && res && (
        <div className="mt-12">
          <ReportView
            report={report}
            toolId="competitor-tracker"
            runToken={res.token ?? null}
            ctaHeadline={`Want to know when ${shown.competitor.name} makes another important move?`}
            ctaBody={`Track their products, pricing, partnerships and public announcements with BrandGauge. ${shown.competitor.name} goes onto a watchlist with everything above saved as the starting baseline, so the next change is the thing you hear about rather than old news.`}
              gated={isGated}
              gate={
                isGated
                  ? <ResultGate
                      toolId="competitor-tracker"
                      runToken={res.token ?? null}
                      withheld={res.withheld ?? { findings: 0, nextAction: true, limitations: true }}
                      onUnlocked={(result, email) => {
                        setUnlocked(result as CompetitorTrackerResult)
                        setUnlockedEmail(email)
                        trackTool({ event: 'free_tool_result_engaged', toolId: 'competitor-tracker', props: { action: 'unlocked' } })
                      }}
                    />
                  : unlocked ? <GateCleared email={unlockedEmail} /> : null
              }
            ctaPrimary="Start monitoring this competitor"
          />
        </div>
      )}

      {!res && !busy && (
        <HowItReads steps={[
          ['Their own words first', 'We read their homepage, and their pricing and newsroom pages when they link to them. A page proves what is true now, so it is never used to claim something changed.'],
          ['Then the press', 'Thirty days across Punch, Vanguard, BusinessDay, Nairametrics, TechCabal, The Cable and five more, plus wider business news. A dated story is what can carry a change.'],
          ['Evidence, or nothing', 'Every development names its source and quotes it. Where we cannot verify a move, the brief says so instead of filling the space.'],
        ]} />
      )}

      <div className="pb-24" />
    </MarketingShell>
  )
}
