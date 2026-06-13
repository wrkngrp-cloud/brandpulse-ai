'use server'

import { createClient }  from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z }             from 'zod'

const CampaignSchema = z.object({
  name:           z.string().min(2, 'Campaign name required'),
  description:    z.string().optional(),
  start_date:     z.string().optional(),
  end_date:       z.string().optional(),
  total_budget:   z.coerce.number().positive().optional(),
  currency:       z.string().length(3).default('NGN'),
  objectives:     z.array(z.enum(['awareness', 'consideration', 'conversion', 'retention'])).optional(),
  channels:       z.array(z.enum(['ooh', 'events', 'digital', 'radio', 'tv', 'print'])).optional(),
  // JSON: { [channel]: { budget: number|null, objectives: string[] } }
  channel_config: z.string().optional(),
})

export type CampaignFormState = {
  error?: string
  success?: boolean
  campaignId?: string
  campaignName?: string
} | null

export async function createCampaign(
  _prev: CampaignFormState,
  formData: FormData,
): Promise<CampaignFormState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: brand } = await supabase.from('brands').select('id').limit(1).single()
  if (!brand) return { error: 'No brand found' }

  const raw = Object.fromEntries(formData.entries())

  const channels   = formData.getAll('channels') as string[]
  const objectives = formData.getAll('objectives') as string[]
  const parsed = CampaignSchema.safeParse({ ...raw, channels, objectives })

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { channels: selectedChannels, objectives: campaignObjectives, channel_config: channelConfigJson, ...campaignData } = parsed.data

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .insert({
      ...campaignData,
      brand_id:     brand.id,
      status:       'active',
      objectives:   campaignObjectives ?? [],
      start_date:   campaignData.start_date   || null,
      end_date:     campaignData.end_date     || null,
      total_budget: campaignData.total_budget ?? null,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  // Insert channel rows with per-channel budget and objective links
  if (selectedChannels?.length) {
    type ChannelCfg = { budget: number | null; objectives: string[] }
    let channelConfig: Record<string, ChannelCfg> = {}
    try {
      if (channelConfigJson) channelConfig = JSON.parse(channelConfigJson)
    } catch { /* ignore */ }

    await supabase.from('campaign_channels').insert(
      selectedChannels.map(ch => ({
        campaign_id:       campaign.id,
        channel:           ch,
        budget_allocation: channelConfig[ch]?.budget ?? null,
        objectives:        channelConfig[ch]?.objectives ?? [],
      }))
    )
  }

  revalidatePath('/dashboard/campaigns')
  return { success: true, campaignId: campaign.id, campaignName: campaignData.name }
}

export async function updateCampaignStatus(
  campaignId: string,
  status: 'draft' | 'active' | 'paused' | 'completed',
): Promise<void> {
  const supabase = await createClient()
  await supabase.from('campaigns').update({ status }).eq('id', campaignId)
  revalidatePath(`/dashboard/campaigns/${campaignId}`)
  revalidatePath('/dashboard/campaigns')
}

export async function deleteCampaign(campaignId: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('campaigns').delete().eq('id', campaignId)
  revalidatePath('/dashboard/campaigns')
}

export async function linkOohSiteToCampaign(
  siteId: string,
  campaignId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('ooh_sites')
    .update({ campaign_id: campaignId })
    .eq('id', siteId)
  if (error) return { error: error.message }
  revalidatePath(`/dashboard/campaigns/${campaignId}`)
  revalidatePath('/dashboard/ooh')
  return {}
}

export async function unlinkOohSiteFromCampaign(
  siteId: string,
  campaignId: string,
): Promise<void> {
  const supabase = await createClient()
  await supabase.from('ooh_sites').update({ campaign_id: null }).eq('id', siteId)
  revalidatePath(`/dashboard/campaigns/${campaignId}`)
  revalidatePath('/dashboard/ooh')
}

export async function linkEventToCampaign(
  eventId: string,
  campaignId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('events')
    .update({ campaign_id: campaignId })
    .eq('id', eventId)
  if (error) return { error: error.message }
  revalidatePath(`/dashboard/campaigns/${campaignId}`)
  revalidatePath('/dashboard/events')
  return {}
}

export async function unlinkEventFromCampaign(
  eventId: string,
  campaignId: string,
): Promise<void> {
  const supabase = await createClient()
  await supabase.from('events').update({ campaign_id: null }).eq('id', eventId)
  revalidatePath(`/dashboard/campaigns/${campaignId}`)
  revalidatePath('/dashboard/events')
}
