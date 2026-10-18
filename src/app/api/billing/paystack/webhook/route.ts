import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * BrandGauge's own subscription billing, from Paystack.
 *
 * Not to be confused with `/api/webhooks/paystack`, which is a tenant's own
 * customer payments feeding their funnel. That one verifies against a
 * per-brand secret stored in `webhook_configs`. This one is our merchant
 * account and verifies against our own `PAYSTACK_SECRET_KEY`.
 *
 * **Built and deliberately unregistered.** Billing is deferred until
 * post-beta, so nothing points at this URL yet and the same tables are filled
 * by hand from the Desk meanwhile. Switching it on is one URL in the Paystack
 * dashboard and one environment variable, with no code change and no
 * migration.
 *
 * Three things worth noting about the shape:
 *
 * It fails closed. With no secret set it answers 503 rather than accepting
 * unverified events, because a billing webhook that trusts an unsigned body
 * is a way to grant anybody a subscription.
 *
 * The signature is compared with `timingSafeEqual` over the raw body, before
 * the JSON is parsed. The tenant handler compares with `===`, which is on the
 * build list to fix; this one does not inherit that.
 *
 * It is idempotent. Paystack retries, and `provider_ref` is unique on both
 * tables, so a replayed event updates the row it already wrote instead of
 * creating a second subscription that would double the MRR.
 */

function verify(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false
  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex')
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(signature, 'utf8')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

/** Paystack counts in kobo. Every column here is whole naira. */
const toNaira = (kobo: unknown): number => Math.round(Number(kobo ?? 0) / 100)

type Json = Record<string, unknown>

export async function POST(request: NextRequest) {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) {
    return NextResponse.json(
      { error: 'Subscription billing is not configured.' }, { status: 503 },
    )
  }

  const rawBody = await request.text()
  if (!verify(rawBody, request.headers.get('x-paystack-signature'), secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let event: Json
  try {
    event = JSON.parse(rawBody) as Json
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const kind = String(event.event ?? '')
  const data = (event.data ?? {}) as Json
  const service = await createServiceClient()

  // Which account this is for. Paystack carries whatever we put in metadata at
  // checkout, so workspace_id is the link; an event without one cannot be
  // placed and is acknowledged rather than retried forever.
  const metadata    = (data.metadata ?? {}) as Json
  const workspaceId = typeof metadata.workspace_id === 'string' ? metadata.workspace_id : null

  if (!workspaceId) {
    return NextResponse.json({ received: true, note: 'no workspace in metadata' })
  }

  const { data: workspace } = await service
    .from('workspaces').select('id, plan').eq('id', workspaceId).maybeSingle()
  if (!workspace) {
    return NextResponse.json({ received: true, note: 'unknown workspace' })
  }

  switch (kind) {
    case 'subscription.create':
    case 'subscription.enable': {
      const code = String(data.subscription_code ?? '')
      if (!code) break
      const plan = (data.plan as Json | undefined) ?? {}

      await service.from('subscriptions').upsert({
        workspace_id: workspaceId,
        // The plan name Paystack sends has to match a plan_limits row, which is
        // a foreign key, so an unrecognised one falls back to what the
        // workspace already has rather than failing the whole event.
        plan:         typeof plan.name === 'string' ? plan.name.toLowerCase() : workspace.plan,
        amount_ngn:   toNaira(plan.amount ?? data.amount),
        interval:     plan.interval === 'annually' ? 'year' : 'month',
        status:       'active',
        provider:     'paystack',
        provider_ref: code,
        current_period_end: typeof data.next_payment_date === 'string'
          ? data.next_payment_date.slice(0, 10)
          : null,
      }, { onConflict: 'provider_ref' })
      break
    }

    case 'subscription.disable':
    case 'subscription.not_renew': {
      const code = String(data.subscription_code ?? '')
      if (!code) break
      await service.from('subscriptions').update({
        status: 'cancelled', cancelled_at: new Date().toISOString(),
      }).eq('provider_ref', code)
      break
    }

    case 'invoice.create':
    case 'invoice.update':
    case 'charge.success': {
      const reference = String(data.reference ?? data.invoice_code ?? '')
      if (!reference) break

      const paid = kind === 'charge.success' || data.status === 'success' || data.paid === true

      const { data: subscription } = await service
        .from('subscriptions').select('id')
        .eq('workspace_id', workspaceId).eq('provider', 'paystack')
        .maybeSingle()

      await service.from('invoices').upsert({
        workspace_id:    workspaceId,
        subscription_id: subscription?.id ?? null,
        amount_ngn:      toNaira(data.amount),
        status:          paid ? 'paid' : 'sent',
        provider:        'paystack',
        provider_ref:    reference,
        paid_at:         paid
          ? (typeof data.paid_at === 'string' ? data.paid_at : new Date().toISOString())
          : null,
      }, { onConflict: 'provider_ref' })
      break
    }

    case 'invoice.payment_failed': {
      const reference = String(data.reference ?? data.invoice_code ?? '')
      if (reference) {
        await service.from('invoices')
          .update({ status: 'failed' }).eq('provider_ref', reference)
      }
      // The subscription is not cancelled here. Paystack retries, and an
      // account turned off on the first failed charge is an account lost to a
      // bank glitch.
      await service.from('subscriptions')
        .update({ status: 'past_due' })
        .eq('workspace_id', workspaceId).eq('provider', 'paystack')
      break
    }

    default:
      // Acknowledged. An unhandled event is not an error, and answering
      // anything else makes Paystack retry it forever.
      break
  }

  return NextResponse.json({ received: true })
}
