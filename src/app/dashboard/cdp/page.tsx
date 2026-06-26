import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CdpClient } from './cdp-client'

export default async function CdpPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <CdpClient />
}
