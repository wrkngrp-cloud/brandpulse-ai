import { createClient } from '@/lib/supabase/server'
import { ProfileForm } from './profile-form'

export const dynamic = 'force-dynamic'

export default async function ProfileSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const name  = (user?.user_metadata?.full_name as string | undefined) ?? ''
  const email = user?.email ?? ''

  return (
    <div className="space-y-8">
      <ProfileForm name={name} email={email} />
    </div>
  )
}
