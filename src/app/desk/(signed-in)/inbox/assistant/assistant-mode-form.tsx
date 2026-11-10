'use client'

import { useActionState } from 'react'
import { setAssistantMode, type AssistantModeState } from './actions'
import type { AssistantMode } from '@/lib/support/assistant/config'

export function AssistantModeForm({ current }: { current: AssistantMode | null }) {
  const [state, action, pending] = useActionState<AssistantModeState, FormData>(setAssistantMode, null)
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <select
        name="mode" defaultValue={current ?? 'env'} disabled={pending}
        className="h-9 rounded-md border border-line bg-paper px-2 text-sm"
      >
        <option value="env">Follow the environment variable</option>
        <option value="off">Off</option>
        <option value="suggest">Suggest</option>
        <option value="live">Live</option>
      </select>
      <button type="submit" disabled={pending} className="bg-press rounded-sm border border-line bg-card px-3 py-1.5 text-xs">
        Save
      </button>
      {state?.error && <span className="text-xs text-neg">{state.error}</span>}
      {state?.ok && <span className="text-xs text-pos">{state.ok}</span>}
    </form>
  )
}
