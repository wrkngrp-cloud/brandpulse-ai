'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSelectedLayoutSegment } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { loadInbox } from './actions'
import type { InboxRow, InboxCounts, InboxView } from '@/lib/desk/data'
import { cn } from '@/lib/utils'

/**
 * The inbox, as one screen.
 *
 * The list lives in the layout and stays mounted while the thread beside it
 * changes, which is the whole difference between a support tool and a page of
 * links: you keep your place in the queue, the unanswered count stays in front
 * of you, and answering one conversation does not throw away the list you were
 * working down.
 *
 * Because a Next layout renders once and is not re-run when you move between
 * the routes inside it, `revalidatePath` cannot refresh this list. It owns its
 * own data instead: the server renders the first page, then Realtime says when
 * something changed and `loadInbox` re-reads it. Both tables are on the
 * publication and carry staff policies, so Realtime forwards only rows this
 * person could already read.
 */

const VIEWS: { key: InboxView; label: string; countKey?: keyof InboxCounts }[] = [
  { key: 'unassigned', label: 'Unassigned', countKey: 'unassigned' },
  { key: 'mine',       label: 'Mine',       countKey: 'mine' },
  { key: 'open',       label: 'Open',       countKey: 'open' },
  { key: 'snoozed',    label: 'Snoozed',    countKey: 'snoozed' },
  { key: 'closed',     label: 'Closed',     countKey: 'closed' },
  { key: 'all',        label: 'Everything' },
]

const SOURCE_LABEL: Record<string, string> = {
  app: 'In the product', site: 'Website', scoreboard: 'Scoreboard',
  tool: 'Free tool', email: 'Email',
}

/** "4m", "2h", "3d". Short because it sits in a dense row. */
function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 60) return `${mins}m`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

export function InboxShell({
  initialRows, initialCounts, initialView, children,
}: {
  initialRows:   InboxRow[]
  initialCounts: InboxCounts
  initialView:   InboxView
  children:      React.ReactNode
}) {
  const router = useRouter()
  // The [id] segment, so the list can mark the open thread without the parent
  // needing to know the route shape.
  const openId = useSelectedLayoutSegment()

  const [view,   setView]   = useState<InboxView>(initialView)
  const [rows,   setRows]   = useState(initialRows)
  const [counts, setCounts] = useState(initialCounts)
  const [cursor, setCursor] = useState(0)

  const listRef = useRef<HTMLUListElement>(null)
  // Held in a ref as well as state so the Realtime handler, which is created
  // once, always re-reads the view the person is actually looking at. Written
  // in an effect rather than during render, which React forbids.
  const viewRef = useRef(view)
  useEffect(() => { viewRef.current = view }, [view])

  const refresh = useCallback(async (next: InboxView) => {
    const data = await loadInbox(next)
    if (!data) return
    setRows(data.rows)
    setCounts(data.counts)
  }, [])

  // Live. One channel for both tables: a new message changes the preview and
  // the order, a status or assignment change moves a thread between views, and
  // either way the cheapest correct answer is to re-read the page.
  useEffect(() => {
    const supabase = createClient()
    let queued: ReturnType<typeof setTimeout> | null = null

    // A burst of changes (a reply writes a message and touches the
    // conversation) should cost one read, not three.
    const settle = () => {
      if (queued) clearTimeout(queued)
      queued = setTimeout(() => { void refresh(viewRef.current) }, 300)
    }

    const channel = supabase
      .channel('desk-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_conversations' }, settle)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, settle)
      .subscribe()

    // Realtime can miss while a tab is asleep, so catch up on the way back.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh(viewRef.current)
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      if (queued) clearTimeout(queued)
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [refresh])

  const pickView = (next: InboxView) => {
    setView(next)
    setCursor(0)
    void refresh(next)
  }

  // Keyboard, the way an inbox is actually worked: move with j and k, open
  // with Enter. Ignored while someone is typing, or the reply box would eat
  // every j.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return
      if (event.metaKey || event.ctrlKey || event.altKey) return

      if (event.key === 'j' || event.key === 'k') {
        event.preventDefault()
        setCursor(current => {
          const next = event.key === 'j'
            ? Math.min(current + 1, rows.length - 1)
            : Math.max(current - 1, 0)
          listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' })
          return next
        })
      }

      if (event.key === 'Enter' && rows[cursor]) {
        event.preventDefault()
        router.push(`/desk/inbox/${rows[cursor].id}`)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rows, cursor, router])

  return (
    <div className="grid gap-0 lg:h-[calc(100vh-9rem)] lg:grid-cols-[21rem_1fr] lg:overflow-hidden">
      {/* The queue */}
      <aside className="flex min-h-0 flex-col border-line lg:border-r">
        <div className="flex flex-wrap gap-1 border-b border-line px-3 py-2">
          {VIEWS.map(item => {
            const n = item.countKey ? counts[item.countKey] : null
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => pickView(item.key)}
                className={cn(
                  'bg-press flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs',
                  view === item.key
                    ? 'border-line bg-shell text-tx'
                    : 'border-transparent text-tx-3',
                )}
              >
                {item.label}
                {n !== null && n > 0 && <span className="bg-num text-[0.65rem] text-tx-2">{n}</span>}
              </button>
            )
          })}
        </div>

        {rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-tx-3">
            Nothing in this queue. The widget is live in the product, on the website and on
            the scoreboard, so the next one lands here.
          </p>
        ) : (
          <ul ref={listRef} className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
            {rows.map((row, index) => (
              <li key={row.id}>
                <Link
                  href={`/desk/inbox/${row.id}`}
                  onClick={() => setCursor(index)}
                  className={cn(
                    'bg-press block px-3 py-2.5',
                    openId === row.id && 'bg-shell',
                    cursor === index && openId !== row.id && 'bg-shell/60',
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                      {row.waitingOnUs && <span className="size-1.5 shrink-0 rounded-full bg-flare" aria-hidden />}
                      <span className="truncate">{row.name ?? row.email ?? 'Someone on the site'}</span>
                    </p>
                    {/* How long they have been waiting, not when they wrote.
                        An age is what tells you whether to pick this one up. */}
                    {row.waitingSince ? (
                      <span className="bg-num shrink-0 text-xs text-tx-flare">{ago(row.waitingSince)}</span>
                    ) : (
                      <span className="bg-num shrink-0 text-xs text-tx-3">{ago(row.lastMessageAt)}</span>
                    )}
                  </div>

                  <p className="mt-0.5 line-clamp-1 text-xs text-tx-2">{row.preview}</p>

                  <p className="mt-0.5 truncate text-[0.7rem] text-tx-3">
                    {[
                      row.workspaceName ? `${row.workspaceName} · ${row.plan}` : 'No account yet',
                      SOURCE_LABEL[row.source] ?? row.source,
                      row.assignedTo ? `with ${row.assignedTo}` : null,
                    ].filter(Boolean).join(' · ')}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <p className="border-t border-line px-3 py-2 text-[0.7rem] text-tx-3">
          <span className="bg-num">j</span> and <span className="bg-num">k</span> to move,{' '}
          <span className="bg-num">Enter</span> to open
        </p>
      </aside>

      {/* The conversation */}
      <section className="min-h-0 overflow-y-auto px-4 py-4 lg:px-6">{children}</section>
    </div>
  )
}
