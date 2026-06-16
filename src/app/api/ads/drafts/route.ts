import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const runtime = 'nodejs'

const draftSchema = z.object({
  platform:        z.enum(['meta', 'google', 'tiktok', 'linkedin', 'twitter']),
  headline:        z.string().min(3).max(150),
  body:            z.string().max(500).nullable().optional(),
  cta:             z.string().nullable().optional(),
  destination_url: z.string().url(),
  media_urls:      z.array(z.string()).default([]),
  target_audience: z.record(z.string(), z.unknown()).default({}),
  placement:       z.array(z.string()).default([]),
  budget_daily:    z.number().nullable().optional(),
  budget_total:    z.number().nullable().optional(),
  start_date:      z.string().nullable().optional(),
  end_date:        z.string().nullable().optional(),
})

// POST /api/ads/drafts — create a new ad draft
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await request.json() as unknown
  const parsed = draftSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data
  const serviceClient = await createServiceClient()

  // Resolve brand
  const { data: member } = await serviceClient
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .single()

  if (!member) {
    return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
  }

  const { data: brand } = await serviceClient
    .from('brands')
    .select('id')
    .eq('workspace_id', member.workspace_id)
    .single()

  if (!brand) {
    return NextResponse.json({ error: 'No brand found' }, { status: 400 })
  }

  const { data: draft, error: insertErr } = await serviceClient
    .from('ad_drafts')
    .insert({
      brand_id:        brand.id,
      created_by:      user.id,
      platform:        data.platform,
      headline:        data.headline,
      body:            data.body ?? null,
      cta:             data.cta ?? null,
      destination_url: data.destination_url,
      media_urls:      data.media_urls,
      target_audience: data.target_audience,
      placement:       data.placement,
      budget_daily:    data.budget_daily ?? null,
      budget_total:    data.budget_total ?? null,
      start_date:      data.start_date   ?? null,
      end_date:        data.end_date      ?? null,
      status:          'draft',
    })
    .select('id')
    .single()

  if (insertErr) {
    console.error('[ads-drafts-post] insert error:', insertErr)
    return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 })
  }

  return NextResponse.json({ id: draft.id }, { status: 201 })
}

// GET /api/ads/drafts — list drafts for current brand
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // Use RLS-aware client — policy enforces brand membership
  const { data: drafts, error } = await supabase
    .from('ad_drafts')
    .select('id, platform, headline, status, budget_daily, budget_total, start_date, end_date, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[ads-drafts-get] error:', error)
    return NextResponse.json({ error: 'Failed to fetch drafts' }, { status: 500 })
  }

  return NextResponse.json({ drafts: drafts ?? [] })
}
