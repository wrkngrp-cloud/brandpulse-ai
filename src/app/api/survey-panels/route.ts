import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const CreateBody = z.object({
  name:             z.string().min(1).max(120),
  template_key:     z.string().min(1),
  cadence:          z.enum(['monthly', 'quarterly']),
  recipient_emails: z.array(z.string().email()).default([]),
  recipient_phones: z.array(z.string()).default([]),
})

function nextRunAt(cadence: 'monthly' | 'quarterly'): Date {
  const d = new Date()
  if (cadence === 'monthly') {
    d.setMonth(d.getMonth() + 1)
    d.setDate(1)
  } else {
    d.setMonth(d.getMonth() + 3)
    d.setDate(1)
  }
  d.setHours(9, 0, 0, 0) // 9am
  return d
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: brand } = await supabase.from('brands').select('id').limit(1).single()
  if (!brand) return NextResponse.json({ panels: [] })

  const { data: panels } = await supabase
    .from('survey_panels')
    .select('*')
    .eq('brand_id', brand.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ panels: panels ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = CreateBody.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { data: brand } = await supabase.from('brands').select('id').limit(1).single()
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const { data: member } = await supabase.from('workspace_members')
    .select('workspace_id').eq('user_id', user.id).limit(1).single()

  const { data: panel, error } = await supabase.from('survey_panels').insert({
    brand_id:         brand.id,
    workspace_id:     member?.workspace_id,
    name:             parsed.data.name,
    template_key:     parsed.data.template_key,
    cadence:          parsed.data.cadence,
    recipient_emails: parsed.data.recipient_emails,
    recipient_phones: parsed.data.recipient_phones,
    next_run_at:      nextRunAt(parsed.data.cadence).toISOString(),
    active:           true,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ panel })
}
