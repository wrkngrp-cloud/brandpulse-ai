import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RetentionClient } from './retention-client'

export default async function RetentionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <RetentionClient />
}
