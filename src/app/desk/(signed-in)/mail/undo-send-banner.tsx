'use client'

import { useEffect, useState, useTransition } from 'react'
import { cancelSentMail } from './actions'

/**
 * A short window to pull a message back before Resend actually sends it.
 * Every send from a personal mailbox is scheduled a few seconds out
 * (src/lib/support/mail-send.ts) specifically so this has something real to
 * cancel — ticks down against the same deadline the server will enforce, so
 * the button disappearing and the server actually refusing happen at
 * (almost) the same moment.
 */
export function UndoSendBanner({ messageId, deadline, onUndone }: {
  messageId: string
  deadline:  number
  onUndone:  (conversationDeleted: boolean) => void
}) {
  const [msLeft, setMsLeft] = useState(() => Math.max(0, deadline - Date.now()))
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const id = setInterval(() => {
      const left = deadline - Date.now()
      if (left <= 0) { setMsLeft(0); clearInterval(id); return }
      setMsLeft(left)
    }, 250)
    return () => clearInterval(id)
  }, [deadline])

  if (msLeft <= 0) return null

  const undo = () => {
    setError(null)
    startTransition(async () => {
      const result = await cancelSentMail(messageId)
      if (result.error) { setError(result.error); return }
      onUndone(Boolean(result.conversationDeleted))
    })
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-line bg-shell px-3 py-1.5 text-xs">
      <span className="text-tx-2">Sending · undo in {Math.ceil(msLeft / 1000)}s</span>
      <button
        type="button" onClick={undo} disabled={pending}
        className="bg-press rounded-md border border-line px-2 py-0.5 font-medium disabled:opacity-50"
      >
        {pending ? 'Undoing…' : 'Undo'}
      </button>
      {error && <span className="text-neg" role="alert">{error}</span>}
    </div>
  )
}
