'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BRIEF_HOURS, MOMENT_KINDS, hourLabel, type MomentKind } from '@/lib/brief/metrics'

export interface BriefPanelProps {
  /** The rendered brief (a server component), or null when there is none yet. */
  brief:        React.ReactNode | null
  needsNumbers: boolean
  shareUrl:     string | null
  checkin: {
    question:      string
    example:       string
    weekLabel:     string
    lastWeekValue: number | null
    isIndex:       boolean
  }
  moments:   { id: string; happened_on: string; kind: string; title: string }[]
  briefHour: number
  today:     string
}

async function send(url: string, method: string, body?: unknown): Promise<string | null> {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  if (res.ok) return null
  const data = await res.json().catch(() => ({})) as { error?: string }
  return data.error ?? 'That did not go through. Try again.'
}

export function BriefPanel(p: BriefPanelProps) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [value, setValue] = useState(p.checkin.lastWeekValue?.toString() ?? '')
  const [isIndex, setIsIndex] = useState(p.checkin.isIndex)
  const [moment, setMoment] = useState({ happenedOn: p.today, kind: 'launch' as MomentKind, title: '' })
  const [showMoment, setShowMoment] = useState(false)

  const run = (fn: () => Promise<string | null>, ok: string) => start(async () => {
    const err = await fn()
    if (err) { toast.error(err); return }
    toast.success(ok)
    router.refresh()
  })

  const saveNumber = () => {
    const n = Number(value.replace(/[,\s]/g, ''))
    if (!Number.isFinite(n) || n < 0) { toast.error('Enter a number, like 4210.'); return }
    run(() => send('/api/brief/checkin', 'POST', { value: n, isIndex }), 'Saved. Your brief will use it.')
  }

  return (
    <section className="rounded-sm border border-line bg-card p-4 sm:p-5 space-y-5" data-tour="monday-brief">
      {p.brief ?? (
        <div className="space-y-1">
          <p className="bg-label text-[0.7rem] text-tx-3">Monday Brief</p>
          <p className="text-base font-medium">Every Monday, what moved and why</p>
          <p className="text-sm text-tx-2">
            {p.needsNumbers
              ? 'Your brief needs two weeks of numbers to compare. Add last week below, and the week before if you have it.'
              : 'Add last week’s number below. With two weeks in, your first brief writes itself.'}
          </p>
        </div>
      )}

      <div className="grid gap-4 border-t border-line pt-4 md:grid-cols-2">
        {/* The weekly check-in */}
        <div className="space-y-2" data-tour="brief-checkin">
          <label htmlFor="brief-number" className="text-sm font-medium block">{p.checkin.question}</label>
          <p className="text-xs text-tx-3">Week of {p.checkin.weekLabel}. Only the total, never customer data.</p>
          <div className="flex gap-2">
            <Input id="brief-number" inputMode="numeric" placeholder={p.checkin.example} value={value} onChange={e => setValue(e.target.value)} className="bg-num" />
            <Button onClick={saveNumber} disabled={pending || !value.trim()}>Save</Button>
          </div>
          <label className="flex items-center gap-2 text-xs text-tx-2">
            <input type="checkbox" checked={isIndex} onChange={e => setIsIndex(e.target.checked)} />
            This is an index (a normal week = 100), not the real figure
          </label>
        </div>

        {/* Moments */}
        <div className="space-y-2" data-tour="brief-moments">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">What you did</p>
            <button type="button" className="text-xs underline underline-offset-2 bg-press" onClick={() => setShowMoment(v => !v)}>
              {showMoment ? 'Close' : 'Add a moment'}
            </button>
          </div>
          <p className="text-xs text-tx-3">Launches, price changes, promos, PR, outages. Campaigns are added automatically.</p>
          {showMoment && (
            <div className="space-y-2 rounded-sm border border-line p-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input type="date" value={moment.happenedOn} max={p.today} onChange={e => setMoment(m => ({ ...m, happenedOn: e.target.value }))} className="sm:w-40" />
                <select
                  aria-label="Kind of moment"
                  value={moment.kind}
                  onChange={e => setMoment(m => ({ ...m, kind: e.target.value as MomentKind }))}
                  className="h-9 rounded-sm border border-line bg-card px-2 text-sm"
                >
                  {Object.entries(MOMENT_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
              <Input placeholder="e.g. Launched savings vault" value={moment.title} onChange={e => setMoment(m => ({ ...m, title: e.target.value }))} />
              <Button size="sm" disabled={pending || moment.title.trim().length < 2} onClick={() => run(async () => {
                const err = await send('/api/brief/moments', 'POST', moment)
                if (!err) { setMoment(m => ({ ...m, title: '' })); setShowMoment(false) }
                return err
              }, 'Added.')}>Add</Button>
            </div>
          )}
          {p.moments.length > 0 && (
            <ul className="space-y-1">
              {p.moments.map(m => (
                <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                  <span><span className="bg-num text-xs text-tx-3">{m.happened_on.slice(5)}</span> {m.title}</span>
                  <button type="button" aria-label={`Remove ${m.title}`} className="text-xs text-tx-3 underline bg-press"
                    onClick={() => run(() => send(`/api/brief/moments?id=${m.id}`, 'DELETE'), 'Removed.')}>Remove</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4 text-sm">
        <label className="flex items-center gap-2 text-tx-2" data-tour="brief-time">
          Send it on Mondays at
          <select
            value={p.briefHour}
            onChange={e => run(() => send('/api/brief/settings', 'PATCH', { briefHour: Number(e.target.value) }), 'Saved. Lagos time.')}
            className="h-8 rounded-sm border border-line bg-card px-2 text-sm"
          >
            {BRIEF_HOURS.map(h => <option key={h} value={h}>{hourLabel(h)}</option>)}
          </select>
          <span className="text-xs text-tx-3">Lagos time</span>
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          {p.shareUrl && (
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(p.shareUrl!); toast.success('Link copied. It opens without a login.') }}>
              Copy link to share
            </Button>
          )}
          <Button variant="outline" size="sm" disabled={pending}
            onClick={() => run(() => send('/api/brief/generate', 'POST'), 'Your brief is up to date.')}>
            {pending ? 'Working...' : 'Write it now'}
          </Button>
        </div>
      </div>
    </section>
  )
}
