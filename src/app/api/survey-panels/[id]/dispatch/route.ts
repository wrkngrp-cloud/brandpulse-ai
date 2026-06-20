import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { inngest } from '@/lib/inngest/client'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: panel } = await supabase
    .from('survey_panels')
    .select('*')
    .eq('id', id)
    .single()

  if (!panel) return NextResponse.json({ error: 'Panel not found' }, { status: 404 })

  await inngest.send({
    name: 'panel/dispatch',
    data: { panelId: panel.id },
  })

  return NextResponse.json({ ok: true, message: 'Dispatch queued.' })
}
