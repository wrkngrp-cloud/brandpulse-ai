'use client'

import { useActionState } from 'react'
import { requestImpersonation, endImpersonation, type ImpersonationState } from '@/lib/desk/impersonation-actions'
import { Button } from '@/components/ui/button'
import { Working } from '@/components/brand/working'
import { EyeIcon } from '@/components/brand/icon'

interface SessionSummary {
  id: string; staffName: string; reason: string; status: string
  createdAt: string; endedAt: string | null; endedBy: string | null
  pagesViewed: number; expiresAt: string | null
}

/**
 * Asking to view an account.
 *
 * The reason field is required and the copy says the customer reads it, which
 * is the point: a request somebody has to justify in a sentence is a request
 * they make when they need it.
 */
export function AccessRequest({
  workspaceId, accountName, sessions,
}: { workspaceId: string; accountName: string; sessions: SessionSummary[] }) {
  const [state, formAction, pending] = useActionState<ImpersonationState, FormData>(
    requestImpersonation, null,
  )

  const live    = sessions.filter(s => s.status === 'approved' || s.status === 'active')
  const waiting = sessions.filter(s => s.status === 'pending')
  const past    = sessions.filter(s => !['pending', 'approved', 'active'].includes(s.status))

  const when = (iso: string) => new Date(iso).toLocaleString('en-NG', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  return (
    <section className="space-y-3 rounded-xl border border-line bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-medium">
        <EyeIcon className="size-4" /> View this account
      </h2>

      {live.length > 0 ? (
        live.map(active => (
          <div key={active.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-shell p-3">
            <p className="text-sm">
              {active.staffName} is inside {accountName} read only
              {active.expiresAt && `, until ${when(active.expiresAt)}`}.
            </p>
            <form action={endImpersonation}>
              <input type="hidden" name="session_id" value={active.id} />
              <input type="hidden" name="ended_by" value="staff" />
              <button type="submit" className="bg-press rounded-md border border-line px-2.5 py-1 text-xs">
                End now
              </button>
            </form>
          </div>
        ))
      ) : waiting.length > 0 ? (
        <p className="rounded-xl border border-line bg-shell p-3 text-sm text-tx-2">
          Waiting on {accountName} to answer. They see the reason you gave and can approve or
          decline it. Nothing happens until they do.
        </p>
      ) : (
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="workspace_id" value={workspaceId} />
          <textarea
            name="reason" rows={2} required minLength={10}
            placeholder="Why you need to look. They read this before deciding."
            className="w-full resize-y rounded-md border border-line bg-paper px-3 py-2 text-sm"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-tx-3">
              Read-only, 30 minutes, ends whenever either of you says so.
            </p>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? <><Working className="size-3.5" /> Asking</> : 'Ask to view'}
            </Button>
          </div>
          {state?.error && <p className="text-xs text-neg" role="alert">{state.error}</p>}
          {state?.ok && <p className="text-xs text-tx-2" role="status">{state.ok}</p>}
        </form>
      )}

      {past.length > 0 && (
        <ul className="divide-y divide-line border-t border-line pt-2 text-xs">
          {past.map(row => (
            <li key={row.id} className="py-1.5">
              <span className="text-tx-2">
                {row.staffName} · {row.status === 'declined' ? 'declined' : `${row.pagesViewed} pages`}
              </span>
              <span className="ml-2 text-tx-3">
                {when(row.createdAt)}
                {row.endedBy && ` · ended by ${row.endedBy === 'expiry' ? 'the clock' : row.endedBy}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
