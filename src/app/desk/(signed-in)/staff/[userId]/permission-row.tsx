import { setPermissionOverride } from '../actions'
import type { PermissionState } from '@/lib/desk/data'
import { cn } from '@/lib/utils'

const SOURCE_NOTE: Record<PermissionState['source'], (roleLabel: string) => string> = {
  role:    role => `From the ${role} role`,
  granted: ()   => 'Granted to this person',
  denied:  ()   => 'Denied to this person',
  none:    role => `Not in the ${role} role`,
}

/**
 * One permission key, for one person.
 *
 * Three states rather than a checkbox, because a tick cannot tell "they have
 * it through their role" from "somebody gave it to them", and those two want
 * different things when the role changes. Inherit is the way back to the role.
 */
export function PermissionRow({
  userId, permission, label, state, roleLabel, editable,
}: {
  userId:     string
  permission: string
  label:      string
  state:      PermissionState
  roleLabel:  string
  editable:   boolean
}) {
  const current = state.source === 'granted' ? 'grant' : state.source === 'denied' ? 'deny' : 'inherit'

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
      <div className="min-w-56 flex-1">
        <p className="flex items-center gap-2 text-sm">
          <span className={cn('size-1.5 rounded-full', state.held ? 'bg-pos' : 'bg-neu')} aria-hidden />
          {label}
          <span className="sr-only">{state.held ? 'held' : 'not held'}</span>
        </p>
        <p className="mt-0.5 text-xs text-tx-3">
          <code className="font-sans">{permission}</code> · {SOURCE_NOTE[state.source](roleLabel)}
        </p>
      </div>

      {editable ? (
        <form action={setPermissionOverride} className="flex items-center gap-2">
          <input type="hidden" name="user_id" value={userId} />
          <input type="hidden" name="permission" value={permission} />
          <select
            name="effect" defaultValue={current}
            className="h-8 rounded-md border border-line bg-paper px-2 text-xs"
          >
            <option value="inherit">Follow the role</option>
            <option value="grant">Grant</option>
            <option value="deny">Deny</option>
          </select>
          <button type="submit" className="bg-press rounded-md border border-line px-2 py-1 text-xs text-tx-2">
            Save
          </button>
        </form>
      ) : (
        <span className="text-xs text-tx-3">{state.held ? 'Yes' : 'No'}</span>
      )}
    </li>
  )
}
