'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon, ChevronIcon, ArrowRightIcon as ArrowRight } from '@/components/brand/icon'
import { FREE_TOOLS, toolsByCategory } from '@/lib/tools/registry'

/**
 * The "Free Tools" menu in the marketing nav.
 *
 * The label is fixed: Free Tools, not Tools, not Resources. It was "Free tool"
 * singular, pointing straight at the PR Scoreboard, and that route still
 * works — it is simply one of five entries now, read from the registry so a
 * sixth tool never touches this file.
 *
 * Built by hand rather than with a library because this nav has no dropdown
 * yet and one popover is not worth a dependency. What it does owe the user is
 * real keyboard support: the trigger toggles on Enter and Space, arrow keys
 * walk the items, Escape closes and returns focus, Tab out closes, and a click
 * anywhere else closes. On a phone the same registry renders as a plain
 * disclosure list, since a hover panel has nothing to hover.
 */
export function FreeToolsMenu({ mobile = false }: { mobile?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const pathname = usePathname()
  const groups = toolsByCategory()

  /* Open state is stored as the path it was opened on, not a boolean, so a
     client-side navigation closes the panel by itself. The effect that used to
     do this ran setState in an effect body, which is a cascading render and
     what the lint rule is there to stop. */
  const [openAt, setOpenAt] = useState<string | null>(null)
  const open = openAt !== null && openAt === pathname
  const setOpen = useCallback((next: boolean) => setOpenAt(next ? pathname : null), [pathname])

  const active = FREE_TOOLS.some(t => pathname === t.route || pathname.startsWith(`${t.route}/`)) || pathname === '/tools'

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); trigger.current?.focus() }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, setOpen])

  function onTriggerKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setOpen(true)
      requestAnimationFrame(() => {
        wrap.current?.querySelector<HTMLAnchorElement>('a[data-tool-item]')?.focus()
      })
    }
  }

  function onItemKey(e: React.KeyboardEvent) {
    const items = Array.from(wrap.current?.querySelectorAll<HTMLAnchorElement>('a[data-tool-item]') ?? [])
    const i = items.indexOf(e.target as HTMLAnchorElement)
    if (e.key === 'ArrowDown') { e.preventDefault(); items[Math.min(i + 1, items.length - 1)]?.focus() }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (i <= 0) { setOpen(false); trigger.current?.focus() } else items[i - 1].focus()
    }
    if (e.key === 'Tab' && !e.shiftKey && i === items.length - 1) setOpen(false)
  }

  if (mobile) {
    return (
      <div className="border-t" style={{ borderColor: 'var(--lp-line)' }}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex w-full items-center justify-between px-6 py-3.5 text-[13px] font-medium bg-press"
          style={{ color: active ? 'var(--tx-flare)' : 'var(--lp-ink)' }}
        >
          Free Tools
          <ChevronIcon className="h-4 w-4" style={{ transform: open ? 'rotate(180deg)' : undefined }} />
        </button>
        {open && (
          <ul id={panelId} className="pb-2">
            {FREE_TOOLS.map(tool => (
              <li key={tool.id}>
                <Link href={tool.route} data-tool-item
                  className="flex items-start gap-3 px-6 py-2.5 bg-press"
                  style={{ color: 'var(--lp-ink)' }}>
                  <Icon name={tool.icon} className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--tx-flare)' }} />
                  <span>
                    <span className="block text-[13px] font-medium">{tool.name}</span>
                    <span className="mt-0.5 block text-[11.5px] leading-snug" style={{ color: 'var(--lp-mut)' }}>{tool.blurb}</span>
                  </span>
                </Link>
              </li>
            ))}
            <li>
              <Link href="/tools" className="flex items-center gap-1.5 px-6 py-3 text-[12px] font-medium"
                style={{ color: 'var(--tx-flare)' }}>
                Explore all free tools <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </li>
          </ul>
        )}
      </div>
    )
  }

  return (
    <div ref={wrap} className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(!open)}
        onKeyDown={onTriggerKey}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={panelId}
        className="flex items-center gap-1 transition-opacity hover:opacity-60"
        style={{ color: 'var(--tx-flare)' }}
      >
        Free Tools
        <ChevronIcon className="h-3 w-3" style={{ transform: open ? 'rotate(180deg)' : undefined }} />
      </button>

      {open && (
        <div
          id={panelId}
          // A hairline-closed plane, one radius, no shadow: elevation in this
          // system is a line, not a blur.
          className="absolute right-0 top-full z-50 mt-3 w-[26rem] rounded-sm border p-5"
          style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-card)' }}
        >
          <p className="bg-label" style={{ color: 'var(--lp-mut)' }}>Free intelligence tools</p>

          <div className="mt-4 space-y-5">
            {groups.map(group => (
              <div key={group.category}>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--lp-mut)' }}>
                  {group.label}
                </p>
                <ul className="mt-2 space-y-0.5">
                  {group.tools.map(tool => {
                    const here = pathname === tool.route
                    return (
                      <li key={tool.id}>
                        <Link
                          href={tool.route}
                          data-tool-item
                          onKeyDown={onItemKey}
                          className="group flex items-start gap-3 rounded-sm px-2.5 py-2 transition-colors"
                          style={{ background: here ? 'var(--lp-chip)' : undefined, color: 'var(--lp-ink)' }}
                          onMouseEnter={e => { if (!here) e.currentTarget.style.background = 'var(--lp-chip)' }}
                          onMouseLeave={e => { if (!here) e.currentTarget.style.background = '' }}
                        >
                          <Icon name={tool.icon} className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--tx-flare)' }} />
                          <span className="min-w-0">
                            <span className="block text-[13px] font-medium leading-tight">{tool.name}</span>
                            <span className="mt-1 block text-[11.5px] leading-snug" style={{ color: 'var(--lp-mut)' }}>
                              {tool.blurb}
                            </span>
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-5 border-t pt-4" style={{ borderColor: 'var(--lp-line)' }}>
            <Link href="/tools" data-tool-item onKeyDown={onItemKey}
              className="flex items-center gap-1.5 text-[12.5px] font-medium"
              style={{ color: 'var(--tx-flare)' }}>
              Explore all free tools <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
