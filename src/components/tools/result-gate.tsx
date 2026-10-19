'use client'

import { useEffect, useState } from 'react'
import { ArrowRightIcon, CheckIcon, LockIcon } from '@/components/brand/icon'
import { Working } from '@/components/brand/working'
import { GATE_COPY, LEAD_ROLES, type Withheld } from '@/lib/tools/gate'
import type { ToolId } from '@/lib/tools/registry'
import { trackTool } from './use-tool-analytics'

/**
 * The email gate, placed after the work and after a real finding.
 *
 * The thing that makes this an exchange rather than a toll is what sits above
 * it on the page: a complete finding with a named source and a working link.
 * By the time anyone reads this form they have seen that the analysis is real
 * and specific to them, which is the only honest reason to ask for an
 * address, and the reason the address tends to be a working one.
 *
 * Three fields. Company is not among them because the tool already knows the
 * website, so the server derives it. Role is, because it is the one thing a
 * BDM cannot infer and the one that decides who picks up the call.
 */
export function ResultGate({
  toolId, runToken, withheld, onUnlocked,
}: {
  toolId: ToolId
  runToken: string | null
  withheld: Withheld
  onUnlocked: (result: unknown) => void
}) {
  const copy = GATE_COPY[toolId]

  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [monitoring, setMonitoring] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const consentText = `I agree that BrandGauge may email me this report${
    monitoring ? ', and keep me updated as described' : ''
  }, and may contact me about BrandGauge.`

  useEffect(() => { trackTool({ event: 'free_tool_gate_viewed', toolId }) }, [toolId])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!runToken) return
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/tools/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: runToken, email,
          name: name || undefined,
          role: role || undefined,
          wantsMonitoring: monitoring,
          consentText,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'That did not send.')
      onUnlocked(data.result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not send.')
    } finally { setBusy(false) }
  }

  return (
    <section className="mt-6 rounded-sm border p-7"
      style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-card)' }}>
      <p className="flex items-center gap-2 bg-label" style={{ color: 'var(--tx-flare)' }}>
        <LockIcon className="h-3.5 w-3.5" /> The rest of this report
      </p>

      <h2 className="mt-3 max-w-2xl text-xl font-medium tracking-tight sm:text-2xl"
        style={{ fontFamily: 'var(--font)', color: 'var(--lp-ink)' }}>
        {copy.headline(withheld)}
      </h2>
      <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>
        {copy.body}
      </p>

      <form onSubmit={submit} className="mt-6 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="gate-email" className="bg-label block" style={{ color: 'var(--lp-mut)' }}>Work email</label>
            <input id="gate-email" type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@brand.com" autoComplete="email" inputMode="email"
              className="mt-2 w-full rounded-sm border px-4 py-3 text-[15px] outline-none focus-visible:ring-2"
              style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-bg)', color: 'var(--lp-ink)' }} />
          </div>
          <div>
            <label htmlFor="gate-name" className="bg-label block" style={{ color: 'var(--lp-mut)' }}>Your name</label>
            <input id="gate-name" value={name} onChange={e => setName(e.target.value)}
              placeholder="Ada Obi" autoComplete="name"
              className="mt-2 w-full rounded-sm border px-4 py-3 text-[15px] outline-none focus-visible:ring-2"
              style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-bg)', color: 'var(--lp-ink)' }} />
          </div>
        </div>

        <div>
          <label htmlFor="gate-role" className="bg-label block" style={{ color: 'var(--lp-mut)' }}>What you do</label>
          <select id="gate-role" value={role} onChange={e => setRole(e.target.value)}
            className="mt-2 w-full rounded-sm border px-4 py-3 text-[15px] outline-none focus-visible:ring-2"
            style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-bg)', color: 'var(--lp-ink)' }}>
            <option value="">Prefer not to say</option>
            {LEAD_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <label className="flex items-start gap-2.5 text-[13px] leading-relaxed" style={{ color: 'var(--lp-ink)' }}>
          <input type="checkbox" checked={monitoring} onChange={e => setMonitoring(e.target.checked)}
            className="mt-0.5 accent-[var(--flare)]" />
          {copy.monitoring}
        </label>

        <button type="submit" disabled={busy || email.trim().length < 5}
          className="flex items-center justify-center gap-2 rounded-sm px-7 py-3.5 text-[14px] font-bold text-on-hot bg-press disabled:opacity-50"
          style={{ background: 'var(--flare)' }}>
          {busy ? <><Working className="h-4 w-4" /> Sending</> : <>{copy.button} <ArrowRightIcon className="h-4 w-4" /></>}
        </button>

        {error && <p className="text-[12.5px]" style={{ color: 'var(--neg)' }}>{error}</p>}

        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>
          {consentText} We do not sell your details or pass them to anyone else, and you can ask
          us to delete them at any time.
        </p>
      </form>
    </section>
  )
}

/** Shown in place of the gate once it has been answered, so the page
 *  acknowledges the exchange rather than silently swapping content. */
export function GateCleared({ email }: { email?: string }) {
  return (
    <div className="mt-6 rounded-sm border p-5"
      style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-chip)' }}>
      <p className="flex items-center gap-2 text-[14px] font-medium" style={{ color: 'var(--lp-ink)' }}>
        <CheckIcon className="h-4 w-4" style={{ color: 'var(--pos)' }} /> The full report is below
      </p>
      <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>
        A copy is on its way to {email ?? 'your inbox'}, so you have it when you need to forward it.
      </p>
    </div>
  )
}
