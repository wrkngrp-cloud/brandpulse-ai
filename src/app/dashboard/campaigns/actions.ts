'use server'

import { createClient }  from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z }             from 'zod'

const CampaignSchema = z.object({
  name:         z.string().min(2, 'Campaign name required'),
  description:  z.string().optional(),
  objective:    z.enum(['awareness', 'consideration', 'conversion', 'retention']).optional(),
  start_date:   z.string().optional(),
  end_date:     z.string().optional(),
  total_budget: z.coerce.number().positive().optional(),
  currency:     z.string().length(3).default('NGN'),
  channels:     z.array(z.enum(['ooh', 'events', 'digital', 'radio', 'tv', 'print'])).optional(),
  // per-channel budget allocations as JSON string
  channel_budgets: z.string().optional(),
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

  const channels = formData.getAll('channels') as string[]
  const parsed = CampaignSchema.safeParse({ ...raw, channels })

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { channels: selectedChannels, channel_budgets: channelBudgetsJson, ...campaignData } = parsed.data

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .insert({
      ...campaignData,
      brand_id:     brand.id,
      status:       'active',
      start_date:   campaignData.start_date   || null,
      end_date:     campaignData.end_date     || null,
      total_budget: campaignData.total_budget ?? null,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  // Insert channel rows
  if (selectedChannels?.length) {
    let channelBudgets: Record<string, number> = {}
    try {
      if (channelBudgetsJson) channelBudgets = JSON.parse(channelBudgetsJson)
    } catch { /* ignore */ }

    await supabase.from('campaign_channels').insert(
      selectedChannels.map(ch => ({
        campaign_id:       campaign.id,
        channel:           ch,
        budget_allocation: channelBudgets[ch] ?? null,
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
