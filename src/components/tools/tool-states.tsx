'use client'

import Link from 'next/link'
import { AlertIcon, ArrowRightIcon as ArrowRight, CheckIcon } from '@/components/brand/icon'

/**
 * The states a free tool spends most of its life in: working, failed, or
 * finished with nothing worth reporting.
 *
 * No spinners anywhere. The design system bans them, and the honest shape for
 * "we are reading six pages" is a list of those pages ticking off, which also
 * tells the visitor what the tool is actually doing — the transparent progress
 * the brief asks for, rather than a bar pretending to know how far along it is.
 */

export function ResearchProgress({ steps, done }: { steps: string[]; done: number }) {
  return (
    <div className="rounded-sm border p-6" style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-card)' }}>
      <p className="bg-label" style={{ color: 'var(--lp-mut)' }}>Researching</p>
      <ul className="mt-4 space-y-2.5">
        {steps.map((s, i) => {
          const complete = i < done
          const current  = i === done
          return (
            <li key={s} className="flex items-center gap-2.5 text-[13.5px]"
              style={{ color: complete || current ? 'var(--lp-ink)' : 'var(--lp-mut)' }}>
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                {complete
                  ? <CheckIcon className="h-3.5 w-3.5" style={{ color: 'var(--pos)' }} />
                  : <span className="h-1.5 w-1.5 rounded-sm"
                      style={{ background: current ? 'var(--flare)' : 'var(--lp-line)' }} />}
              </span>
              {s}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** The skeleton, shaped like the report that is coming: a heading, a summary,
 *  three finding cards. Never a spinner. */
export function ReportSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-7 w-2/3 rounded-sm" style={{ background: 'var(--lp-chip)' }} />
      <div className="h-4 w-full rounded-sm" style={{ background: 'var(--lp-chip)' }} />
      <div className="h-4 w-4/5 rounded-sm" style={{ background: 'var(--lp-chip)' }} />
      {[0, 1, 2].map(i => (
        <div key={i} className="rounded-sm border p-6" style={{ borderColor: 'var(--lp-line)' }}>
          <div className="h-3 w-24 rounded-sm" style={{ background: 'var(--lp-chip)' }} />
          <div className="mt-3 h-5 w-3/4 rounded-sm" style={{ background: 'var(--lp-chip)' }} />
          <div className="mt-3 h-4 w-full rounded-sm" style={{ background: 'var(--lp-chip)' }} />
        </div>
      ))}
    </div>
  )
}

/**
 * A failure a visitor can act on.
 *
 * Three different things go wrong here and they need three different answers:
 * we could not read the source, the source had nothing, or they typed
 * something we cannot fetch. None of them is a reason to show a fabricated
 * report, and none of them is a reason to show a stack trace.
 */
export function ToolFailure({
  title, body, retry, note,
}: { title: string; body: string; retry?: () => void; note?: string }) {
  return (
    <div className="rounded-sm border p-6" style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-card)' }}>
      <p className="flex items-center gap-2 text-[15px] font-medium" style={{ color: 'var(--lp-ink)' }}>
        <AlertIcon className="h-4 w-4" style={{ color: 'var(--tx-flare)' }} />
        {title}
      </p>
      <p className="mt-2.5 max-w-xl text-[13.5px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>{body}</p>
      {note && <p className="mt-2 text-[12.5px]" style={{ color: 'var(--lp-mut)' }}>{note}</p>}
      <div className="mt-5 flex flex-wrap gap-3">
        {retry && (
          <button type="button" onClick={retry}
            className="rounded-sm border px-5 py-2.5 text-[13.5px] font-medium bg-press"
            style={{ borderColor: 'var(--lp-line)', color: 'var(--lp-ink)' }}>
            Try again
          </button>
        )}
        <Link href="/tools" className="flex items-center gap-1.5 px-1 py-2.5 text-[13.5px] font-medium"
          style={{ color: 'var(--tx-flare)' }}>
          Try another free tool <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}

/** The privacy line under every input form. Short, specific, and true. */
export function PrivacyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>{children}</p>
  )
}
