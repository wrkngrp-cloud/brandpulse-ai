import { NextRequest, NextResponse } from 'next/server'
import { createClient }               from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getActiveBrand }             from '@/lib/active-brand'
import { generateDigitalDays }        from '@/lib/demo/digital-performance'

export const runtime = 'nodejs'

// Gated by the shared ADMIN_SECRET env var (fail closed if unset).
const SEED_SECRET = process.env.ADMIN_SECRET

const DEMO_EMAILS = [
  'demo@jarafoods.brandgauge.app',
  'demo@pocketpay.brandgauge.app',
  'demo@bridgercrm.brandgauge.app',
  'demo@pinnaclemedia.brandgauge.app',
]

export async function POST(req: NextRequest) {
  const isAdminSeed = !!SEED_SECRET && req.headers.get('x-seed-secret') === SEED_SECRET

  if (isAdminSeed) {
    // Secret path: seed every demo account, not just the first one.
    const sb = createAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    const { data: users } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 })
    const seeded: { brand: string; rows: number }[] = []
    const failed: { email: string; reason: string }[] = []

    for (const email of DEMO_EMAILS) {
      const demoUser = users?.users?.find(u => u.email === email)
      if (!demoUser) { failed.push({ email, reason: 'user not found' }); continue }

      const { data: member } = await sb
        .from('workspace_members').select('workspace_id')
        .eq('user_id', demoUser.id).limit(1).maybeSingle()
      if (!member) { failed.push({ email, reason: 'no workspace' }); continue }

      const { data: brands } = await sb
        .from('brands').select('id, name')
        .eq('workspace_id', member.workspace_id)
        .order('created_at', { ascending: true })

      for (const brand of brands ?? []) {
        await sb.from('digital_performance_daily').delete().eq('brand_id', brand.id)
        const rows = generateDigitalDays(brand.id, brand.name ?? 'Demo brand')
        const { error } = await sb.from('digital_performance_daily').insert(rows)
        if (error) { failed.push({ email, reason: error.message }); continue }
        seeded.push({ brand: brand.name ?? brand.id, rows: rows.length })
      }
    }

    return NextResponse.json({ success: failed.length === 0, seeded, failed })
  }

  // Session path: the signed-in user seeds their own active brand.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!DEMO_EMAILS.includes(user.email ?? '')) {
    return NextResponse.json({ error: 'Not a demo account' }, { status: 403 })
  }

  // Always the active brand, never the first row: a multi-brand workspace would
  // otherwise seed whichever brand happened to be created first.
  const brand = await getActiveBrand<{ id: string; name: string }>(supabase, 'id, name')
  if (!brand) return NextResponse.json({ error: 'No active brand' }, { status: 404 })

  const since = new Date()
  since.setDate(since.getDate() - 30)
  const { data: existing } = await supabase
    .from('digital_performance_daily').select('id')
    .eq('brand_id', brand.id)
    .gte('date', since.toISOString().slice(0, 10))
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ success: true, skipped: true, message: 'Demo data already exists' })
  }

  const rows = generateDigitalDays(brand.id, brand.name ?? 'Demo brand')
  const { error } = await supabase.from('digital_performance_daily').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, inserted: rows.length, brand_id: brand.id })
}
