import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getActiveBrand } from '@/lib/active-brand'
import { WhatsAppClient } from './whatsapp-client'

export const dynamic = 'force-dynamic'

export default async function WhatsAppPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const brand = await getActiveBrand<{ id: string; name: string }>(supabase, 'id, name')

  const configured = !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)

  let stats = { contactCount: 0, optedInCount: 0, campaignCount: 0, avgDeliveryRate: 0, avgReadRate: 0 }
  let campaigns: Campaign[] = []

  if (brand?.id) {
    const [contactRes, optedRes, campaignRes] = await Promise.all([
      supabase.from('whatsapp_contacts').select('id', { count: 'exact', head: true }).eq('brand_id', brand.id),
      supabase.from('whatsapp_contacts').select('id', { count: 'exact', head: true }).eq('brand_id', brand.id).eq('whatsapp_opted_in', true),
      supabase.from('whatsapp_campaigns')
        .select('id, name, objective, template_name, list_size, sent, delivered, read_count, failed, status, created_at')
        .eq('brand_id', brand.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    const allCampaigns = (campaignRes.data ?? []) as Campaign[]
    const sentCampaigns = allCampaigns.filter(c => c.status === 'sent' && c.sent > 0)

    const avgDelivery = sentCampaigns.length
      ? sentCampaigns.reduce((s, c) => s + (c.delivered / c.sent), 0) / sentCampaigns.length
      : 0

    const avgRead = sentCampaigns.length
      ? sentCampaigns.reduce((s, c) => s + (c.read_count / c.sent), 0) / sentCampaigns.length
      : 0

    stats = {
      contactCount:    contactRes.count  ?? 0,
      optedInCount:    optedRes.count    ?? 0,
      campaignCount:   sentCampaigns.length,
      avgDeliveryRate: Math.round(avgDelivery * 100),
      avgReadRate:     Math.round(avgRead * 100),
    }
    campaigns = allCampaigns
  }

  return (
    <WhatsAppClient
      brandName={brand?.name ?? ''}
      configured={configured}
      stats={stats}
      campaigns={campaigns}
    />
  )
}

export interface Campaign {
  id: string
  name: string
  objective: string
  template_name: string
  list_size: number
  sent: number
  delivered: number
  read_count: number
  failed: number
  status: string
  created_at: string
}
