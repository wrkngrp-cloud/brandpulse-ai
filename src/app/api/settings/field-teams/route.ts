import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data: teams, error } = await supabase
    .from('fso_teams')
    .select('id, name, token, active, notes, created_at')
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ teams: teams ?? [] })
}

export async function POST(request: NextRequest) {
  const { name, notes } = await request.json() as { name: string; notes?: string | null }

  if (!name?.trim()) {
    return Response.json({ error: 'Name is required' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: brand } = await supabase
    .from('brands')
    .select('id, workspace_id')
    .limit(1)
    .single()

  if (!brand) return Response.json({ error: 'No brand found' }, { status: 400 })

  const { data: team, error } = await supabase
    .from('fso_teams')
    .insert({
      brand_id:     brand.id,
      workspace_id: brand.workspace_id,
      name:         name.trim(),
      notes:        notes ?? null,
    })
    .select('id, name, token, active, notes, created_at')
    .single()

  if (error || !team) return Response.json({ error: error?.message ?? 'Failed' }, { status: 500 })
  return Response.json({ team })
}

export async function PATCH(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  const { active } = await request.json() as { active: boolean }
  const supabase = await createClient()

  const { error } = await supabase
    .from('fso_teams')
    .update({ active })
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
