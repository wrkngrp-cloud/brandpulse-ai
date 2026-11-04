'use server'

import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getActiveBrandId } from '@/lib/active-brand'
import { GOAL_IDS } from '@/lib/goals'

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
  googlePlaceId:      z.string().optional().default(''),
  g2Slug:             z.string().optional().default(''),
  capterraSlug:       z.string().optional().default(''),
  githubRepo:         z.string().optional().default(''),
  npmPackageName:     z.string().optional().default(''),
  stackoverflowTag:   z.string().optional().default(''),
  category:           z.string().min(1, 'Category is required'),
  brandType:          z.enum(['fmcg','fintech','venue','b2b_saas','marketplace','beverage_alcohol','b2b_distribution','agency']).default('fmcg'),
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

  // The active brand resolves through the RLS client, so it is one the caller
  // can see. The service write below is scoped to that id only, which keeps
  // multi-brand and multi-workspace users editing the brand they are looking at.
  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return { error: 'Set up a brand before you save these settings.' }

  const { error } = await service.from('brands').update({
    name:                d.brandName,
    website_url:         d.websiteUrl || null,
    google_place_id:     d.googlePlaceId?.trim() || null,
    g2_slug:             d.g2Slug?.trim() || null,
    capterra_slug:       d.capterraSlug?.trim() || null,
    github_repo:         d.githubRepo?.trim() || null,
    npm_package_name:    d.npmPackageName?.trim() || null,
    stackoverflow_tag:   d.stackoverflowTag?.trim() || null,
    category:            d.category,
    brand_type:          d.brandType,
    market_share_pct:    d.marketSharePct,
    brand_values:        d.brandValues,
    monitored_hashtags:  d.monitoredHashtags,
    brand_aliases:       d.brandAliases,
    brand_voice:         d.brandVoice,
    cultural_profile:    d.culturalProfile,
    target_segments:     d.targetSegments,
  }).eq('id', brandId)

  if (error) return { error: error.message }
  return { success: true }
}

// ── Modules: what this brand chose to see ──────────────────────────────────

const focusSchema = z.object({
  goals:   z.array(z.enum(GOAL_IDS)).max(GOAL_IDS.length),
  showAll: z.boolean(),
})

/** Saves which modules the active brand's sidebar shows. Runs on the RLS
 *  client: brands_all already limits it to the caller's own workspace. */
export async function saveModuleFocus(input: { goals: string[]; showAll: boolean }): Promise<SettingsState> {
  const parsed = focusSchema.safeParse(input)
  if (!parsed.success) return { error: 'That choice did not save. Try again.' }
  const { goals, showAll } = parsed.data
  if (!showAll && goals.length === 0) return { error: 'Pick at least one, or show every module.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You are signed out. Sign in and try again.' }

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return { error: 'We could not find your brand.' }

  const { error } = await supabase
    .from('brands')
    .update({ focus_goals: [...new Set(goals)], show_all_modules: showAll })
    .eq('id', brandId)
  if (error) {
    console.error('[settings] saveModuleFocus failed:', error.message)
    return { error: 'This setting is not switched on for your account yet. Check back soon.' }
  }

  revalidatePath('/dashboard', 'layout')
  return { success: true }
}
