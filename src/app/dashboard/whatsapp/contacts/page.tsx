import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getActiveBrand } from '@/lib/active-brand'
import { ContactsClient } from './contacts-client'

export const dynamic = 'force-dynamic'

export default async function WhatsAppContactsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const brand = await getActiveBrand<{ id: string; name: string }>(supabase, 'id, name')
  if (!brand?.id) redirect('/dashboard/whatsapp')

  const [totalRes, optedInRes, contactsRes] = await Promise.all([
    supabase.from('whatsapp_contacts').select('id', { count: 'exact', head: true }).eq('brand_id', brand.id),
    supabase.from('whatsapp_contacts').select('id', { count: 'exact', head: true }).eq('brand_id', brand.id).eq('whatsapp_opted_in', true),
    supabase.from('whatsapp_contacts')
      .select('id, phone_e164, name, whatsapp_opted_in, opted_in_at, opted_out_at, created_at')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  return (
    <ContactsClient
      totalCount={totalRes.count ?? 0}
      optedInCount={optedInRes.count ?? 0}
      contacts={(contactsRes.data ?? []) as Contact[]}
    />
  )
}

export interface Contact {
  id: string
  phone_e164: string
  name: string | null
  whatsapp_opted_in: boolean
  opted_in_at: string | null
  opted_out_at: string | null
  created_at: string
}
