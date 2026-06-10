'use server'

import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const onboardingSchema = z.object({
  brandName: z.string().min(1, 'Brand name is required'),
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

  // Parse JSON payload sent from the client wizard
  const payload = formData.get('payload')
  if (!payload || typeof payload !== 'string') return { error: 'Invalid form data.' }

  const parsed = onboardingSchema.safeParse(JSON.parse(payload))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Validation failed.' }
  }

  const d = parsed.data
  const service = await createServiceClient()

  // Find the blank brand created during signup
  const { data: brand } = await service
    .from('brands')
    .select('id')
    .eq('workspace_id',
      (await service
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .single()
      ).data?.workspace_id ?? ''
    )
    .single()

  if (!brand) return { error: 'Brand record not found.' }

  const { error } = await service
    .from('brands')
    .update({
      name: d.brandName,
      category: d.category,
      brand_values: d.brandValues,
      brand_voice: d.brandVoice,
      cultural_profile: d.culturalProfile,
      target_segments: d.targetSegments,
    })
    .eq('id', brand.id)

  if (error) return { error: error.message }

  redirect('/dashboard')
}
