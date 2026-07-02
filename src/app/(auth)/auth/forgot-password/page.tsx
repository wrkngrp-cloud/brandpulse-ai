'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { forgotPassword } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2 } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(forgotPassword, null)
  const sent = state?.error === '__sent__'

  const shell = (c: React.ReactNode) => (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm">{c}</div>
    </div>
  )

  if (sent) {
    return shell(
      <Card>
        <CardContent className="pt-8 pb-6 text-center space-y-4">
          <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
          <div className="space-y-1">
            <p className="font-semibold">Check your inbox</p>
            <p className="text-sm text-muted-foreground">
              We sent a password reset link to your email. It expires in 1 hour.
            </p>
          </div>
          <Link
            href="/auth/login"
            className="text-sm text-primary hover:underline block"
          >
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    )
  }

  return shell(
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Forgot password?</CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send you a reset link.
        </CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="space-y-4">
          {state?.error && state.error !== '__sent__' && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {state.error}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="you@brand.com" required />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button className="w-full" type="submit" disabled={pending}>
            {pending ? 'Sending…' : 'Send reset link'}
          </Button>
          <Link
            href="/auth/login"
            className="text-sm text-muted-foreground hover:text-foreground text-center transition-colors"
          >
            Back to sign in
          </Link>
        </CardFooter>
      </form>
    </Card>
  )
}


