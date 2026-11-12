'use client'

import { useActionState, useState, useTransition } from 'react'
import { replyMail, saveDraft, type MailActionState } from './actions'
import { AttachmentPicker, type PickedAttachment } from './attachment-picker'
import { Button } from '@/components/ui/button'
import { Working } from '@/components/brand/working'

export interface ReplyDraftInitial {
  cc?: string[]; bcc?: string[]; body?: string; attachments?: PickedAttachment[]
}

export function ReplyBox({ conversationId, fromAddress, initial }: {
  conversationId: string
  fromAddress:    string
  initial?:       ReplyDraftInitial
}) {
  const [state, formAction, pending] = useActionState<MailActionState, FormData>(replyMail, null)
  const [savePending, startSave] = useTransition()
  const [saveNote, setSaveNote] = useState<string | null>(null)
  const [showCcBcc, setShowCcBcc] = useState(Boolean(initial?.cc?.length || initial?.bcc?.length))

  const [cc,   setCc]   = useState((initial?.cc ?? []).join(', '))
  const [bcc,  setBcc]  = useState((initial?.bcc ?? []).join(', '))
  const [body, setBody] = useState(initial?.body ?? '')
  // Bumped on a successful send to remount AttachmentPicker, the only way to
  // clear its own internal state: its chips are not derived from body/cc/bcc.
  const [attachmentsKey, setAttachmentsKey] = useState(0)

  // Resetting the form on a successful send is a reaction to this render's
  // state differing from the last one — exactly what React calls "adjusting
  // state when a prop changes," done during render rather than in an effect
  // so it lands in the same commit instead of a second, visible one.
  const [seenState, setSeenState] = useState(state)
  if (state !== seenState) {
    setSeenState(state)
    if (state?.ok) {
      setBody(''); setCc(''); setBcc('')
      setAttachmentsKey(k => k + 1)
    }
  }

  const handleSaveDraft = () => {
    setSaveNote(null)
    startSave(async () => {
      const fd = new FormData()
      fd.set('conversation_id', conversationId)
      fd.set('from_address', fromAddress)
      fd.set('cc', cc)
      fd.set('bcc', bcc)
      fd.set('body', body)
      const result = await saveDraft(fd)
      setSaveNote(result.error ?? 'Draft saved.')
    })
  }

  return (
    <form action={formAction} className="space-y-2 rounded-xl border border-line bg-card p-3">
      <input type="hidden" name="conversation_id" value={conversationId} />

      {showCcBcc ? (
        <div className="space-y-1.5">
          <input
            name="cc" value={cc} onChange={e => setCc(e.target.value)} placeholder="CC"
            className="w-full rounded-md border border-line bg-paper px-3 py-1.5 text-xs"
          />
          <input
            name="bcc" value={bcc} onChange={e => setBcc(e.target.value)} placeholder="BCC"
            className="w-full rounded-md border border-line bg-paper px-3 py-1.5 text-xs"
          />
        </div>
      ) : (
        <button
          type="button" onClick={() => setShowCcBcc(true)}
          className="bg-press text-xs text-tx-3 underline-offset-2 hover:underline"
        >
          Add CC/BCC
        </button>
      )}

      <textarea
        name="body" rows={4} required value={body} onChange={e => setBody(e.target.value)}
        placeholder="Write a reply"
        className="w-full resize-y rounded-md border border-line bg-paper px-3 py-2 text-sm"
      />

      <AttachmentPicker key={attachmentsKey} name="attachments" initial={initial?.attachments} />

      <div className="flex items-center justify-end gap-2">
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

      {saveNote && <p className="text-xs text-tx-2" role="status">{saveNote}</p>}
      {state?.error && <p className="text-xs text-neg" role="alert">{state.error}</p>}
      {state?.warning && <p className="text-xs text-tx-2" role="status">{state.warning}</p>}
    </form>
  )
}
