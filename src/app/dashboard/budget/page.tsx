import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BudgetClient } from './budget-client'

export default async function BudgetPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <BudgetClient />
}
