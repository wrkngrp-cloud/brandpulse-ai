import { redirect }    from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { LandingPage }  from '@/components/landing/landing-page'

export const metadata: Metadata = {
  title: 'BrandGauge — Brand intelligence for West African marketers',
  description: 'Read sentiment in Pidgin, Yoruba, Igbo and Hausa, measure every channel from Instagram to billboards, and turn it into numbers your board will trust.',
}

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return <LandingPage />

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
