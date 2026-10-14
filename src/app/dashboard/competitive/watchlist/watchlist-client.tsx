'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  AlertIcon, ArrowRightIcon, CheckIcon, ExportIcon, ExternalLinkIcon,
  PlusIcon, RefreshIcon, AskIcon,
} from '@/components/brand/icon'
import { Working } from '@/components/brand/working'
import { MOVE_LABEL, MOVE_SOURCE_LABEL, WATCH_LIMIT, type MoveCategory, type MoveSourceKind } from '@/lib/tools/moves'

interface Watch {
  id: string
  competitor_name: string
  website_url: string
  market: string | null
  enabled: boolean
  last_checked_at: string | null
  created_at: string
}

interface Move {
  id: string
  competitor_name: string
  category: MoveCategory
  headline: string
  significance: string | null
  implication: string | null
  source_url: string
  source_kind: MoveSourceKind
  quote: string | null
  published_at: string | null
  discovered_at: string
  confidence: 'high' | 'medium' | 'low'
  is_baseline: boolean
}

/**
 * The watchlist screen.
 *
 * Three things it has to keep straight, because the credibility of a
 * monitoring product is exactly this:
 *
 *   a baseline row was already true when the watch started, so it is marked
 *   as such and never dressed up as news;
 *
 *   a detected website change says the page moved, not what moved, and the
 *   card says so in those words;
 *
 *   the reading of what a move means is generated on request and labelled as
 *   an AI reading, never shown as part of the source.
 */
