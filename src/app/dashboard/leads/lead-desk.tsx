'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateLead } from './actions'
import { SearchIcon, ExportIcon, MailIcon } from '@/components/brand/icon'

export interface Lead {
  id: string
  email: string
  name: string | null
  company: string | null
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'dead'
  notes: string | null
  wants_weekly: boolean
  signed_up: boolean
  contacted_at: string | null
  created_at: string
  scan_id: string | null
  public_scans: {
    brand_name: string
    competitors: string[]
    category: string | null
    share_of_reach: number | null
    mentions_found: number | null
  } | null
}

const STATUSES = ['new', 'contacted', 'qualified', 'converted', 'dead'] as const
const STATUS_LABEL: Record<string, string> = {
  new: 'New', contacted: 'Contacted', qualified: 'Qualified', converted: 'Converted', dead: 'Not for us',
}

const day = (s: string) => new Date(s).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })

/** The opening line, written from what they actually did. */
function openingLine(l: Lead): string {
  const s = l.public_scans
  if (!s) return `Hi ${l.name?.split(' ')[0] ?? 'there'},\n\nYou ran the BrandGauge press scoreboard recently.`
  const rivals = (s.competitors ?? []).filter(Boolean)
  return [
    `Hi ${l.name?.split(' ')[0] ?? 'there'},`,
    '',
    `You ran ${s.brand_name} through our press scoreboard${rivals.length ? ` against ${rivals.join(' and ')}` : ''}`
      + `${s.share_of_reach != null ? `, and came out holding ${s.share_of_reach}% of the earned reach in the category` : ''}.`,
    '',
    'Happy to walk you through where the other coverage is going, and what the picture looks like once social and offline are in it.',
  ].join('\n')
}

export function LeadDesk({ leads }: { leads: Lead[] }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | typeof STATUSES[number]>('all')
  const [rows, setRows] = useState(leads)
  const [pending, start] = useTransition()

  const shown = useMemo(() => rows.filter(l => {
    if (filter !== 'all' && l.status !== filter) return false
    if (!q.trim()) return true
    const hay = [l.email, l.name, l.company, l.public_scans?.brand_name, l.public_scans?.category].join(' ').toLowerCase()
    return hay.includes(q.trim().toLowerCase())
  }), [rows, q, filter])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length }
    for (const s of STATUSES) c[s] = rows.filter(l => l.status === s).length
    return c
  }, [rows])

  function patch(id: string, changes: Partial<Lead>) {
    setRows(r => r.map(l => (l.id === id ? { ...l, ...changes } : l)))
    start(async () => {
      const res = await updateLead(id, changes as { status?: string; notes?: string })
      if (res?.error) toast.error(res.error)
    })
  }

  function exportCsv() {
    const head = ['Email', 'Name', 'Company', 'Brand scanned', 'Competitors', 'Category', 'Share %', 'Status', 'Weekly', 'Signed up', 'Captured']
    const body = shown.map(l => [
      l.email, l.name ?? '', l.company ?? '', l.public_scans?.brand_name ?? '',
      (l.public_scans?.competitors ?? []).join(' / '), l.public_scans?.category ?? '',
      l.public_scans?.share_of_reach ?? '', l.status, l.wants_weekly ? 'yes' : 'no',
      l.signed_up ? 'yes' : 'no', new Date(l.created_at).toISOString().slice(0, 10),
    ])
    const csv = [head, ...body].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url; a.download = `brandgauge-leads-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by person, company or brand"
            aria-label="Search leads"
            className="w-full rounded-sm border border-border bg-card py-2.5 pl-9 pr-3 text-sm outline-none focus-visible:ring-2" />
        </div>
        <button onClick={exportCsv}
          className="flex shrink-0 items-center gap-2 rounded-sm border border-border px-3.5 py-2.5 text-[13px] font-medium bg-press">
          <ExportIcon className="h-4 w-4" /> Export CSV
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', ...STATUSES] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            aria-pressed={filter === s}
            className="rounded-sm border px-3 py-1.5 text-[12.5px] transition-colors bg-press"
            style={filter === s
              ? { borderColor: 'var(--tx)', background: 'var(--tx)', color: 'var(--bg-paper)' }
              : { borderColor: 'var(--line)', color: 'var(--tx-2)' }}>
            {s === 'all' ? 'All' : STATUS_LABEL[s]} <span className="bg-num ml-1 opacity-70">{counts[s] ?? 0}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-sm border border-border bg-card p-10 text-center">
          <p className="text-sm font-medium">Nothing here yet.</p>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Leads land here the moment someone gives an address on the public scoreboard.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map(l => (
            <article key={l.id} className="rounded-sm border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-medium">
                    {l.name || l.email}
                    {l.company && <span className="ml-2 text-[13px] text-muted-foreground">{l.company}</span>}
                  </p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground break-words">{l.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="bg-label text-muted-foreground">{day(l.created_at)}</span>
                  {l.wants_weekly && <span className="rounded-sm border border-border px-2 py-0.5 text-[10px]">weekly</span>}
                  {l.signed_up && <span className="rounded-sm px-2 py-0.5 text-[10px] text-on-hot" style={{ background: 'var(--flare)' }}>signed up</span>}
                </div>
              </div>

              {l.public_scans && (
                <div className="mt-4 rounded-sm border border-border bg-muted/40 p-4">
                  <p className="bg-label text-muted-foreground">What they ran</p>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed">
                    <span className="font-medium">{l.public_scans.brand_name}</span>
                    {(l.public_scans.competitors ?? []).length > 0 && <> against {(l.public_scans.competitors ?? []).join(', ')}</>}
                    {l.public_scans.category && <> in {l.public_scans.category}</>}
                    {l.public_scans.share_of_reach != null && (
                      <> · <span className="bg-num font-bold">{l.public_scans.share_of_reach}%</span> of the category&apos;s earned reach</>
                    )}
                  </p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {STATUSES.map(s => (
                  <button key={s} onClick={() => patch(l.id, { status: s })} disabled={pending}
                    aria-pressed={l.status === s}
                    className="rounded-sm border px-2.5 py-1 text-[12px] transition-colors bg-press disabled:opacity-60"
                    style={l.status === s
                      ? { borderColor: 'var(--tx)', background: 'var(--tx)', color: 'var(--bg-paper)' }
                      : { borderColor: 'var(--line)', color: 'var(--tx-3)' }}>
                    {STATUS_LABEL[s]}
                  </button>
                ))}
                <a href={`mailto:${l.email}?subject=${encodeURIComponent(`${l.public_scans?.brand_name ?? 'Your brand'} on the press scoreboard`)}&body=${encodeURIComponent(openingLine(l))}`}
                  className="ml-auto flex items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 text-[12.5px] font-medium bg-press">
                  <MailIcon className="h-3.5 w-3.5" /> Write to them
                </a>
              </div>

              <textarea
                defaultValue={l.notes ?? ''}
                onBlur={e => { if (e.target.value !== (l.notes ?? '')) patch(l.id, { notes: e.target.value }) }}
                placeholder="Notes. Saved when you click away."
                rows={2}
                className="mt-3 w-full resize-none rounded-sm border border-border bg-background px-3 py-2 text-[13px] outline-none focus-visible:ring-2" />
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
