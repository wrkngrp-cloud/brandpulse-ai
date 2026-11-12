'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { composeMail, saveDraft, type MailActionState } from './actions'
import { AttachmentPicker, type PickedAttachment } from './attachment-picker'
import { UndoSendBanner } from './undo-send-banner'
import { Button } from '@/components/ui/button'
import { Working } from '@/components/brand/working'

export interface ComposeInitial {
  draftId?:    string
  fromAddress: string
  to?:         string
  cc?:         string[]
  bcc?:        string[]
  subject?:    string
  body?:       string
  attachments?: PickedAttachment[]
}

export function ComposeClient({ fromAddresses, initial }: {
  fromAddresses: string[]
  initial: ComposeInitial
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState<MailActionState, FormData>(composeMail, null)
  const [savePending, startSave] = useTransition()
  const [saveNote, setSaveNote] = useState<string | null>(null)

  const [draftId, setDraftId] = useState(initial.draftId ?? '')
  const [from,    setFrom]    = useState(initial.fromAddress)
  const [to,      setTo]      = useState(initial.to ?? '')
  const [cc,      setCc]      = useState((initial.cc ?? []).join(', '))
  const [bcc,     setBcc]     = useState((initial.bcc ?? []).join(', '))
  const [subject, setSubject] = useState(initial.subject ?? '')
  const [body,    setBody]    = useState(initial.body ?? '')
  // Bumped after a successful send to remount AttachmentPicker, the only way
  // to clear its own internal state.
  const [attachmentsKey, setAttachmentsKey] = useState(0)
  // The most recent send's Undo window, if still within one.
  const [pendingSend, setPendingSend] = useState<{ messageId: string; deadline: number } | null>(null)

  // Resetting the form on a successful send is a reaction to this render's
  // state differing from the last one — exactly what React calls "adjusting
  // state when a prop changes," done during render rather than in an effect
  // so it lands in the same commit instead of a second, visible one.
  const [seenState, setSeenState] = useState(state)
  if (state !== seenState) {
    setSeenState(state)
    if (state?.ok) {
      setDraftId(''); setTo(''); setCc(''); setBcc(''); setSubject(''); setBody('')
      setAttachmentsKey(k => k + 1)
      setPendingSend(
        state.messageId && state.cancellableUntil
          ? { messageId: state.messageId, deadline: state.cancellableUntil }
          : null,
      )
    }
  }

  const handleSaveDraft = () => {
    setSaveNote(null)
    startSave(async () => {
      const fd = new FormData()
      if (draftId) fd.set('draft_id', draftId)
      fd.set('from_address', from)
      fd.set('to', to)
      fd.set('cc', cc)
      fd.set('bcc', bcc)
      fd.set('subject', subject)
      fd.set('body', body)
      const result = await saveDraft(fd)
      if (result.error) { setSaveNote(result.error); return }
      if (result.draftId && result.draftId !== draftId) setDraftId(result.draftId)
      setSaveNote('Draft saved.')
    })
  }

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-line bg-card p-4">
      {draftId && <input type="hidden" name="draft_id" value={draftId} />}

      <div className="space-y-1.5">
        <label className="bg-label text-[0.65rem] text-tx-3">From</label>
        {fromAddresses.length > 1 ? (
          <select
            name="from_address" value={from} onChange={e => setFrom(e.target.value)}
            className="h-9 w-full rounded-md border border-line bg-paper px-3 text-sm"
          >
            {fromAddresses.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        ) : (
          <>
            <input type="hidden" name="from_address" value={from} />
            <p className="text-sm text-tx-2">{from}</p>
          </>
        )}
      </div>

      <Field label="To" name="to" value={to} onChange={setTo} type="email" placeholder="their@email.com" required />
      <Field label="CC" name="cc" value={cc} onChange={setCc} placeholder="comma-separated addresses" />
      <Field label="BCC" name="bcc" value={bcc} onChange={setBcc} placeholder="comma-separated addresses" />
      <Field label="Subject" name="subject" value={subject} onChange={setSubject} required />

      <div className="space-y-1.5">
        <label className="bg-label text-[0.65rem] text-tx-3">Message</label>
        <textarea
          name="body" rows={10} required value={body} onChange={e => setBody(e.target.value)}
          className="w-full resize-y rounded-md border border-line bg-paper px-3 py-2 text-sm"
        />
      </div>

      <AttachmentPicker key={attachmentsKey} name="attachments" initial={initial.attachments} />

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.push('.')}
          className="bg-press rounded-md border border-line px-2.5 py-1.5 text-xs"
        >
          Cancel
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button" onClick={handleSaveDraft} disabled={savePending}
            className="bg-press rounded-md border border-line px-2.5 py-1.5 text-xs disabled:opacity-50"
          >
            {savePending ? 'Saving…' : 'Save draft'}
          </button>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? <><Working className="size-3.5" /> Sending</> : 'Send'}
          </Button>
        </div>
      </div>

      {pendingSend && (
        <UndoSendBanner
          messageId={pendingSend.messageId}
          deadline={pendingSend.deadline}
          onUndone={deleted => {
            setPendingSend(null)
            if (deleted) router.push('.')
            else router.refresh()
          }}
        />
      )}

      {saveNote && <p className="text-xs text-tx-2" role="status">{saveNote}</p>}
      {state?.error && <p className="text-xs text-neg" role="alert">{state.error}</p>}
      {state?.warning && <p className="text-xs text-tx-2" role="status">{state.warning}</p>}
      {state?.ok && !pendingSend && <p className="text-xs text-tx-2" role="status">Sent.</p>}
    </form>
  )
}

function Field({ label, name, value, onChange, type = 'text', placeholder, required }: {
  label: string; name: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; required?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <label className="bg-label text-[0.65rem] text-tx-3">{label}</label>
      <input
        name={name} type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} required={required}
        className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm"
      />
    </div>
  )
}
