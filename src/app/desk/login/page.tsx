import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getStaffSession } from '@/lib/desk/auth'
import { deskHref } from '@/lib/desk/urls'
import { DeskLoginForm } from './login-form'

export const dynamic = 'force-dynamic'

export default async function DeskLoginPage() {
  // Somebody already signed in and already staff does not need to see this.
  if (await getStaffSession()) redirect(await deskHref('/desk'))

  // Read here rather than in the form: the form is a client component and the
  // main host's address is server configuration.
  const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')

  return (
    <Suspense>
      <DeskLoginForm appUrl={appUrl} />
    </Suspense>
  )
}
