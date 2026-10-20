'use client'

import { useActionState, useRef, useEffect } from 'react'
import { replyToThread, type ReplyState } from '../actions'
import { Button } from '@/components/ui/button'
import { Working } from '@/components/brand/working'

/**
 * The reply box.
 *
 * One field, with a checkbox that turns it into a note between us. The two are
 * one control on purpose: an internal note written in a separate panel is a
 * note somebody will accidentally send to the customer, and the reverse.
 */
export function ReplyBox({ conversationId }: { conversationId: string }) {
  const [state, formAction, pending] = useActionState<ReplyState, FormData>(replyToThread, null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.ok) formRef.current?.reset()
  }, [state?.ok])

  return (
    <form ref={formRef} action={formAction} className="space-y-2 rounded-xl border border-line bg-card p-3">
      <input type="hidden" name="conversation_id" value={conversationId} />

      <textarea
        name="body" rows={4} required
        placeholder="Write a reply"
        className="w-full resize-y rounded-md border border-line bg-paper px-3 py-2 text-sm"
      />

      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs text-tx-2">
          <input type="checkbox" name="internal" className="size-3.5" />
          Internal note, not sent to them
        </label>

        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <><Working className="size-3.5" /> Sending</> : 'Send'}
        </Button>
      </div>

      {state?.error && <p className="text-xs text-neg" role="alert">{state.error}</p>}
      {state?.warning && <p className="text-xs text-tx-2" role="status">{state.warning}</p>}
    </form>
  )
}
