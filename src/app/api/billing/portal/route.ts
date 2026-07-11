import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

const APP_URL = process.env.APP_URL ?? 'https://brandpulse-ai-tau.vercel.app'

export async function POST() {
  if (!stripe) return NextResponse.json({ error: 'Billing not configured.' }, { status: 503 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = await createServiceClient()
  const { data: workspace } = await service
    .from('workspace_members').select('workspaces(id, stripe_customer_id)')
    .eq('user_id', user.id).limit(1).single()

  const ws = (workspace?.workspaces as unknown as { id: string; stripe_customer_id: string | null } | null)
  if (!ws?.stripe_customer_id) {
    return NextResponse.json({ error: 'No billing account found. Subscribe to a plan first.' }, { status: 404 })
  }

  const session = await stripe.billingPortal.sessions.create({
    customer:   ws.stripe_customer_id,
    return_url: `${APP_URL}/dashboard/settings/billing`,
  })

  return NextResponse.json({ url: session.url })
}
