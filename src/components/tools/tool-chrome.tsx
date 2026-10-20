'use client'

import { Tick, TickReveal } from '@/components/landing/reading'
import { ArrowRightIcon as ArrowRight } from '@/components/brand/icon'
import { Working } from '@/components/brand/working'

/**
 * The parts every tool page shares: the ask at the top, the fields, the
 * button, and the three-step explanation shown before anyone has run anything.
 *
 * Deliberately the same chrome on all five, so the set reads as one product
 * rather than five lead magnets wearing the same logo. The PR Scoreboard page
 * predates this and already has the shape by hand; it keeps its own markup
 * rather than being rewritten, because it works and it ships.
 */

export function ToolHero({
  eyebrow = 'Free, no account', headline, children,
}: { eyebrow?: string; headline: React.ReactNode; children: React.ReactNode }) {
  return (
    <TickReveal className="mx-auto max-w-4xl px-6 pb-10 pt-36 sm:pt-44">
      <Tick as="p" className="bg-label" style={{ color: 'var(--tx-flare)' }}>{eyebrow}</Tick>
      <Tick as="div">
        <h1 className="mt-4 max-w-3xl text-4xl font-medium leading-[1.05] tracking-[-0.02em] sm:text-5xl"
          style={{ fontFamily: 'var(--font)', color: 'var(--lp-ink)' }}>
          {headline}
        </h1>
      </Tick>
      <Tick as="div" className="mt-5 max-w-2xl text-[15px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>
        {children}
      </Tick>
    </TickReveal>
  )
}

export function ToolField({
  id, label, value, onChange, placeholder, type = 'text', required, hint, inputMode,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  required?: boolean
  hint?: string
  inputMode?: 'url' | 'text' | 'email' | 'tel'
}) {
  const hintId = hint ? `${id}-hint` : undefined
  return (
    <div>
      <label htmlFor={id} className="bg-label block" style={{ color: 'var(--lp-mut)' }}>{label}</label>
      <input
        id={id} type={type} value={value} required={required} inputMode={inputMode}
        onChange={e => onChange(e.target.value)} placeholder={placeholder}
        autoComplete="off" autoCapitalize="none" spellCheck={false}
        aria-describedby={hintId}
        className="mt-2 w-full rounded-sm border px-4 py-3 text-[15px] outline-none focus-visible:ring-2"
        style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-card)', color: 'var(--lp-ink)' }}
      />
      {hint && <p id={hintId} className="mt-1.5 text-[12px]" style={{ color: 'var(--lp-mut)' }}>{hint}</p>}
    </div>
  )
}

export function ToolSelect({
  id, label, value, onChange, options,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label htmlFor={id} className="bg-label block" style={{ color: 'var(--lp-mut)' }}>{label}</label>
      <select id={id} value={value} onChange={e => onChange(e.target.value)}
        className="mt-2 w-full rounded-sm border px-4 py-3 text-[15px] outline-none focus-visible:ring-2"
        style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-card)', color: 'var(--lp-ink)' }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

export function ToolSubmit({
  busy, busyLabel, label, disabled,
}: { busy: boolean; busyLabel: string; label: string; disabled?: boolean }) {
  return (
    <button type="submit" disabled={busy || disabled}
      className="flex items-center justify-center gap-2 rounded-sm px-7 py-3.5 text-[14px] font-bold text-on-hot bg-press disabled:opacity-50"
      style={{ background: 'var(--flare)' }}>
      {busy ? <><Working className="h-4 w-4" /> {busyLabel}</> : <>{label} <ArrowRight className="h-4 w-4" /></>}
    </button>
  )
}

/** The three-step explanation, shown only before the first run.
 *
 *  pt-10 is load-bearing: the form above ends on PrivacyNote, which carries
 *  no bottom margin of its own (the form's `space-y-4` only spaces siblings,
 *  not after the last one), so without it this section's "How it reads"
 *  label sits flush against the privacy line above it. The scoreboard page
 *  avoids this by giving its own hero section a trailing `pb-10` instead;
 *  same gap, asserted here since every other tool shares this component. */
export function HowItReads({ steps }: { steps: [string, string][] }) {
  return (
    <TickReveal className="mx-auto max-w-4xl px-6 pt-10 pb-24">
      <Tick as="p" className="bg-label" style={{ color: 'var(--lp-mut)' }}>How it reads</Tick>
      <div className="mt-6 space-y-5">
        {steps.map(([title, body], i) => (
          <Tick key={title} className="flex gap-5 border-t pt-5" style={{ borderColor: 'var(--lp-line)' }}>
            <span className="bg-num text-[13px]" style={{ color: 'var(--tx-flare)' }}>
              {String(i + 1).padStart(2, '0')}
            </span>
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
