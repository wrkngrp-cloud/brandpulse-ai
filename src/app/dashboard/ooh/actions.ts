'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect }       from 'next/navigation'
import { z }              from 'zod'
import { revalidatePath } from 'next/cache'
import { callAi }         from '@/lib/ai/client'

const SiteSchema = z.object({
  site_name:            z.string().min(2, 'Site name required'),
  address:              z.string().optional(),
  city:                 z.string().min(1, 'City required'),
  state:                z.string().optional(),
  country:              z.string().default('Nigeria'),
  format_type:          z.string().optional(),
  illuminated:          z.boolean().default(false),
  lat:                  z.coerce.number().optional(),
  lng:                  z.coerce.number().optional(),
  daily_traffic:        z.coerce.number().int().positive().optional(),
  traffic_ai_estimated: z.boolean().default(false),
  operator:             z.string().optional(),
  weekly_cost:          z.coerce.number().positive().optional(),
  currency:             z.string().length(3).default('NGN'),
  campaign_start:       z.string().optional(),
  campaign_end:         z.string().optional(),
  lga:                  z.string().optional(),
  landing_url:          z.string().url('Landing URL must be a valid URL'),
  vanity_slug:          z.string()
    .min(3, 'Slug must be at least 3 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens'),
  notes:                z.string().optional(),
  qr_enabled:           z.boolean().default(false),
})

type FormState = { error?: string; success?: boolean; siteId?: string } | null

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
}

export async function estimateTraffic(
  formatType: string,
  lga: string,
  city: string,
): Promise<{ traffic: number; reasoning: string } | null> {
  try {
    const response = await callAi({
      tier:   'cultural',
      system: 'You are an OOH media planning expert for Nigeria. Respond ONLY with valid JSON, no markdown.',
      messages: [{
        role:    'user',
        content: `Estimate the average daily vehicle and pedestrian traffic exposure for an OOH advertising site in Nigeria.

Site details:
- Format: ${formatType || 'Billboard'}
- LGA: ${lga || 'Unknown'}
- City: ${city}

Return JSON exactly: {"traffic": <integer>, "reasoning": "<one sentence explanation>"}

Use realistic Nigerian traffic benchmarks. Lagos Island / Victoria Island unipoles: 80,000-150,000. Lekki Phase 1 corridor: 50,000-90,000. Highway billboards outside Lagos: 30,000-70,000. Mall displays: 8,000-25,000. Bridge panels on major Lagos roads: 120,000-200,000.`,
      }],
    })

    const parsed = JSON.parse(response.trim())
    if (typeof parsed.traffic === 'number' && typeof parsed.reasoning === 'string') {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

export async function createSite(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: brand } = await supabase.from('brands').select('id').limit(1).single()
  if (!brand) return { error: 'No brand found' }

  const raw = Object.fromEntries(formData.entries())
  const parsed = SiteSchema.safeParse({
    ...raw,
    illuminated:          raw.illuminated          === 'true' || raw.illuminated          === 'on',
    qr_enabled:           raw.qr_enabled           === 'true' || raw.qr_enabled           === 'on',
    traffic_ai_estimated: raw.traffic_ai_estimated === 'true' || raw.traffic_ai_estimated === 'on',
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { qr_enabled, ...siteData } = parsed.data

  const qrToken = qr_enabled
    ? `qr-${Math.random().toString(36).slice(2, 10)}`
    : null

  const { data: site, error } = await supabase
    .from('ooh_sites')
    .insert({
      ...siteData,
      brand_id:             brand.id,
      qr_token:             qrToken,
      lat:                  siteData.lat           ?? null,
      lng:                  siteData.lng           ?? null,
      daily_traffic:        siteData.daily_traffic ?? null,
      weekly_cost:          siteData.weekly_cost   ?? null,
      campaign_start:       siteData.campaign_start ?? null,
      campaign_end:         siteData.campaign_end   ?? null,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return { error: 'That vanity slug is already taken. Choose another.' }
    return { error: error.message }
  }

  redirect(`/dashboard/ooh/${site.id}`)
}

export async function updateSite(
  siteId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const raw = Object.fromEntries(formData.entries())
  const parsed = SiteSchema.safeParse({
    ...raw,
    illuminated:          raw.illuminated          === 'true' || raw.illuminated          === 'on',
    qr_enabled:           raw.qr_enabled           === 'true' || raw.qr_enabled           === 'on',
    traffic_ai_estimated: raw.traffic_ai_estimated === 'true' || raw.traffic_ai_estimated === 'on',
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { qr_enabled, ...siteData } = parsed.data

  const { error } = await supabase
    .from('ooh_sites')
    .update({
      ...siteData,
      lat:                  siteData.lat           ?? null,
      lng:                  siteData.lng           ?? null,
      daily_traffic:        siteData.daily_traffic ?? null,
      weekly_cost:          siteData.weekly_cost   ?? null,
      campaign_start:       siteData.campaign_start ?? null,
      campaign_end:         siteData.campaign_end   ?? null,
    })
    .eq('id', siteId)

  if (error) {
    if (error.code === '23505') return { error: 'That vanity slug is already taken.' }
    return { error: error.message }
  }

  revalidatePath(`/dashboard/ooh/${siteId}`)
  return { success: true }
}

export async function deleteSite(siteId: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('ooh_sites').delete().eq('id', siteId)
  redirect('/dashboard/ooh')
}
