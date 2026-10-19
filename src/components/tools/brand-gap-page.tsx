'use client'

import { useEffect, useState } from 'react'
import { MarketingShell } from '@/components/landing/marketing-shell'
import { ToolField, ToolHero, ToolSubmit, HowItReads } from './tool-chrome'
import { PrivacyNote, ReportSkeleton, ResearchProgress, ToolFailure } from './tool-states'
import { ReportView } from './tool-report'
import { trackTool, useToolAnalytics } from './use-tool-analytics'
import type { BrandGapResult } from '@/lib/tools/brand-gap'
import type { CoverageNote } from '@/lib/tools/report'
import type { Withheld } from '@/lib/tools/gate'
import { GateCleared, ResultGate } from './result-gate'

interface Response {
  token?: string
  runId?: string
  status?: 'complete' | 'failed' | 'insufficient_evidence'
  reason?: 'bad_url' | 'site_unreadable' | 'nothing_stated' | 'no_description'
  result?: BrandGapResult
  failureNote?: string
  coverage?: CoverageNote[]
  gated?: boolean
  withheld?: Withheld
  error?: string
}

const STEPS = [
  'Reading your homepage',
  'Looking for your about and values pages',
  'Writing down what you say about yourselves',
  'Reading the Nigerian press for how you get described',
  'Asking an AI assistant what it says about you',
  'Measuring the distance between the two',
]

/* The refusals that are findings get their own heading, because "nothing
   describes you yet" is a real answer to this question and calling it a
   failure would be both wrong and discouraging. */
const FAILURE_TITLE: Record<string, string> = {
  nothing_stated: 'You have not said who you are',
  no_description: 'Nothing out there is describing you yet',
}

export function BrandGapPage() {
  useToolAnalytics({ event: 'free_tool_viewed', toolId: 'brand-gap' })

  const [brandName, setBrandName] = useState('')
  const [website, setWebsite] = useState('')
  const [market, setMarket] = useState('')
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState(0)
  const [res, setRes] = useState<Response | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [unlocked, setUnlocked] = useState<BrandGapResult | null>(null)
  const [unlockedEmail, setUnlockedEmail] = useState<string | undefined>()

  // Advances on a timer, stops at the last step, never loops and never
  // claims to be finished early. No spinner anywhere.
  useEffect(() => {
    if (!busy) return
    const id = setInterval(() => setStep(s => Math.min(s + 1, STEPS.length - 1)), 5200)
    return () => clearInterval(id)
  }, [busy])

  async function run(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setStep(0); setError(null); setRes(null); setUnlocked(null)
    try {
      const r = await fetch('/api/tools/brand-gap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandName, website, market: market || undefined }),
      })
      const data = await r.json() as Response
      if (!r.ok) throw new Error(data.error ?? 'That did not work.')
      setRes(data)
      if (data.status === 'complete') {
        trackTool({ event: 'free_tool_result_viewed', toolId: 'brand-gap', runId: data.runId })
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
      <ToolHero headline={<>You know who you say you are.<br className="hidden sm:block" /> This is who the market says you are.</>}>
        We read the positioning on your own website, then read how the Nigerian press and an AI
        assistant actually describe you, and name the distance between the two. The values nobody
        repeats back, and the reputation you never claim. Your brand name and your website.
        Connect nothing.
      </ToolHero>

      <div className="mx-auto max-w-4xl px-6">
        <form onSubmit={run} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <ToolField id="bg-name" label="Your brand name" value={brandName} onChange={setBrandName}
              placeholder="Jara Foods" required
              hint="Exactly as the press would write it." />
            <ToolField id="bg-site" label="Your website" value={website} onChange={setWebsite}
              placeholder="yourbrand.com" required inputMode="url"
              hint="Where you say who you are, in your own words." />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <ToolField id="bg-market" label="Market, if you like" value={market} onChange={setMarket}
                placeholder="Nigeria" />
            </div>
            <ToolSubmit busy={busy} busyLabel="Reading both sides" label="Find my perception gap"
              disabled={brandName.trim().length < 2 || website.trim().length < 4} />
          </div>
          <PrivacyNote>
            We fetch your public pages, a public news feed, and one answer from an AI assistant
            about your brand. Nothing of yours is connected and nothing is posted anywhere. We
            ask for an email after the reading, not before it.
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
              title={FAILURE_TITLE[res.reason ?? ''] ?? 'We could not read enough'}
              body={res.failureNote ?? 'We could not establish enough to tell you anything honestly.'}
              note="We would rather show you this than name a gap we cannot evidence."
            />
            {res.coverage && res.coverage.length > 0 && (
              <div className="rounded-sm border p-6" style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-card)' }}>
                <p className="bg-label" style={{ color: 'var(--lp-mut)' }}>What we read</p>
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
          <div className="mx-auto max-w-4xl px-6">
            <TwoSides result={shown} />
          </div>
          <ReportView
            report={report}
            toolId="brand-gap"
            runToken={res.token ?? null}
            ctaHeadline={`Want to watch this gap close?`}
            ctaBody={`BrandGauge tracks how ${shown.brand.name} is described against how you position it, month after month, and puts both next to your brand health score. Your profile above comes with you, so there is nothing to type again.`}
            gated={isGated}
            gate={
              isGated
                ? <ResultGate
                    toolId="brand-gap"
                    runToken={res.token ?? null}
                    withheld={res.withheld ?? { findings: 0, nextAction: true, limitations: true }}
                    onUnlocked={(result, email) => {
                      setUnlocked(result as BrandGapResult)
                      setUnlockedEmail(email)
                      trackTool({ event: 'free_tool_result_engaged', toolId: 'brand-gap', props: { action: 'unlocked' } })
                    }}
                  />
                : unlocked ? <GateCleared email={unlockedEmail} /> : null
            }
            ctaPrimary="Track my brand perception"
          />
        </div>
      )}

      {!res && !busy && (
        <HowItReads steps={[
          ['Your own words first', 'We read your homepage, and your about and values pages when they link to them. Every line we write down carries a sentence copied from your page, and anything we cannot copy is left out.'],
          ['Then everybody else', 'Thirty days across Punch, Vanguard, BusinessDay, Nairametrics, TechCabal, The Cable and five more, plus what an AI assistant answers when a buyer asks about you.'],
          ['The gap, not the profile', 'You already know your positioning. What you cannot see from inside is which parts of it come back to you, which parts nobody repeats, and what the market calls you that you never say.'],
        ]} />
      )}

      <div className="pb-24" />
    </MarketingShell>
  )
}

