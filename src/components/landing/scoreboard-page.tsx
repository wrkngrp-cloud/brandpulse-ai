'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MarketingShell } from './marketing-shell'
import { TickReveal, Tick } from './reading'
import { Crescendo } from '@/components/brand/crescendo'
import { Working } from '@/components/brand/working'
import {
  ArrowRightIcon as ArrowRight, AlertIcon, ExternalLinkIcon, CheckIcon,
} from '@/components/brand/icon'
import type { Scoreboard } from '@/lib/press/scoreboard'

const naira = (n: number) =>
  n >= 1_000_000 ? `₦${(n / 1_000_000).toFixed(1)}m`
  : n >= 1_000   ? `₦${Math.round(n / 1_000)}k`
  : `₦${Math.round(n)}`

const reach = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}m` : `${Math.round(n / 1_000)}k`

const REG_LABEL: Record<string, string> = {
  sanction:      'Sanction',
  investigation: 'Investigation',
  positive:      'Licence or approval',
  notice:        'Regulatory notice',
}

export function ScoreboardPage() {
  const [brand, setBrand] = useState('')
  const [rivals, setRivals] = useState(['', '', ''])
  const [category, setCategory] = useState('')
  const [board, setBoard] = useState<(Scoreboard & { scanId?: string }) | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null); setBoard(null)
    try {
      const res = await fetch('/api/scoreboard/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, competitors: rivals.filter(r => r.trim()), category: category || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'That did not work.')
      setBoard(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.')
    } finally {
      setBusy(false)
    }
  }

  const subject = board?.brands.find(b => b.isSubject)

  return (
    <MarketingShell>
      {/* ── The ask ─────────────────────────────────────────────── */}
      <TickReveal className="mx-auto max-w-4xl px-6 pb-10 pt-36 sm:pt-44">
        <Tick as="p" className="bg-label" style={{ color: 'var(--tx-flare)' }}>Free, no account</Tick>
        <Tick as="div">
          <h1 className="mt-4 max-w-3xl text-4xl font-medium leading-[1.05] tracking-[-0.02em] sm:text-5xl"
            style={{ fontFamily: 'var(--font)', color: 'var(--lp-ink)' }}>
            Who is winning the news in your category?
          </h1>
        </Tick>
        <Tick as="p" className="mt-5 max-w-2xl text-[15px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>
          Thirty days of coverage across Punch, Vanguard, BusinessDay, Nairametrics, TechCabal,
          The Cable and four more, weighted by how many people read each one. You get your share
          of the earned reach in your category, and what it would have cost to buy.
          Type four brand names. Connect nothing.
        </Tick>

        <Tick className="mt-9">
          <form onSubmit={run} className="space-y-4">
            <div>
              <label htmlFor="sb-brand" className="bg-label block" style={{ color: 'var(--lp-mut)' }}>Your brand</label>
              <input id="sb-brand" value={brand} onChange={e => setBrand(e.target.value)} required minLength={2}
                placeholder="Kuda"
                className="mt-2 w-full rounded-sm border px-4 py-3 text-[15px] outline-none focus-visible:ring-2"
                style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-card)', color: 'var(--lp-ink)' }} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {rivals.map((r, i) => (
                <div key={i}>
                  {/* One label shape for all three, so the row stays on one
                      line. The long version wrapped and pushed the first input
                      a line lower than its neighbours. */}
                  <label htmlFor={`sb-rival-${i}`} className="bg-label block" style={{ color: 'var(--lp-mut)' }}>
                    {i === 0 ? 'Who you measure against' : `And`}
                  </label>
                  <input id={`sb-rival-${i}`} value={r}
                    onChange={e => setRivals(v => v.map((x, j) => (j === i ? e.target.value : x)))}
                    placeholder={['Moniepoint', 'OPay', 'PalmPay'][i]}
                    className="mt-2 w-full rounded-sm border px-4 py-3 text-[15px] outline-none focus-visible:ring-2"
                    style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-card)', color: 'var(--lp-ink)' }} />
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label htmlFor="sb-cat" className="bg-label block" style={{ color: 'var(--lp-mut)' }}>Category, if you like</label>
                <input id="sb-cat" value={category} onChange={e => setCategory(e.target.value)}
                  placeholder="Fintech"
                  className="mt-2 w-full rounded-sm border px-4 py-3 text-[15px] outline-none focus-visible:ring-2"
                  style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-card)', color: 'var(--lp-ink)' }} />
              </div>
              <button type="submit" disabled={busy || brand.trim().length < 2}
                className="flex items-center justify-center gap-2 rounded-sm px-7 py-3.5 text-[14px] font-bold text-on-hot bg-press disabled:opacity-50"
                style={{ background: 'var(--flare)' }}>
                {busy ? <><Working className="h-4 w-4" /> Reading the press</> : <>Run the scoreboard <ArrowRight className="h-4 w-4" /></>}
              </button>
            </div>
          </form>
          {error && (
            <p className="mt-4 flex items-center gap-2 text-[13px]" style={{ color: 'var(--neg)' }}>
              <AlertIcon className="h-4 w-4" /> {error}
            </p>
          )}
        </Tick>
      </TickReveal>

      {board && (
        <>
          {/* ── The board, free, before anything is asked for ───── */}
          <section className="mx-auto max-w-4xl px-6 pb-4">
            {!board.feedOk ? (
              /* A feed we could not reach is not a quiet category. Saying
                 "nobody wrote about you" when the truth is "we could not
                 look" is a confident wrong answer, which is worse than an
                 error message. */
              <div className="rounded-sm border p-8" style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-card)' }}>
                <h2 className="text-2xl font-medium tracking-tight" style={{ fontFamily: 'var(--font)', color: 'var(--lp-ink)' }}>
                  We could not reach the news feed.
                </h2>
                <p className="mt-3 max-w-xl text-[14px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>
                  This is us, not you, and it says nothing about your coverage. Give it a minute and
                  run it again.
                </p>
              </div>
            ) : board.empty ? (
              <div className="rounded-sm border p-8" style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-card)' }}>
                <h2 className="text-2xl font-medium tracking-tight" style={{ fontFamily: 'var(--font)', color: 'var(--lp-ink)' }}>
                  Nobody in this set was covered in the last 30 days.
                </h2>
                <p className="mt-3 max-w-xl text-[14px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>
                  Not a bug, and not nothing. A whole category silent across the ten biggest
                  Nigerian outlets for a month means earned media is not where this race is being
                  run, or the names need spelling as the press writes them.
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-sm border p-7 sm:p-9" style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-card)' }}>
                  <p className="bg-label" style={{ color: 'var(--lp-mut)' }}>Your share of earned reach · last {board.days} days</p>
                  <p className="mt-3 bg-num text-6xl font-bold leading-none" style={{ color: 'var(--lp-ink)' }}>
                    {subject?.shareOfReach ?? 0}<span className="text-3xl">%</span>
                  </p>
                  <div className="mt-5 max-w-md"><Crescendo value={subject?.shareOfReach ?? 0} /></div>
                  <p className="mt-5 max-w-xl text-[14px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>
                    {subject?.mentionCount ?? 0} {subject?.mentionCount === 1 ? 'story' : 'stories'} about {subject?.name},
                    reaching about {reach(subject?.totalReach ?? 0)} readers. Bought at Nigerian display
                    rates that is {naira(subject?.totalEmv ?? 0)}.
                  </p>
                </div>

                <div className="mt-4 overflow-x-auto rounded-sm border" style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-card)' }}>
                  <table className="w-full min-w-[34rem] text-left text-[14px]">
                    <thead>
                      <tr style={{ color: 'var(--lp-mut)' }}>
                        <th className="px-5 py-3 font-medium">Brand</th>
                        <th className="px-5 py-3 font-medium">Stories</th>
                        <th className="px-5 py-3 font-medium">Reach</th>
                        <th className="px-5 py-3 font-medium">Earned value</th>
                        <th className="px-5 py-3 font-medium">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...board.brands].sort((a, b) => b.shareOfReach - a.shareOfReach).map(b => (
                        <tr key={b.name} className="border-t" style={{ borderColor: 'var(--lp-line)' }}>
                          <td className="px-5 py-3" style={{ color: 'var(--lp-ink)', fontWeight: b.isSubject ? 700 : 400 }}>
                            {b.name}{b.isSubject && <span className="bg-label ml-2" style={{ color: 'var(--tx-flare)' }}>you</span>}
                          </td>
                          <td className="bg-num px-5 py-3" style={{ color: 'var(--lp-ink)' }}>{b.mentionCount}</td>
                          <td className="bg-num px-5 py-3" style={{ color: 'var(--lp-ink)' }}>{reach(b.totalReach)}</td>
                          <td className="bg-num px-5 py-3" style={{ color: 'var(--lp-ink)' }}>{naira(b.totalEmv)}</td>
                          <td className="bg-num px-5 py-3" style={{ color: 'var(--lp-ink)' }}>{b.shareOfReach}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {board.regulatory.length > 0 && (
                  <div className="mt-4 rounded-sm border p-6" style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-card)' }}>
                    <p className="bg-label" style={{ color: 'var(--tx-flare)' }}>A regulator was named</p>
                    <ul className="mt-3 space-y-2.5">
                      {board.regulatory.map(f => (
                        <li key={f.url} className="text-[13.5px] leading-snug" style={{ color: 'var(--lp-ink)' }}>
                          <span className="bg-label mr-2" style={{ color: 'var(--lp-mut)' }}>{f.entity} · {REG_LABEL[f.kind]}</span>
                          <a href={f.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                            {f.headline}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <details className="mt-4 rounded-sm border p-6" style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-card)' }}>
                  <summary className="cursor-pointer text-[14px] font-medium" style={{ color: 'var(--lp-ink)' }}>
                    Every story we counted
                  </summary>
                  <div className="mt-5 space-y-6">
                    {board.brands.filter(b => b.mentionCount > 0).map(b => (
                      <div key={b.name}>
                        <p className="bg-label" style={{ color: 'var(--tx-flare)' }}>{b.name}</p>
                        <ul className="mt-2 space-y-1.5">
                          {b.mentions.map(m => (
                            <li key={m.url} className="text-[13px] leading-snug" style={{ color: 'var(--lp-mut)' }}>
                              <a href={m.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1.5 hover:underline">
                                <span style={{ color: 'var(--lp-ink)' }}>{m.headline}</span>
                                <ExternalLinkIcon className="mt-0.5 h-3 w-3 shrink-0" />
                              </a>
                              <span className="ml-1.5 bg-label">{m.publication} · {m.publishedAt}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <p className="mt-6 text-[11px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>
                    Readership figures are practitioner estimates, not audited circulation. No public
                    Nigerian circulation dataset exists. They rank the outlets correctly, which is what
                    a share is made of. Earned value applies a ₦500 CPM to that readership.
                  </p>
                </details>
              </>
            )}
          </section>

          {/* No board, no ask. Offering to watch this every Monday off a read
              that failed is a promise made on nothing. */}
          {board.feedOk && <GapAndCapture board={board} />}
        </>
      )}

      {!board && <HowItWorks />}
    </MarketingShell>
  )
}

/**
 * What the board cannot see, and the two ways forward.
 *
 * The order matters. The result is already on the screen and paid for.
 * What follows names the edge of what press alone can tell you, which is
 * honest and is also the whole product pitch, and only then asks for
 * anything. The cheaper ask comes first.
 */
function GapAndCapture({ board }: { board: Scoreboard & { scanId?: string } }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [weekly, setWeekly] = useState(true)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      const res = await fetch('/api/scoreboard/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name: name || undefined, company: company || undefined, scanId: board.scanId, wantsWeekly: weekly }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'That did not save.')
      setSent(true)
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'That did not save.')
    } finally { setBusy(false) }
  }

  return (
    <section className="mx-auto max-w-4xl px-6 py-16">
      <h2 className="max-w-2xl text-2xl font-medium tracking-tight sm:text-3xl"
        style={{ fontFamily: 'var(--font)', color: 'var(--lp-ink)' }}>
        This is the press. It is not the whole picture.
      </h2>
      <p className="mt-4 max-w-2xl text-[14px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>
        Thirty days of ten outlets tells you who the newsroom is writing about. It cannot tell you
        what people are saying on X and Instagram in Pidgin, Yoruba, Igbo and Hausa, whether ChatGPT
        names you when someone asks for the best in your category, what your billboards and radio
        actually returned, or where you sit on one index your MD can read. That is the product.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-sm border p-6" style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-card)' }}>
          {sent ? (
            <div>
              <p className="flex items-center gap-2 text-[15px] font-medium" style={{ color: 'var(--lp-ink)' }}>
                <CheckIcon className="h-4 w-4" style={{ color: 'var(--pos)' }} /> Done.
              </p>
              <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>
                {weekly
                  ? 'We will run this again every Monday and write to you when the share moves.'
                  : 'We have your address and will not use it for anything you did not ask for.'}
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <p className="text-[15px] font-medium" style={{ color: 'var(--lp-ink)' }}>Watch this every Monday</p>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>
                We re-run the same four brands each week and write to you when your share moves.
              </p>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@brand.com" aria-label="Work email"
                className="w-full rounded-sm border px-3.5 py-2.5 text-[14px] outline-none focus-visible:ring-2"
                style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-bg)', color: 'var(--lp-ink)' }} />
              <div className="grid gap-3 sm:grid-cols-2">
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" aria-label="Your name"
                  className="w-full rounded-sm border px-3.5 py-2.5 text-[14px] outline-none focus-visible:ring-2"
                  style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-bg)', color: 'var(--lp-ink)' }} />
                <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Company" aria-label="Company"
                  className="w-full rounded-sm border px-3.5 py-2.5 text-[14px] outline-none focus-visible:ring-2"
                  style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-bg)', color: 'var(--lp-ink)' }} />
              </div>
              <label className="flex items-start gap-2 text-[12.5px]" style={{ color: 'var(--lp-mut)' }}>
                <input type="checkbox" checked={weekly} onChange={e => setWeekly(e.target.checked)} className="mt-0.5 accent-[var(--flare)]" />
                Send me the Monday email. Nothing else.
              </label>
              <button type="submit" disabled={busy}
                className="w-full rounded-sm border px-4 py-2.5 text-[13.5px] font-bold bg-press disabled:opacity-50"
                style={{ borderColor: 'var(--lp-line)', color: 'var(--lp-ink)' }}>
                {busy ? 'Saving' : 'Send it to me'}
              </button>
              {err && <p className="text-[12.5px]" style={{ color: 'var(--neg)' }}>{err}</p>}
            </form>
          )}
        </div>

        <div className="flex flex-col justify-between rounded-sm border p-6" style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-card)' }}>
          <div>
            <p className="text-[15px] font-medium" style={{ color: 'var(--lp-ink)' }}>See the rest of it</p>
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>
              Put {board.brands.find(b => b.isSubject)?.name ?? 'your brand'} on the index. Sentiment in four
              languages, share of voice, the AI answer layer, offline attribution and a monthly report
              written for your MD. Free while we are in beta.
            </p>
          </div>
          <Link href="/auth/signup"
            className="mt-5 flex items-center justify-center gap-2 rounded-sm px-6 py-3 text-[14px] font-bold text-on-hot bg-press"
            style={{ background: 'var(--flare)' }}>
            Start free in beta <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  const steps = [
    ['01', 'Ten newsrooms', 'Punch, Vanguard, The Guardian, BusinessDay, The Cable, Premium Times, Nairametrics, TechCabal, Techpoint and Daily Trust.'],
    ['02', 'Weighted, not counted', 'A story in Punch is not a story in Techpoint. Each outlet carries its own readership, so the share reflects who was actually reached.'],
    ['03', 'Priced in Naira', 'That readership at a ₦500 CPM, which is what the coverage would have cost to buy. Earned media, in the currency of a budget meeting.'],
  ]
  return (
    <TickReveal className="mx-auto max-w-4xl px-6 pb-24">
      <Tick as="p" className="bg-label" style={{ color: 'var(--lp-mut)' }}>How it reads</Tick>
      <div className="mt-6 space-y-5">
        {steps.map(([n, title, body]) => (
          <Tick key={n} className="flex gap-5 border-t pt-5" style={{ borderColor: 'var(--lp-line)' }}>
            <span className="bg-num text-[13px]" style={{ color: 'var(--tx-flare)' }}>{n}</span>
            <div>
              <p className="text-[15px] font-medium" style={{ color: 'var(--lp-ink)' }}>{title}</p>
              <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>{body}</p>
            </div>
          </Tick>
        ))}
      </div>
    </TickReveal>
  )
}
