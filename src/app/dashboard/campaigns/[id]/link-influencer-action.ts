'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function linkInfluencerToCampaign(influencerId: string, campaignId: string) {
  const supabase = await createClient()
  await supabase.from('influencers').update({ campaign_id: campaignId }).eq('id', influencerId)
  revalidatePath(`/dashboard/campaigns/${campaignId}`)
}
