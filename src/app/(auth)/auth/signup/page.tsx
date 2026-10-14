'use client'

import { Suspense, useActionState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { signup } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import { Working as Loader2 } from '@/components/brand/working'
import { BrandLockup } from '@/components/brand/logo'

/* `next` comes from the query string, so the page needs a Suspense boundary
   around the part that reads it, the same shape the login page already uses. */
export default function SignupPage() {
  return <Suspense fallback={null}><SignupForm /></Suspense>
}

function SignupForm() {
  const [state, action, pending] = useActionState(signup, null)
  /* Where to go once the account exists. A visitor arriving from a free tool
     carries their report token here, and it has to survive both the email form
     and the Google button. */
  const next = useSearchParams().get('next') ?? ''

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">

        <div className="mb-8">
          <BrandLockup height={20} />
        </div>

        <h1 className="text-2xl font-medium mb-1">Create your account</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {next.startsWith('/tools/claim')
            ? 'Free while we are in open beta. Your report is waiting on the other side.'
            : 'Start understanding your brand in Nigeria and West Africa'}
        </p>

        <GoogleSignInButton next={next || undefined} />

        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-2 text-tx-3">or sign up with email</span>
          </div>
        </div>

        <form id="email-signup-form" action={action} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          {state?.error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
              {state.error}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" name="name" placeholder="Ada Obi" required autoComplete="name" />
            {state?.fieldErrors?.name && (
              <p className="text-xs text-destructive">{state.fieldErrors.name[0]}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Work email</Label>
            <Input id="email" name="email" type="email" placeholder="ada@brand.com" required autoComplete="email" />
            {state?.fieldErrors?.email && (
              <p className="text-xs text-destructive">{state.fieldErrors.email[0]}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" placeholder="8 or more characters" required autoComplete="new-password" />
            {state?.fieldErrors?.password && (
              <p className="text-xs text-destructive">{state.fieldErrors.password[0]}</p>
            )}
          </div>

          <Button className="w-full" type="submit" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 mr-2" /> : null}
            {pending ? 'Creating account...' : 'Create account'}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground text-center mt-5">
          Already have an account?{' '}
          <Link href={next ? `/auth/login?next=${encodeURIComponent(next)}` : '/auth/login'} className="text-foreground font-medium hover:underline">
            Sign in
          </Link>
        </p>

        <p className="text-[11px] text-tx-2 text-center mt-4">
          By signing up you agree to our{' '}
          <Link href="/privacy-policy" className="underline hover:text-muted-foreground">privacy policy</Link>.
        </p>
      </div>
    </div>
  )
}
