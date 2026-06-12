import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: runs } = await supabase
    .from('crawl_runs')
    .select('id, trigger_type, status, mentions_found, classified, started_at, completed_at, error_message')
    .order('started_at', { ascending: false })
    .limit(30)

  return NextResponse.json(runs ?? [])
}
