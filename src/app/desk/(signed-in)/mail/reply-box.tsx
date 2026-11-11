'use client'

import { useActionState, useRef, useEffect } from 'react'
import { replyMail, type MailActionState } from './actions'
import { Button } from '@/components/ui/button'
import { Working } from '@/components/brand/working'

export function ReplyBox({ conversationId }: { conversationId: string }) {
  const [state, formAction, pending] = useActionState<MailActionState, FormData>(replyMail, null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.ok) formRef.current?.reset()
  }, [state?.ok])

  return (
    <form ref={formRef} action={formAction} className="space-y-2 rounded-xl border border-line bg-card p-3">
      <input type="hidden" name="conversation_id" value={conversationId} />

      <textarea
        name="body" rows={5} required
        placeholder="Write a reply"
        className="w-full resize-y rounded-md border border-line bg-paper px-3 py-2 text-sm"
      />

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <><Working className="size-3.5" /> Sending</> : 'Send'}
        </Button>
      </div>

      {state?.error && <p className="text-xs text-neg" role="alert">{state.error}</p>}
      {state?.warning && <p className="text-xs text-tx-2" role="status">{state.warning}</p>}
    </form>
  )
}
