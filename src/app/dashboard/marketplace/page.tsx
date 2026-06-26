import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MarketplaceClient } from './marketplace-client'

export default async function MarketplacePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <MarketplaceClient />
}
