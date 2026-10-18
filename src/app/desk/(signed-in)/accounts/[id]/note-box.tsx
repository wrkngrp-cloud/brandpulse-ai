'use client'

import { useActionState, useRef, useEffect } from 'react'
import { addAccountNote, type AccountActionState } from './actions'
import { Button } from '@/components/ui/button'
import { Working } from '@/components/brand/working'

/**
 * A note on an account.
 *
 * What somebody learned that is not in any other column. Internal: the
 * customer never sees it, and the table has no policy that would let them.
 */
export function NoteBox({ workspaceId }: { workspaceId: string }) {
  const [state, formAction, pending] = useActionState<AccountActionState, FormData>(addAccountNote, null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.ok) formRef.current?.reset()
  }, [state?.ok])

  return (
    <form ref={formRef} action={formAction} className="space-y-2 rounded-xl border border-line bg-card p-3">
      <textarea
        name="body" rows={2} required
        placeholder="What did you learn about this account?"
        className="w-full resize-y rounded-md border border-line bg-paper px-3 py-2 text-sm"
      />
      <input type="hidden" name="workspace_id" value={workspaceId} />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-tx-3">Only staff can see this.</p>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <><Working className="size-3.5" /> Saving</> : 'Add note'}
        </Button>
      </div>
      {state?.error && <p className="text-xs text-neg" role="alert">{state.error}</p>}
    </form>
  )
}