export function WatchlistClient({
  brandName, brandWebsite, watches: initialWatches, moves: initialMoves,
}: {
  brandName: string
  brandWebsite: string | null
  watches: Watch[]
  moves: Move[]
}) {
  const claimed = useSearchParams().get('claimed')
  const [watches, setWatches] = useState(initialWatches)
  const [moves, setMoves] = useState(initialMoves)
  const [filter, setFilter] = useState<string>('all')
  const [adding, setAdding] = useState(false)
  const [newSite, setNewSite] = useState('')
  const [busy, setBusy] = useState(false)
  const [checkingId, setCheckingId] = useState<string | null>(null)
  const [readingId, setReadingId] = useState<string | null>(null)

  const shown = useMemo(
    () => (filter === 'all' ? moves : moves.filter(m => m.competitor_name === filter)),
    [moves, filter],
  )
  const newMoves = shown.filter(m => !m.is_baseline)
  const baseline = shown.filter(m => m.is_baseline)

  async function addWatch(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await fetch('/api/competitive/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitorWebsite: newSite }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'That did not save.')
      toast.success(`${data.name} is on the watchlist with ${data.baselineMoves} moves as the baseline.`)
      setNewSite(''); setAdding(false)
      // The baseline rows and the watch row both come from the server, so the
      // page is refetched rather than guessed at.
      window.location.reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'That did not save.')
    } finally { setBusy(false) }
  }

  async function toggle(watch: Watch) {
    const next = !watch.enabled
    setWatches(ws => ws.map(w => (w.id === watch.id ? { ...w, enabled: next } : w)))
    const res = await fetch('/api/competitive/watchlist', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ watchId: watch.id, enabled: next }),
    })
    if (!res.ok) {
      setWatches(ws => ws.map(w => (w.id === watch.id ? { ...w, enabled: !next } : w)))
      toast.error('That did not save.')
    }
  }

  async function checkNow(watch: Watch) {
    setCheckingId(watch.id)
    try {
      const res = await fetch('/api/competitive/watchlist/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watchId: watch.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'That check did not run.')
      const found = (data.newMoves ?? 0) + (data.siteChanges ?? 0)
      if (found === 0) {
        toast.success(`Nothing new for ${watch.competitor_name}. ${data.alreadyKnown ?? 0} we already had.`)
      } else {
        toast.success(`${found} new for ${watch.competitor_name}. Reloading the timeline.`)
        window.location.reload()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'That check did not run.')
    } finally { setCheckingId(null) }
  }

  async function readImplication(move: Move) {
    setReadingId(move.id)
    try {
      const res = await fetch('/api/competitive/watchlist/implication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moveId: move.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'That did not read.')
      setMoves(ms => ms.map(m => (m.id === move.id
        ? { ...m, significance: data.significance, implication: data.implication }
        : m)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'That did not read.')
    } finally { setReadingId(null) }
  }

  /** CSV, because the thing a marketer does with this is paste it into a deck
   *  or a tracker. Built in the browser: the rows are already here. */
  function exportCsv() {
    const header = ['Competitor', 'Category', 'Headline', 'Source kind', 'Source URL', 'Published', 'Confidence', 'Baseline', 'Why it matters', 'What to consider']
    const esc = (v: string | null) => `"${(v ?? '').replace(/"/g, '""')}"`
    const body = shown.map(m => [
      m.competitor_name, MOVE_LABEL[m.category] ?? m.category, m.headline,
      MOVE_SOURCE_LABEL[m.source_kind], m.source_url, m.published_at ?? '',
      m.confidence, m.is_baseline ? 'yes' : 'no', m.significance, m.implication,
    ].map(esc).join(','))
    const csv = [header.join(','), ...body].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `competitor-moves-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {claimed === 'competitor-tracker' && (
        <div className="rounded-sm border border-line bg-flare-wash p-4" data-tour="watchlist-claimed">
          <p className="flex items-center gap-2 text-[14px] font-medium text-tx">
            <CheckIcon className="h-4 w-4 text-pos" /> Your free brief is here
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-tx-2">
            Everything the tool found is in the timeline below, marked as the baseline because it
            was already true when you started watching. From Monday, only what is new reaches you.
          </p>
        </div>
      )}

      {/* ── The watchlist ──────────────────────────────────────────── */}
      <section data-tour="watchlist-competitors" className="rounded-sm border border-line bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-[15px] font-medium text-tx">Watching</h2>
            <p className="mt-0.5 text-[12.5px] text-tx-3">
              {watches.length} of {WATCH_LIMIT} while we are in beta. We read their site and the press every Monday.
            </p>
          </div>
          <button type="button" onClick={() => setAdding(a => !a)}
            className="flex items-center gap-1.5 rounded-sm border border-line px-3.5 py-2 text-[13px] font-medium text-tx bg-press">
            <PlusIcon className="h-3.5 w-3.5" /> Add a competitor
          </button>
        </div>

        {adding && (
          <form onSubmit={addWatch} className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="wl-site" className="bg-label block text-tx-3">Competitor website</label>
              <input id="wl-site" value={newSite} onChange={e => setNewSite(e.target.value)} required
                placeholder="competitor.com" inputMode="url" autoCapitalize="none" spellCheck={false}
                className="mt-2 w-full rounded-sm border border-line bg-paper px-3.5 py-2.5 text-[14px] text-tx outline-none focus-visible:ring-2" />
              <p className="mt-1.5 text-[12px] text-tx-3">
                We read it now and keep what we find as the baseline, so your first alert is
                something that actually changed.
              </p>
            </div>
            <button type="submit" disabled={busy || newSite.trim().length < 4}
              className="flex items-center justify-center gap-2 rounded-sm px-5 py-2.5 text-[13.5px] font-bold text-on-hot bg-flare bg-press disabled:opacity-50">
              {busy ? <><Working className="h-4 w-4" /> Reading</> : <>Start watching <ArrowRightIcon className="h-3.5 w-3.5" /></>}
            </button>
          </form>
        )}

        {watches.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-[14px] font-medium text-tx">Nobody on the list yet</p>
            <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-tx-3">
              Add the competitor that worries you most. We read their website and thirty days of
              Nigerian business press, keep that as the starting point, and tell you what changes.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {watches.map(w => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-tx">{w.competitor_name}</p>
                  <p className="mt-0.5 truncate text-[12.5px] text-tx-3">
                    {w.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    {w.last_checked_at && ` · checked ${new Date(w.last_checked_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}`}
                    {!w.enabled && ' · paused'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => checkNow(w)} disabled={checkingId === w.id}
                    className="flex items-center gap-1.5 rounded-sm border border-line px-3 py-1.5 text-[12.5px] font-medium text-tx bg-press disabled:opacity-50">
                    {checkingId === w.id ? <Working className="h-3.5 w-3.5" /> : <RefreshIcon className="h-3.5 w-3.5" />}
                    Check now
                  </button>
                  <button type="button" onClick={() => toggle(w)}
                    className="rounded-sm border border-line px-3 py-1.5 text-[12.5px] font-medium text-tx-2 bg-press">
                    {w.enabled ? 'Pause' : 'Resume'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── The timeline ───────────────────────────────────────────── */}
      <section data-tour="watchlist-timeline" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-medium text-tx">Public intelligence timeline</h2>
            <p className="mt-0.5 text-[12.5px] text-tx-3">
              {newMoves.length} since you started watching, {baseline.length} in the baseline.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {watches.length > 1 && (
              <select value={filter} onChange={e => setFilter(e.target.value)}
                className="rounded-sm border border-line bg-card px-3 py-1.5 text-[12.5px] text-tx">
                <option value="all">Everyone</option>
                {watches.map(w => <option key={w.id} value={w.competitor_name}>{w.competitor_name}</option>)}
              </select>
            )}
            {shown.length > 0 && (
              <button type="button" onClick={exportCsv}
                className="flex items-center gap-1.5 rounded-sm border border-line px-3 py-1.5 text-[12.5px] font-medium text-tx bg-press">
                <ExportIcon className="h-3.5 w-3.5" /> Export
              </button>
            )}
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="rounded-sm border border-line bg-card px-5 py-10 text-center">
            <p className="text-[14px] font-medium text-tx">Nothing on the timeline yet</p>
            <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-tx-3">
              Add a competitor above, or run a check now. An empty timeline means we have found
              nothing public, which is better news than a timeline we filled to look busy.
            </p>
          </div>
        ) : (
          <>
            {newMoves.length > 0 && (
              <div className="space-y-3">
                {newMoves.map(m => (
                  <MoveCard key={m.id} move={m} brandName={brandName}
                    reading={readingId === m.id} onRead={() => readImplication(m)} />
                ))}
              </div>
            )}

            {baseline.length > 0 && (
              <div className="space-y-3">
                <p className="bg-label pt-2 text-tx-3">Baseline, already true when you started watching</p>
                {baseline.map(m => (
                  <MoveCard key={m.id} move={m} brandName={brandName}
                    reading={readingId === m.id} onRead={() => readImplication(m)} />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {!brandWebsite && (
        <p className="text-[12.5px] text-tx-3">
          Add your own website in brand settings and the readings below will say what each move
          means for you specifically rather than in general.
        </p>
      )}
    </div>
  )
}

function MoveCard({
  move, brandName, reading, onRead,
}: { move: Move; brandName: string; reading: boolean; onRead: () => void }) {
  const isChange = move.source_kind === 'site_change'
  return (
    <article className="rounded-sm border border-line bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-sm bg-shell px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-tx-2">
          {move.competitor_name}
        </span>
        <span className="rounded-sm border border-line px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-tx-3">
          {MOVE_LABEL[move.category] ?? move.category}
        </span>
        <span className="rounded-sm border border-line px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-tx-3">
          {MOVE_SOURCE_LABEL[move.source_kind]} · {move.confidence} confidence
        </span>
        {move.published_at && (
          <span className="bg-num text-[11px] text-tx-3">{move.published_at}</span>
        )}
      </div>

      <h3 className="mt-3 text-[15px] font-medium leading-snug text-tx">{move.headline}</h3>

      {isChange && (
        <p className="mt-2 flex items-start gap-2 text-[12.5px] leading-relaxed text-tx-2">
          <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-tx-flare" />
          The text on this page no longer matches the copy we held. That tells you it moved, not
          what moved, and a rotating banner changes the text as surely as a price cut does.
        </p>
      )}

      {move.quote && (
        <p className="mt-3 text-[13px] leading-relaxed text-tx-2">“{move.quote}”</p>
      )}

      <a href={move.source_url} target="_blank" rel="noopener noreferrer nofollow"
        className="mt-2.5 inline-flex max-w-full items-center gap-1.5 text-[12px] text-tx-flare underline-offset-2 hover:underline">
        <ExternalLinkIcon className="h-3 w-3 shrink-0" />
        <span className="truncate">{hostOf(move.source_url)}</span>
      </a>

      {move.significance ? (
        <div className="mt-4 border-l-2 border-flare pl-4">
          <p className="bg-label text-tx-3">Why it matters for {brandName} · AI reading</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-tx">{move.significance}</p>
          {move.implication && (
            <p className="mt-2 text-[13px] leading-relaxed text-tx-2">{move.implication}</p>
          )}
        </div>
      ) : (
        <button type="button" onClick={onRead} disabled={reading}
          className="mt-4 flex items-center gap-1.5 rounded-sm border border-line px-3 py-1.5 text-[12.5px] font-medium text-tx bg-press disabled:opacity-50">
          {reading ? <Working className="h-3.5 w-3.5" /> : <AskIcon className="h-3.5 w-3.5" />}
          What does this mean for {brandName}?
        </button>
      )}
    </article>
  )
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}
