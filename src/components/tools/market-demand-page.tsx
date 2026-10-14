'use client'

import { useEffect, useState } from 'react'
import { MarketingShell } from '@/components/landing/marketing-shell'
import { ToolField, ToolHero, ToolSubmit, HowItReads } from './tool-chrome'
import { PrivacyNote, ReportSkeleton, ResearchProgress, ToolFailure } from './tool-states'
import { ReportView } from './tool-report'
import { trackTool, useToolAnalytics } from './use-tool-analytics'
import type { MarketDemandResult } from '@/lib/tools/market-demand'
import type { CoverageNote } from '@/lib/tools/report'

interface Response {
  token?: string
  runId?: string
  status?: 'complete' | 'failed' | 'insufficient_evidence'
  result?: MarketDemandResult
  failureNote?: string
  coverage?: CoverageNote[]
  error?: string
}

const STEPS = [
  'Reading your website',
  'Working out what you sell and who buys it',
  'Writing the searches your buyers actually run',
  'Looking up who is visible for them',
  'Ranking the gaps we can defend',
]

export function MarketDemandPage() {
  useToolAnalytics({ event: 'free_tool_viewed', toolId: 'market-demand' })

  const [website, setWebsite] = useState('')
  const [market, setMarket] = useState('Nigeria')
  const [category, setCategory] = useState('')
  const [competitor, setCompetitor] = useState('')
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState(0)
  const [res, setRes] = useState<Response | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!busy) return
    const id = setInterval(() => setStep(s => Math.min(s + 1, STEPS.length - 1)), 5200)
    return () => clearInterval(id)
  }, [busy])

  async function run(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setStep(0); setError(null); setRes(null)
    try {
      const r = await fetch('/api/tools/market-demand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website, market,
          productCategory: category || undefined,
          competitorWebsite: competitor || undefined,
        }),
      })
      const data = await r.json() as Response
      if (!r.ok) throw new Error(data.error ?? 'That did not work.')
      setRes(data)
      if (data.status === 'complete') {
        trackTool({ event: 'free_tool_result_viewed', toolId: 'market-demand', runId: data.runId })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.')
    } finally { setBusy(false) }
  }

  const report = res?.status === 'complete' ? res.result?.report : undefined

  return (
    <MarketingShell>
      <ToolHero headline={<>Find the customers your competitors are reaching before you do.</>}>
        Discover overlooked customer needs, competitive visibility gaps and acquisition
        opportunities in your market. We read your website, work out how buyers where you sell
        actually search, and show you who is turning up where you are not.
      </ToolHero>

      <div className="mx-auto max-w-4xl px-6">
        <form onSubmit={run} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <ToolField id="md-site" label="Your website" value={website} onChange={setWebsite}
              placeholder="yourbrand.com" required inputMode="url"
              hint="This is where we learn what you sell." />
            <ToolField id="md-market" label="Market you sell into" value={market} onChange={setMarket}
              placeholder="Nigeria" required
              hint="Nigeria today. Ghana, Kenya and more work too." />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ToolField id="md-cat" label="Product category, if you like" value={category} onChange={setCategory}
              placeholder="Payroll software for SMEs"
              hint="Sharpens the searches we look at." />
            <ToolField id="md-comp" label="A competitor, if you like" value={competitor} onChange={setCompetitor}
              placeholder="competitor.com" inputMode="url"
              hint="Gives us something to compare your coverage against." />
          </div>
          <ToolSubmit busy={busy} busyLabel="Reading your market" label="Find my market opportunities"
            disabled={website.trim().length < 4 || market.trim().length < 2} />
          <PrivacyNote>
            We read your public website and look up public search results. Nothing of yours is
            connected, and we do not ask for an email to show you the report.
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
            <ToolFailure title="That did not run" body={error} />
          </div>
        )}

        {res && res.status !== 'complete' && !busy && (
          <div className="mt-10 space-y-5">
            <ToolFailure
              title={res.status === 'insufficient_evidence' ? 'Nothing we would stand behind' : 'We could not read enough'}
              body={res.failureNote ?? 'We could not establish an acquisition gap we would stand behind.'}
              note="Three invented opportunities would be easy and worth nothing to you."
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

      {report && res?.result && (
        <div className="mt-12">
          {/* What the research understood about the business, shown back before
              the opportunities. If we read it wrong, the reader needs to know
              that before they act on anything below it. */}
          <div className="mx-auto max-w-4xl px-6">
            <div className="rounded-sm border p-6" style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-chip)' }}>
              <p className="bg-label" style={{ color: 'var(--lp-mut)' }}>What we understood about you</p>
              <p className="mt-2.5 text-[14px] font-medium" style={{ color: 'var(--lp-ink)' }}>
                {res.result.business.name} · {res.result.business.category} · {res.result.business.market}
              </p>
              {res.result.business.products.length > 0 && (
                <p className="mt-2 text-[13px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>
                  Sells: {res.result.business.products.join(', ')}
                </p>
              )}
              {res.result.business.customers.length > 0 && (
                <p className="mt-1 text-[13px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>
                  Buyers: {res.result.business.customers.join(', ')}
                </p>
              )}
              {res.result.searched.length > 0 && (
                <>
                  <p className="bg-label mt-5" style={{ color: 'var(--lp-mut)' }}>Searches we looked up</p>
                  <ul className="mt-2 space-y-1 text-[13px]" style={{ color: 'var(--lp-ink)' }}>
                    {res.result.searched.map((s, i) => (
                      <li key={i}>
                        “{s.query}”
                        <span style={{ color: s.youRanked ? 'var(--pos)' : 'var(--tx-flare)' }}>
                          {' '}· {s.youRanked ? 'you appear' : 'you do not appear'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {!res.result.provider && (
                <p className="mt-4 text-[12.5px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>
                  No licensed search data was used on this run, so nothing in this report claims a
                  search volume or a ranking. The gaps below are read off your own pages.
                </p>
              )}
            </div>
          </div>

          <div className="mt-8">
            <ReportView
              report={report}
              toolId="market-demand"
              runToken={res.token ?? null}
              ctaHeadline="Turn these opportunities into an actionable customer acquisition plan."
              ctaBody="BrandGauge imports every opportunity above with its evidence, lets you prioritise them, mark what is planned and what is done, and generate a summary your team can work from. The research comes with you."
              ctaPrimary="Build my acquisition opportunity plan"
            />
          </div>
        </div>
      )}

      {!res && !busy && (
        <HowItReads steps={[
          ['Your site, not a questionnaire', 'We read what you publish about your products, your buyers and the problems you solve. Nothing is inferred from your brand name alone.'],
          ['Searches a real buyer runs', 'Then we write the searches someone in your market would actually type at each stage, in the words they use, and look up the most commercial of them.'],
          ['Gaps, never guessed numbers', 'You get who is visible where you are not. No search volumes, no growth rates, no traffic estimates: no free source has them, and a made-up number is worse than none.'],
        ]} />
      )}

      <div className="pb-24" />
    </MarketingShell>
  )
}
