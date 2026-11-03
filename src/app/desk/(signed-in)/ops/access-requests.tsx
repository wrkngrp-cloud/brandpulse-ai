'use client'

import { useActionState } from 'react'
import { decideAccess, type AccessDecisionState } from './actions'
import type { AccessRequest } from '@/lib/desk/shared-access'

function Row({ r }: { r: AccessRequest }) {
  const [state, action, pending] = useActionState<AccessDecisionState, FormData>(decideAccess, null)
  return (
    <li className="px-4 py-3 space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm">
          {r.brandName}{r.workspaceName ? <span className="text-tx-3"> · {r.workspaceName}</span> : null}
        </p>
        <p className="text-xs text-tx-3">{r.kind === 'ga4' ? 'GA4 property' : 'Meta ad account'} <span className="bg-num">{r.externalId}</span>{r.externalName ? ` · ${r.externalName}` : ''}</p>
      </div>
      <p className="text-xs text-tx-2">Asked by {r.requestedBy || 'unknown'} on <span className="bg-num">{r.requestedAt.slice(0, 10)}</span>. Confirm with them that this account is theirs before approving.</p>
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="kind" value={r.kind} />
        <input type="hidden" name="id" value={r.id} />
        <button name="decision" value="approve" disabled={pending} className="bg-press rounded-sm border border-line bg-card px-3 py-1 text-xs">Approve</button>
        <button name="decision" value="reject" disabled={pending} className="bg-press rounded-sm border border-line px-3 py-1 text-xs text-tx-2">Reject</button>
        {state?.error && <span className="text-xs text-neg">{state.error}</span>}
        {state?.ok && <span className="text-xs text-pos">{state.ok}</span>}
      </form>
    </li>
  )
}

export function AccessRequests({ requests }: { requests: AccessRequest[] }) {
  return (
    <section className="space-y-2" data-tour="desk-access-requests">
      <h2 className="bg-label text-[0.7rem] text-tx-3">Shared access waiting for you</h2>
      <p className="text-xs text-tx-3">
        A brand added BrandGauge as a GA4 Viewer or a Meta partner. Nothing syncs until you approve.
      </p>
      {requests.length === 0 ? (
        <p className="rounded-xl border border-line bg-card px-4 py-3 text-sm text-tx-2">Nothing waiting.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
          {requests.map(r => <Row key={`${r.kind}-${r.id}`} r={r} />)}
        </ul>
      )}
    </section>
  )
}
