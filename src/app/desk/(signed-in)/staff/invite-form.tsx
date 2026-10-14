'use client'

import { useActionState } from 'react'
import { inviteStaff, type StaffActionState } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Working } from '@/components/brand/working'
import { PlusIcon } from '@/components/brand/icon'

export function InviteForm({ roles }: { roles: { name: string; label: string }[] }) {
  const [state, formAction, pending] = useActionState<StaffActionState, FormData>(inviteStaff, null)

  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <h2 className="flex items-center gap-2 text-sm font-medium">
        <PlusIcon className="size-4" /> Invite someone
      </h2>
      <p className="mt-1 text-xs text-tx-3">
        They get a link that works once and expires in 72 hours. They choose their own password.
      </p>

      <form action={formAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="invite_name">Name</Label>
          <Input id="invite_name" name="full_name" required placeholder="Ada Obi" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="invite_email">Work email</Label>
          <Input id="invite_email" name="email" type="email" required placeholder="ada@brandgauge.app" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="invite_role">Role</Label>
          <select
            id="invite_role" name="role" defaultValue="support"
            className="h-9 w-full rounded-md border border-line bg-paper px-3 text-sm sm:w-44"
          >
            {roles.map(r => <option key={r.name} value={r.name}>{r.label}</option>)}
          </select>
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? <><Working className="size-4" /> Sending</> : 'Send invite'}
        </Button>
      </form>

      {state?.error && (
        <p className="mt-3 text-sm text-neg" role="alert">{state.error}</p>
      )}
      {state?.ok && (
        <p className="mt-3 text-sm text-tx-2" role="status">{state.ok}</p>
      )}
    </section>
  )
}
