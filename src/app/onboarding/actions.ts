'use server'

import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { safeNext } from '@/lib/safe-next'
import { GOAL_IDS } from '@/lib/goals'
import { brandTypeForIndustry } from '@/lib/bhi'

const onboardingSchema = z.object({
  websiteUrl: z.string().optional().default(''),
  brandName: z.string().min(1, 'Brand name is required'),
  industry: z.string().min(1, 'Industry is required'),
  category: z.string().min(1, 'Category is required'),
  brandValues: z.array(z.string()).default([]),
  brandVoice: z.object({
    adjectives: z.array(z.string()).default([]),
    tone: z.string().default(''),
    dos: z.array(z.string()).default([]),
    donts: z.array(z.string()).default([]),
    signaturePhrases: z.array(z.string()).default([]),
  }),
  culturalProfile: z.object({
    community_corporate: z.number().min(0).max(100).default(50),
    traditional_modern: z.number().min(0).max(100).default(50),
    religious_secular: z.number().min(0).max(100).default(50),
    mass_premium: z.number().min(0).max(100).default(50),
    local_global: z.number().min(0).max(100).default(50),
  }),
  targetSegments: z.array(z.object({
    name: z.string(),
    demographics: z.string().optional(),
    geography: z.string().optional(),
  })).default([]),
  focusGoals: z.array(z.enum(GOAL_IDS)).default([]),
})

export type OnboardingData = z.infer<typeof onboardingSchema>
export type OnboardingState = { error?: string } | null

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const payload = formData.get('payload')
  if (!payload || typeof payload !== 'string') return { error: 'Invalid form data.' }

  const parsed = onboardingSchema.safeParse(JSON.parse(payload))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Validation failed.' }
  }

  const d = parsed.data

  // The blank brand signup made for this user, found through RLS so it can
  // only be one of their own. This used to read the user's workspace with
  // .single(), which errors for anyone in two workspaces, and then said
  // "Brand record not found".
  const { data: brand } = await supabase
    .from('brands')
    .select('id')
    .eq('name', '')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!brand) return { error: 'We could not find the brand to set up. Sign out and in again, then try once more.' }
  const service = await createServiceClient()

  const { error } = await service
    .from('brands')
    .update({
      name:             d.brandName,
      website_url:      d.websiteUrl || null,
      industry:         d.industry,
      // The scoring vertical. Never set before, so every brand scored as FMCG.
      brand_type:       brandTypeForIndustry(d.industry),
      category:         d.category,
      brand_values:     d.brandValues,
      brand_voice:      d.brandVoice,
      cultural_profile: d.culturalProfile,
      target_segments:  d.targetSegments,
    })
    .eq('id', brand.id)

  if (error) return { error: error.message }

  /* What they came to do. A separate write so that, before the focus
     migration is applied, a missing column costs the focused sidebar and not
     the whole of onboarding: the brand is saved either way, and the full
     sidebar is the fallback. */
  if (d.focusGoals.length) {
    const { error: focusError } = await service
      .from('brands')
      .update({ focus_goals: d.focusGoals, show_all_modules: false })
      .eq('id', brand.id)
    if (focusError) console.error('[onboarding] could not save focus goals:', focusError.message)
  }

  // A free-tool visitor goes back to their own report, now that a brand
  // exists for it to attach to. Everyone else goes to the dashboard.
  redirect(safeNext(formData.get('next')))
}
