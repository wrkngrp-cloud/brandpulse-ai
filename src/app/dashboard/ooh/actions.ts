'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect }      from 'next/navigation'
import { z }             from 'zod'
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
  monthly_cost:         z.coerce.number().positive().optional(),
  currency:             z.string().length(3).default('NGN'),
  campaign_start:       z.string().optional(),
  campaign_end:         z.string().optional(),
  lga:                  z.string().optional(),
  landing_url:          z.string().url('Landing URL must be a valid URL'),
  vanity_slug:          z.string()
    .min(3, 'Slug must be at least 3 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens'),
  short_code:           z.string()
    .min(2, 'Short code must be at least 2 characters')
    .max(10, 'Short code must be 10 characters or less')
    .regex(/^[a-z0-9]+$/, 'Short code may only contain lowercase letters and numbers')
    .optional(),
  pole_count:           z.coerce.number().int().min(1).default(1).optional(),
  notes:                z.string().optional(),
  qr_enabled:           z.boolean().default(false),
})

type FormState = { error?: string; success?: boolean; siteId?: string; siteName?: string } | null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateShortCode(supabase: any): Promise<string> {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  for (let i = 0; i < 10; i++) {
    const code = Array.from(
      { length: 5 },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join('')
    const { data } = await supabase
      .from('ooh_sites')
      .select('id')
      .eq('short_code', code)
      .maybeSingle()
    if (!data) return code
  }
  // Fallback: timestamp base-36 suffix (always unique)
  return Date.now().toString(36).slice(-6)
}

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
  stateNg: string,
  address: string,
): Promise<{ traffic: number; reasoning: string } | null> {
  try {
    const locationContext = [address, lga, city, stateNg].filter(Boolean).join(', ')
    const response = await callAi({
      tier:   'cultural',
      system: 'You are an OOH media planning expert for Nigeria and West Africa. Respond ONLY with valid JSON, no markdown.',
      messages: [{
        role:    'user',
        content: `Estimate the average daily vehicle and pedestrian traffic exposure for an OOH advertising site.

Site details:
- Format: ${formatType || 'Billboard'}
- Location: ${locationContext || city}

Return JSON exactly: {"traffic": <integer>, "reasoning": "<one sentence explanation referencing the specific location>"}

IMPORTANT: For Lamppole or Lamp Post Banner format, return the per-pole daily traffic — the operator will multiply by pole count separately.

Nigerian traffic benchmarks to guide your estimate:
- Lagos Island / VI / Ikoyi unipoles and bridge panels: 120,000–200,000/day
- Lekki Phase 1 / Admiralty Way: 60,000–100,000/day
- Lekki-Epe Expressway: 40,000–80,000/day
- Ikeja / Allen Avenue / Alausa corridor: 70,000–120,000/day
- Surulere / Mushin / Oshodi: 80,000–130,000/day
- Third Mainland Bridge approaches: 150,000–250,000/day
- Abuja CBD (Wuse, Maitama, CBD): 40,000–80,000/day
- Abuja Airport Road: 30,000–60,000/day
- Port Harcourt GRA / Aba Road: 30,000–60,000/day
- Ibadan Ring Road / Challenge: 40,000–70,000/day
- Kano Kofar Nassarawa / Bompai: 50,000–90,000/day
- Mall displays (Ikeja City Mall, Palms, etc.): 10,000–30,000/day
- Transit shelters in major cities: 20,000–50,000/day
- Lamppole / lamp post — per pole benchmarks:
  · Lagos Island / CMS / Broad St corridor: 12,000–18,000/pole/day
  · Ikeja / Allen / Alausa arterials: 8,000–12,000/pole/day
  · Victoria Island / Eti-Osa side streets: 6,000–10,000/pole/day
  · Lekki Phase 1 / Admiralty Way lamppoles: 4,000–8,000/pole/day
  · Abuja CBD / Wuse 2 / Maitama: 5,000–10,000/pole/day
  · Surulere / Mushin / Oshodi arterials: 7,000–12,000/pole/day`,
      }],
    })

    const cleaned = response.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const parsed = JSON.parse(cleaned)
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

  const { qr_enabled, short_code: rawShortCode, ...siteData } = parsed.data

  const qrToken  = qr_enabled
    ? `qr-${Math.random().toString(36).slice(2, 10)}`
    : null

  const shortCode = rawShortCode || await generateShortCode(supabase)

  const { data: site, error } = await supabase
    .from('ooh_sites')
    .insert({
      ...siteData,
      brand_id:             brand.id,
      status:               'active',
      qr_token:             qrToken,
      short_code:           shortCode,
      lat:                  siteData.lat           ?? null,
      lng:                  siteData.lng           ?? null,
      daily_traffic:        siteData.daily_traffic ?? null,
      monthly_cost:         siteData.monthly_cost  ?? null,
      campaign_start:       siteData.campaign_start ?? null,
      campaign_end:         siteData.campaign_end   ?? null,
      pole_count:           siteData.pole_count    ?? 1,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return { error: 'That vanity slug or short code is already taken. Choose another.' }
    return { error: error.message }
  }

  return { success: true, siteId: site.id, siteName: siteData.site_name }
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

  const { qr_enabled, short_code: rawShortCode, ...siteData } = parsed.data

  const updatePayload: Record<string, unknown> = {
    ...siteData,
    status:        'active',
    lat:           siteData.lat           ?? null,
    lng:           siteData.lng           ?? null,
    daily_traffic: siteData.daily_traffic ?? null,
    monthly_cost:  siteData.monthly_cost  ?? null,
    campaign_start: siteData.campaign_start ?? null,
    campaign_end:  siteData.campaign_end   ?? null,
    pole_count:    siteData.pole_count    ?? 1,
  }
  // Only update short_code if the user explicitly changed it
  if (rawShortCode) updatePayload.short_code = rawShortCode

  const { error } = await supabase
    .from('ooh_sites')
    .update(updatePayload)
    .eq('id', siteId)

  if (error) {
    if (error.code === '23505') return { error: 'That vanity slug is already taken.' }
    return { error: error.message }
  }

  revalidatePath(`/dashboard/ooh/${siteId}`)
  return { success: true, siteId, siteName: parsed.data.site_name }
}

export async function deleteSite(siteId: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('ooh_sites').delete().eq('id', siteId)
  redirect('/dashboard/ooh')
}

// ── Draft auto-save ───────────────────────────────────────────────────────────

const DraftSchema = SiteSchema.partial().extend({
  site_name: z.string().optional(),
  city:      z.string().optional(),
  landing_url: z.string().optional(),
  vanity_slug: z.string().optional(),
})

export type DraftState = { error?: string; draftId?: string } | null

export async function saveDraft(
  draftId: string | null,
  formData: FormData,
): Promise<DraftState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: brand } = await supabase.from('brands').select('id').limit(1).single()
  if (!brand) return { error: 'No brand found' }

  const raw = Object.fromEntries(formData.entries())
  const parsed = DraftSchema.safeParse({
    ...raw,
    illuminated:          raw.illuminated          === 'true' || raw.illuminated          === 'on',
    qr_enabled:           raw.qr_enabled           === 'true' || raw.qr_enabled           === 'on',
    traffic_ai_estimated: raw.traffic_ai_estimated === 'true' || raw.traffic_ai_estimated === 'on',
  })

  // Draft saves are best-effort — don't block on validation
  const draftPayload = {
    brand_id:   brand.id,
    status:     'draft' as const,
    site_name:  (raw.site_name as string) || 'Untitled draft',
    city:       (raw.city as string) || '',
    country:    'Nigeria',
    landing_url: (raw.landing_url as string) || 'https://placeholder.com',
    vanity_slug: (raw.vanity_slug as string) || `draft-${Date.now().toString(36)}`,
    ...(parsed.success ? parsed.data : {}),
    lat:  parsed.success && parsed.data.lat != null ? parsed.data.lat : null,
    lng:  parsed.success && parsed.data.lng != null ? parsed.data.lng : null,
  }

  if (draftId) {
    const { error } = await supabase
      .from('ooh_sites')
      .update(draftPayload)
      .eq('id', draftId)
      .eq('status', 'draft')
    if (error) return { error: error.message }
    return { draftId }
  }

  const { data, error } = await supabase
    .from('ooh_sites')
    .insert(draftPayload)
    .select('id')
    .single()

  if (error) return { error: error.message }
  return { draftId: data.id }
}

export async function discardDraft(draftId: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('ooh_sites').delete().eq('id', draftId).eq('status', 'draft')
}
