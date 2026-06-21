import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/server'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  if (!stripe) return NextResponse.json({ error: 'Billing not configured' }, { status: 503 })

  const body = await request.text()
  const sig  = request.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  async function updateWorkspace(workspaceId: string, patch: Record<string, unknown>) {
    await supabase.from('workspaces').update(patch).eq('id', workspaceId)
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const workspaceId = session.metadata?.workspace_id
      const plan        = session.metadata?.plan
      if (!workspaceId || !plan) break
      await updateWorkspace(workspaceId, {
        plan,
        stripe_subscription_id: session.subscription as string,
        subscription_status:    'active',
      })
      break
    }

    case 'customer.subscription.updated': {
      const sub         = event.data.object as Stripe.Subscription
      const workspaceId = sub.metadata?.workspace_id
      if (!workspaceId) break
      const plan = sub.metadata?.plan ?? null
      await updateWorkspace(workspaceId, {
        ...(plan ? { plan } : {}),
        subscription_status: sub.status,
        current_period_end:  new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000).toISOString(),
      })
      break
    }

    case 'customer.subscription.deleted': {
      const sub         = event.data.object as Stripe.Subscription
      const workspaceId = sub.metadata?.workspace_id
      if (!workspaceId) break
      await updateWorkspace(workspaceId, {
        plan:                'starter',
        subscription_status: 'canceled',
        stripe_subscription_id: null,
      })
      break
    }

    case 'invoice.payment_failed': {
      const invoice     = event.data.object as Stripe.Invoice
      const customerId  = invoice.customer as string
      const { data: ws } = await supabase
        .from('workspaces').select('id').eq('stripe_customer_id', customerId).maybeSingle()
      if (ws) await updateWorkspace(ws.id, { subscription_status: 'past_due' })
      break
    }
  }

  return NextResponse.json({ received: true })
}
