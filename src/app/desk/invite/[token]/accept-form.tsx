'use client'

import { useActionState } from 'react'
import { acceptInvite, type DeskAuthState } from '../../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Working } from '@/components/brand/working'

const TIMEZONES = [
  'Africa/Lagos', 'Africa/Accra', 'Africa/Nairobi', 'Africa/Johannesburg',
  'Europe/London', 'America/New_York',
]

/**
 * Setting up a Desk account from an invitation.
 *
 * Two shapes, and `hasAccount` decides which. A brand new address sets a
 * password here. An address that already has a BrandGauge account keeps the
 * password it has, because somebody may be both a customer and staff and
 * taking over their password would reach into their other account. The form
 * used to ask either way and the second case discarded what was typed, so the
 * person could not sign in with it afterwards and nothing said why.
 */
export function AcceptInviteForm({
  token, email, suggestedName, roleLabel, hasAccount,
}: {
  token: string; email: string; suggestedName: string; roleLabel: string
  hasAccount: boolean
}) {
  const [state, formAction, pending] = useActionState<DeskAuthState, FormData>(acceptInvite, null)

  return (
    <div className="rounded-xl border border-line bg-card p-6">
      <h1 className="text-lg font-bold">Set up your Desk account</h1>
      <p className="mt-1 text-sm text-tx-2">
        You have been given the <span className="font-medium text-tx">{roleLabel}</span> role.
      </p>

      <form action={formAction} className="mt-5 space-y-4">
        <input type="hidden" name="token" value={token} />

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          {/* Shown, not editable. The invitation is for this address. */}
          <Input id="email" value={email} disabled readOnly />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="full_name">Full name</Label>
          <Input id="full_name" name="full_name" defaultValue={suggestedName} required
                 aria-invalid={!!state?.fieldErrors?.full_name} />
          {state?.fieldErrors?.full_name && (
            <p className="text-xs text-neg">{state.fieldErrors.full_name[0]}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="job_title">Job title</Label>
          <Input id="job_title" name="job_title" placeholder="Customer support" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="timezone">Timezone</Label>
          <select
            id="timezone" name="timezone" defaultValue="Africa/Lagos"
            className="h-9 w-full rounded-md border border-line bg-paper px-3 text-sm"
          >
            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>

        {hasAccount ? (
          <div className="rounded-xl border border-line bg-shell p-3">
            <p className="text-sm text-tx">This address already has a BrandGauge account.</p>
            <p className="mt-1 text-xs text-tx-2">
              Sign in to the Desk with the password you already use. We are not changing it, so
              your BrandGauge account keeps working exactly as it does now.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" required
                   aria-invalid={!!state?.fieldErrors?.password} />
            <p className="text-xs text-tx-3">At least 12 characters.</p>
            {state?.fieldErrors?.password && (
              <p className="text-xs text-neg">{state.fieldErrors.password[0]}</p>
            )}
          </div>
        )}

        {state?.error && (
          <p className="rounded-xl border border-line p-3 text-sm text-neg" role="alert">
            {state.error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? <><Working className="size-4" /> Setting up</> : 'Set up my account'}
        </Button>
      </form>
    </div>
  )
}
