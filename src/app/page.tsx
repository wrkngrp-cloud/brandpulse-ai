import { redirect }    from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  // Check for at least one named brand — incomplete onboarding leaves a blank-name brand
  const { data: brands } = await supabase
    .from('brands')
    .select('id, name')
    .not('name', 'eq', '')
    .limit(1)

  if (!brands?.length) {
    // Logged in but no real brand set up — sign out so the login page is the entry point
    await supabase.auth.signOut()
    redirect('/auth/login')
  }

  redirect('/dashboard')
}
