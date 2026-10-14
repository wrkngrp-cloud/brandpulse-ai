'use client'

import { useState } from 'react'
import { ArrowRightIcon, CheckIcon } from '@/components/brand/icon'
import { Working } from '@/components/brand/working'

/**
 * The enquiry form a member of the public fills in.
 *
 * Two things shape it. First, the primary action is the destination the brand
 * chose: someone who scanned a billboard to see an offer gets the offer, and
 * the form is the alternative rather than a toll gate. Second, consent is a
 * real decision — the button is disabled until the box is ticked, the wording
 * is explicit about who makes contact and why, and that exact wording travels
 * with the row so the record says what was agreed to.
 */
export function RespondForm({
  campaignId, campaignName, brandName, headline, blurb, destination, placementSlug, placementName,
}: {
  campaignId: string
  campaignName: string
  brandName: string | null
  headline: string | null
  blurb: string | null
  destination: string
  placementSlug: string | null
  placementName: string | null
}) {
  const who = brandName ?? campaignName
  const consentText = `I agree that ${who} may contact me about this enquiry using the details I have given. I understand I can ask them to stop at any time.`

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [callback, setCallback] = useState(false)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/campaigns/offline/response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          placement: placementSlug ?? undefined,
          name: name || undefined,
          email: email || undefined,
          phone: phone || undefined,
          message: message || undefined,
          wantsCallback: callback,
          consent: consent as true,
          consentText,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'That did not send.')
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not send.')
    } finally { setBusy(false) }
  }

  return (
    <main className="min-h-screen bg-paper px-5 py-12">
      <div className="mx-auto max-w-lg">
        <p className="bg-label text-tx-3">{who}</p>
        <h1 className="mt-3 text-[26px] font-medium leading-tight tracking-[-0.02em] text-tx">
          {headline ?? campaignName}
        </h1>
        {blurb && <p className="mt-3 text-[14.5px] leading-relaxed text-tx-2">{blurb}</p>}
        {placementName && (
          <p className="mt-3 text-[12.5px] text-tx-3">You came from: {placementName}</p>
        )}

        <a href={destination}
          className="mt-7 flex items-center justify-center gap-2 rounded-sm bg-flare px-6 py-3.5 text-[15px] font-bold text-on-hot bg-press">
          Continue <ArrowRightIcon className="h-4 w-4" />
        </a>

        <div className="my-8 flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="bg-label text-tx-3">Or ask a question</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        {sent ? (
          <div className="rounded-sm border border-line bg-card p-6">
            <p className="flex items-center gap-2 text-[15px] font-medium text-tx">
              <CheckIcon className="h-4 w-4 text-pos" /> Sent
            </p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-tx-2">
              {who} has your enquiry and will come back to you on the details you left.
            </p>
            <a href={destination} className="mt-5 inline-flex items-center gap-2 text-[14px] font-medium text-tx-flare">
              Carry on to {who} <ArrowRightIcon className="h-3.5 w-3.5" />
            </a>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3.5">
            <Field id="r-name" label="Your name" value={name} onChange={setName} placeholder="Ada Obi" autoComplete="name" />
            <Field id="r-phone" label="Phone number" value={phone} onChange={setPhone}
              placeholder="0801 234 5678" type="tel" autoComplete="tel" />
            <Field id="r-email" label="Email, if you prefer" value={email} onChange={setEmail}
              placeholder="ada@example.com" type="email" autoComplete="email" />

            <div>
              <label htmlFor="r-msg" className="bg-label block text-tx-3">What would you like to know?</label>
              <textarea id="r-msg" value={message} onChange={e => setMessage(e.target.value)} rows={3}
                className="mt-2 w-full rounded-sm border border-line bg-card px-3.5 py-2.5 text-[15px] text-tx outline-none focus-visible:ring-2" />
            </div>

            <label className="flex items-start gap-2.5 text-[13px] text-tx-2">
              <input type="checkbox" checked={callback} onChange={e => setCallback(e.target.checked)}
                className="mt-0.5 accent-[var(--flare)]" />
              Please call me back.
            </label>

            <label className="flex items-start gap-2.5 text-[13px] leading-relaxed text-tx-2">
              <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}
                className="mt-0.5 accent-[var(--flare)]" required />
              {consentText}
            </label>

            <button type="submit" disabled={busy || !consent || (!phone.trim() && !email.trim())}
              className="flex w-full items-center justify-center gap-2 rounded-sm border border-line px-5 py-3 text-[14px] font-bold text-tx bg-press disabled:opacity-50">
              {busy ? <><Working className="h-4 w-4" /> Sending</> : 'Send my enquiry'}
            </button>

            {error && <p className="text-[12.5px] text-neg">{error}</p>}

            <p className="text-[11.5px] leading-relaxed text-tx-3">
              Your details go to {who} and nobody else. They are stored so {who} can answer you,
              and you can ask them to delete them at any time.
            </p>
          </form>
        )}
      </div>
    </main>
  )
}

function Field({
  id, label, value, onChange, placeholder, type = 'text', autoComplete,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; autoComplete?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="bg-label block text-tx-3">{label}</label>
      <input id={id} type={type} value={value} placeholder={placeholder} autoComplete={autoComplete}
        onChange={e => onChange(e.target.value)}
        className="mt-2 w-full rounded-sm border border-line bg-card px-3.5 py-2.5 text-[15px] text-tx outline-none focus-visible:ring-2" />
    </div>
  )
}
