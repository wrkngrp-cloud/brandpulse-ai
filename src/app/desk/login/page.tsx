import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getStaffSession } from '@/lib/desk/auth'
import { DeskLoginForm } from './login-form'

export const dynamic = 'force-dynamic'

export default async function DeskLoginPage() {
  // Somebody already signed in and already staff does not need to see this.
  if (await getStaffSession()) redirect('/desk')

  return (
    <Suspense>
      <DeskLoginForm />
    </Suspense>
  )
}
