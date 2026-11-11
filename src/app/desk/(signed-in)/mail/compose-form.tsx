'use client'

import { useActionState, useRef, useEffect, useState } from 'react'
import { composeMail, type MailActionState } from './actions'
import { Button } from '@/components/ui/button'
import { Working } from '@/components/brand/working'

/**
 * Starting a conversation. Collapsed to one button until pressed, because a
 * compose form sitting open above an empty list reads as "you have nothing,"
 * not as an invitation.
 */
export function ComposeForm({ fromAddress }: { fromAddress: string }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<MailActionState, FormData>(composeMail, null)
  const formRef = useRef<HTMLFormElement>(null)

  // Left open rather than collapsed on success: the next person to write to
  // is usually one more send away, not a reason to hide the form again.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset()
  }, [state?.ok])

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>Compose</Button>
    )
  }

  return (
    <form
      ref={formRef} action={formAction}
      className="space-y-2 rounded-xl border border-line bg-card p-3"
    >
      <input type="hidden" name="from_address" value={fromAddress} />
      <p className="bg-label text-[0.6rem] text-tx-3">From {fromAddress}</p>

      <input
        name="to" type="email" required placeholder="Their email"
        className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm"
      />
      <input
        name="subject" required placeholder="Subject"
        className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm"
      />
      <textarea
        name="body" rows={6} required placeholder="Write your message"
        className="w-full resize-y rounded-md border border-line bg-paper px-3 py-2 text-sm"
      />

      <div className="flex items-center justify-end gap-2">
        <button
          type="button" onClick={() => setOpen(false)}
          className="bg-press rounded-md border border-line px-2.5 py-1.5 text-xs"
        >
          Cancel
        </button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <><Working className="size-3.5" /> Sending</> : 'Send'}
        </Button>
      </div>

      {state?.error && <p className="text-xs text-neg" role="alert">{state.error}</p>}
      {state?.warning && <p className="text-xs text-tx-2" role="status">{state.warning}</p>}
    </form>
  )
}