/**
 * The two identities, side by side, above the findings.
 *
 * This is the one piece of chrome this tool has that the others do not, and
 * it earns its place: the gap below only reads as a gap if both sides are
 * visible first. Stated is sourced to their own pages, described to outside
 * sources, and the two columns are never blended into one profile.
 */
function TwoSides({ result }: { result: BrandGapResult }) {
  const { stated, described } = result
  const saidItems = [
    stated.audience ? `For ${stated.audience}` : null,
    stated.promise,
    ...stated.values.map(v => v.label),
  ].filter((v): v is string => Boolean(v)).slice(0, 5)

  const heardItems = described.traits.map(t => t.attribute).slice(0, 5)

  return (
    <section className="border-t pt-10" style={{ borderColor: 'var(--lp-line)' }}>
      <p className="bg-label" style={{ color: 'var(--lp-mut)' }}>The two readings</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Column
          label="What you say"
          note="From your own pages, each line quoted."
          items={saidItems}
          empty="Your pages do not state a position we could quote."
        />
        <Column
          label="What the market says"
          note={`From ${described.pressCount} press ${described.pressCount === 1 ? 'story' : 'stories'}${described.assistantsAsked ? ' and what an AI assistant answers' : ''}.`}
          items={heardItems}
          empty="Nothing outside described you in terms we could record."
        />
      </div>
    </section>
  )
}

function Column({ label, note, items, empty }: { label: string; note: string; items: string[]; empty: string }) {
  return (
    <div className="rounded-sm border p-6" style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-card)' }}>
      <p className="text-[14px] font-medium" style={{ color: 'var(--lp-ink)' }}>{label}</p>
      <p className="mt-1 text-[12px]" style={{ color: 'var(--lp-mut)' }}>{note}</p>
      {items.length ? (
        <ul className="mt-4 space-y-2">
          {items.map((item, i) => (
            <li key={i} className="border-t pt-2 text-[13.5px] leading-relaxed first:border-t-0 first:pt-0"
              style={{ borderColor: 'var(--lp-line)', color: 'var(--lp-ink)' }}>
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-[13px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>{empty}</p>
      )}
    </div>
  )
}
