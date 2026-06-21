import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const Body = z.object({
  brandId:   z.string().uuid(),
  label:     z.string().min(1).max(80).default('Client portal'),
  sections:  z.array(z.string()).default(['bhi','sentiment','sov','monthly_report']),
  expiresAt: z.string().datetime().optional(),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('portal_tokens')
    .select('id, token, label, sections, expires_at, last_accessed, created_at, brands(name)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tokens: data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = Body.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  // Verify brand belongs to user's workspace
  const { data: brand } = await supabase.from('brands').select('id, workspace_id').eq('id', parsed.data.brandId).maybeSingle()
  if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 })

  const service = await createServiceClient()
  const { data, error } = await service.from('portal_tokens').insert({
    workspace_id: brand.workspace_id,
    brand_id:     brand.id,
    label:        parsed.data.label,
    sections:     parsed.data.sections,
    expires_at:   parsed.data.expiresAt ?? null,
    created_by:   user.id,
  }).select('id, token, label').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
