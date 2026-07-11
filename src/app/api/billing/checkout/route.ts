import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { stripe, STRIPE_PRICES } from '@/lib/stripe'
import { z } from 'zod'

const Body = z.object({ plan: z.enum(['growth', 'pro', 'agency', 'enterprise']) })
const APP_URL = process.env.APP_URL ?? 'https://brandpulse-ai-tau.vercel.app'

export async function POST(request: NextRequest) {
  if (!stripe) return NextResponse.json({ error: 'Billing not configured.' }, { status: 503 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = Body.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const priceId = STRIPE_PRICES[parsed.data.plan]
  if (!priceId) return NextResponse.json({ error: 'Price not configured for this plan.' }, { status: 503 })

  const service = await createServiceClient()
  const { data: workspace } = await service
    .from('workspace_members').select('workspaces(id, name, stripe_customer_id)')
    .eq('user_id', user.id).limit(1).single()

  const ws = (workspace?.workspaces as unknown as { id: string; name: string; stripe_customer_id: string | null } | null)
  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  let customerId = ws.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email:    user.email,
      name:     ws.name,
      metadata: { workspace_id: ws.id },
    })
    customerId = customer.id
    await service.from('workspaces').update({ stripe_customer_id: customerId }).eq('id', ws.id)
  }

  const session = await stripe.checkout.sessions.create({
    customer:             customerId,
    mode:                 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${APP_URL}/dashboard/settings/billing?success=1`,
    cancel_url:  `${APP_URL}/dashboard/settings/billing?canceled=1`,
    metadata:    { workspace_id: ws.id, plan: parsed.data.plan },
    subscription_data: {
      metadata: { workspace_id: ws.id, plan: parsed.data.plan },
    },
  })

  return NextResponse.json({ url: session.url })
}
