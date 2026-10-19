import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getStaffSession } from '@/lib/desk/auth'
import { deskHref } from '@/lib/desk/urls'
import { DeskLoginForm } from './login-form'

export const dynamic = 'force-dynamic'

export default async function DeskLoginPage() {
  // Somebody already signed in and already staff does not need to see this.
  if (await getStaffSession()) redirect(await deskHref('/desk'))

  return (
    <Suspense>
      <DeskLoginForm />
    </Suspense>
  )
}
