'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { signup } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import { Loader2, BarChart2 } from 'lucide-react'

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, null)

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-sm">

        <div className="flex items-center gap-2 mb-8">
          <div className="h-7 w-7 rounded-lg bg-foreground flex items-center justify-center">
            <BarChart2 className="h-3.5 w-3.5 text-background" />
          </div>
          <span className="font-bold text-[14px]">BrandPulse AI</span>
        </div>

        <h1 className="text-2xl font-bold mb-1">Create your account</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Start understanding your brand in Nigeria and West Africa
        </p>

        <GoogleSignInButton />

        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-muted/40 px-2 text-muted-foreground">or sign up with email</span>
          </div>
        </div>

        <form id="email-signup-form" action={action} className="space-y-4">
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
            {pending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {pending ? 'Creating account...' : 'Create account'}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground text-center mt-5">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-foreground font-medium hover:underline">
            Sign in
          </Link>
        </p>

        <p className="text-[11px] text-muted-foreground/60 text-center mt-4">
          By signing up you agree to our{' '}
          <Link href="/privacy-policy" className="underline hover:text-muted-foreground">privacy policy</Link>.
        </p>
      </div>
    </div>
  )
}
