import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdvocacyClient } from './advocacy-client'

export default async function AdvocacyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <AdvocacyClient />
}
