'use client'

import { Suspense, useActionState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { resendConfirmation } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { MailIcon } from '@/components/brand/icon'

/**
 * Where signup lands when the account needs its email confirmed. Before this,
 * signup sent people to /onboarding, which bounced them to the sign-in page
 * with no word about the email they had just been sent.
 */
export default function CheckEmailPage() {
  return <Suspense fallback={null}><CheckEmail /></Suspense>
}

function CheckEmail() {
  const email = useSearchParams().get('email') ?? ''
  const [state, action, pending] = useActionState(resendConfirmation, null)
  const sent = state?.error === '__sent__'

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm">
        <Card>
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <MailIcon className="h-10 w-10 mx-auto text-tx" />
            <div className="space-y-1">
              <p className="font-semibold">Check your email</p>
              <p className="text-sm text-muted-foreground">
                We sent a link to {email ? <span className="font-medium text-tx">{email}</span> : 'your inbox'}.
                Click it to confirm your address, and we will take you straight to setting up your brand.
              </p>
              <p className="text-xs text-muted-foreground">Not there after a minute? Look in spam or promotions.</p>
            </div>
            <form action={action} className="space-y-2">
              <input type="hidden" name="email" value={email} />
              {sent && <p className="text-sm text-pos">Sent again. It can take a minute to arrive.</p>}
              {state?.error && !sent && <p className="text-sm text-destructive">{state.error}</p>}
              <Button type="submit" variant="outline" className="w-full" disabled={pending || !email}>
                {pending ? 'Sending...' : 'Send the link again'}
              </Button>
            </form>
            <Link href="/auth/login" className="text-sm text-muted-foreground hover:text-foreground block">
              Already confirmed? Sign in
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
