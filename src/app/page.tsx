import { redirect }    from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  // Check for at least one named brand (empty-name brand = incomplete onboarding)
  const { data: brands } = await supabase
    .from('brands')
    .select('id, name')
    .limit(5)

  const namedBrand = (brands ?? []).find(b => b.name && b.name.trim() !== '')

  if (!namedBrand) {
    // Logged in but no real brand set up — route through signout so the
    // cookie is properly cleared before sending back to login
    redirect('/api/auth/signout')
  }

  redirect('/dashboard')
}
