'use client'

import { useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import { deskLogin, type DeskAuthState } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Working } from '@/components/brand/working'
import { BrandLockup } from '@/components/brand/logo'
import { LockIcon } from '@/components/brand/icon'

/**
 * The Desk's front door.
 *
 * Deliberately plain: one form, no signup link, no social button, no password
 * reset that could be aimed at an address nobody granted. Anything that could
 * create or recover access without a person deciding it belongs somewhere
 * else.
 */
export function DeskLoginForm() {
  const params = useSearchParams()
  const next     = params.get('next') ?? '/desk'
  const accepted = params.get('accepted') === '1'

  const [state, formAction, pending] = useActionState<DeskAuthState, FormData>(deskLogin, null)

  return (
    <main className="min-h-screen flex items-center justify-center bg-shell px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <BrandLockup />
          <div className="flex items-center gap-1.5 text-tx-3">
            <LockIcon className="size-3.5" />
            <span className="bg-label text-[0.7rem]">Staff only</span>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-card p-6">
          {accepted && (
            <p className="mb-4 rounded-xl border border-line bg-shell p-3 text-sm text-tx-2">
              Your account is set up. Sign in to get going.
            </p>
          )}

          <form action={formAction} className="space-y-4">
            <input type="hidden" name="next" value={next} />

            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required
                     aria-invalid={!!state?.fieldErrors?.email} />
              {state?.fieldErrors?.email && (
                <p className="text-xs text-neg">{state.fieldErrors.email[0]}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required
                     aria-invalid={!!state?.fieldErrors?.password} />
              {state?.fieldErrors?.password && (
                <p className="text-xs text-neg">{state.fieldErrors.password[0]}</p>
              )}
            </div>

            {state?.error && (
              <p className="rounded-xl border border-line p-3 text-sm text-neg" role="alert">
                {state.error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? <><Working className="size-4" /> Signing in</> : 'Sign in'}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-tx-3">
          Access to the Desk is given by invitation. If you need it, ask Emmanuel.
        </p>
      </div>
    </main>
  )
}
