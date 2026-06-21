import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const Body = z.object({
  name:     z.string().min(1).max(80),
  category: z.string().optional(),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('brands')
    .select('id, name, category, logo_url, created_at')
    .order('created_at', { ascending: true })

  return NextResponse.json({ brands: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = Body.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  // Get workspace
  const service = await createServiceClient()
  const { data: member } = await service
    .from('workspace_members').select('workspace_id, workspaces(plan)')
    .eq('user_id', user.id).limit(1).single()
  if (!member) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const workspaceId = member.workspace_id
  const plan = (member.workspaces as unknown as { plan: string } | null)?.plan ?? 'starter'

  // Check plan brand limit
  const { data: planRow } = await service.from('plan_limits').select('brand_count').eq('plan', plan).single()
  const limit = planRow?.brand_count ?? 1
  if (limit !== -1) {
    const { count } = await supabase.from('brands').select('id', { count: 'exact', head: true })
    if ((count ?? 0) >= limit) {
      return NextResponse.json({
        error: `Your ${plan} plan supports up to ${limit} brand${limit === 1 ? '' : 's'}. Upgrade to add more.`,
        upgrade: true,
      }, { status: 403 })
    }
  }

  const { data, error } = await service.from('brands').insert({
    workspace_id:     workspaceId,
    name:             parsed.data.name,
    category:         parsed.data.category ?? null,
    cultural_profile: {},
    brand_values:     [],
    target_segments:  [],
    brand_voice:      {},
    bhi_weights:      {},
  }).select('id, name, category').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
