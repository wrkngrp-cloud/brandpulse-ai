import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const PatchBody = z.object({
  name:     z.string().min(1).max(80).optional(),
  category: z.string().optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const parsed = PatchBody.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  // RLS ensures brand belongs to user's workspace
  const { error } = await supabase.from('brands').update(parsed.data).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Can't delete if it's the only brand
  const { count } = await supabase.from('brands').select('id', { count: 'exact', head: true })
  if ((count ?? 0) <= 1) {
    return NextResponse.json({ error: 'Cannot delete the last brand in a workspace.' }, { status: 400 })
  }

  // Delete through the RLS client so the brands_all policy (is_workspace_member)
  // scopes this to the caller's own workspace — a service-role delete here would
  // let any authenticated user delete another tenant's brand by id.
  const { data: deleted, error } = await supabase
    .from('brands')
    .delete()
    .eq('id', id)
    .select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!deleted || deleted.length === 0) {
    return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
  }

  // Clear active_brand_id if it was pointing to this brand
  const service = await createServiceClient()
  await service.from('workspaces').update({ active_brand_id: null })
    .eq('active_brand_id', id)

  return NextResponse.json({ ok: true })
}
