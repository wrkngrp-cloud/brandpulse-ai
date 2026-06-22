'use server'

import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

export type SettingsState = { error?: string; success?: boolean } | null

// ── Account deletion ─────────────────────────────────────────────────────────

export async function deleteAccount(): Promise<SettingsState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const service = await createServiceClient()

  // Resolve workspace before deleting — cascade stops at workspace_members,
  // so workspaces and brands must be deleted explicitly first.
  const { data: member } = await service
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .single()

  if (member?.workspace_id) {
    // brands → workspace (brands FK workspace_id will cascade once workspace is gone)
    await service.from('brands').delete().eq('workspace_id', member.workspace_id)
    await service.from('workspaces').delete().eq('id', member.workspace_id)
  }

  // Delete auth user — cascades to workspace_members
  const { error } = await service.auth.admin.deleteUser(user.id)
  if (error) return { error: error.message }

  redirect('/auth/login')
}

// ── Profile ───────────────────────────────────────────────────────────────────

export async function updateProfile(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const name = formData.get('name')
  if (typeof name !== 'string' || !name.trim()) return { error: 'Name is required.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } })
  if (error) return { error: error.message }
  return { success: true }
}

export async function changePassword(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const password = formData.get('password')
  const confirm  = formData.get('confirm')
  if (typeof password !== 'string' || password.length < 8)
    return { error: 'Password must be at least 8 characters.' }
  if (password !== confirm) return { error: 'Passwords do not match.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }
  return { success: true }
}

// ── Brand ─────────────────────────────────────────────────────────────────────

const brandSchema = z.object({
  brandName:          z.string().min(1, 'Brand name is required'),
  websiteUrl:         z.string().optional().default(''),
  category:           z.string().min(1, 'Category is required'),
  marketSharePct:     z.number().min(0).max(100).nullable().default(null),
  brandValues:        z.array(z.string()).default([]),
  monitoredHashtags:  z.array(z.string()).default([]),
  brandAliases:       z.array(z.string()).max(10).default([]),
  brandVoice: z.object({
    adjectives:       z.array(z.string()).default([]),
    tone:             z.string().default(''),
    dos:              z.array(z.string()).default([]),
    donts:            z.array(z.string()).default([]),
    signaturePhrases: z.array(z.string()).default([]),
  }),
  culturalProfile: z.object({
    community_corporate: z.number().min(0).max(100).default(50),
    traditional_modern:  z.number().min(0).max(100).default(50),
    religious_secular:   z.number().min(0).max(100).default(50),
    mass_premium:        z.number().min(0).max(100).default(50),
    local_global:        z.number().min(0).max(100).default(50),
  }),
  targetSegments: z.array(z.object({
    name:         z.string(),
    demographics: z.string().optional(),
    geography:    z.string().optional(),
  })).default([]),
})

export type BrandSettingsData = z.infer<typeof brandSchema>

export async function updateBrand(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const payload = formData.get('payload')
  if (!payload || typeof payload !== 'string') return { error: 'Invalid form data.' }

  const parsed = brandSchema.safeParse(JSON.parse(payload))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Validation failed.' }

  const d = parsed.data
  const service = await createServiceClient()

  const { data: member } = await service
    .from('workspace_members').select('workspace_id')
    .eq('user_id', user.id).single()
  if (!member) return { error: 'Workspace not found.' }

  const { data: brand } = await service
    .from('brands').select('id')
    .eq('workspace_id', member.workspace_id).single()
  if (!brand) return { error: 'Brand not found.' }

  const { error } = await service.from('brands').update({
    name:                d.brandName,
    website_url:         d.websiteUrl || null,
    category:            d.category,
    market_share_pct:    d.marketSharePct,
    brand_values:        d.brandValues,
    monitored_hashtags:  d.monitoredHashtags,
    brand_aliases:       d.brandAliases,
    brand_voice:         d.brandVoice,
    cultural_profile:    d.culturalProfile,
    target_segments:     d.targetSegments,
  }).eq('id', brand.id)

  if (error) return { error: error.message }
  return { success: true }
}
