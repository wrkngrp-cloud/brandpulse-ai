import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import crypto from 'node:crypto'
import { decrypt } from '@/lib/crypto'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const signature = request.headers.get('x-paystack-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const body = await request.text()

  const service = await createServiceClient()

  // Fetch all paystack webhook configs across brands
  const { data: configs } = await service
    .from('webhook_configs')
    .select('brand_id, secret_key')
    .eq('provider', 'paystack')

  if (!configs || configs.length === 0) {
    return NextResponse.json({ error: 'No Paystack configs found' }, { status: 400 })
  }

  // Find the brand whose secret matches the HMAC signature
  let matchedBrandId: string | null = null
  for (const config of configs) {
    const secret = decrypt(config.secret_key)
    const computed = crypto
      .createHmac('sha512', secret)
      .update(body)
      .digest('hex')
    if (computed === signature) {
      matchedBrandId = config.brand_id
      break
    }
  }

  if (!matchedBrandId) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let event: Record<string, unknown>
  try {
    event = JSON.parse(body) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Only handle successful charges
  if (event.event !== 'charge.success') {
    return NextResponse.json({ received: true })
  }

  const data = event.data as Record<string, unknown>
  const reference      = data?.reference as string
  const amountKobo     = (data?.amount as number) ?? 0
  const amount         = amountKobo / 100
  const currency       = (data?.currency as string) ?? 'NGN'
  const paidAt         = (data?.paid_at as string) ?? new Date().toISOString()
  const customer       = (data?.customer as Record<string, unknown>) ?? {}
  const customerEmail  = (customer?.email as string) ?? null
  const customerPhone  = (customer?.phone as string) ?? null
  const metadata       = (data?.metadata as Record<string, unknown>) ?? {}

  if (!reference) {
    return NextResponse.json({ error: 'Missing reference' }, { status: 400 })
  }

  const { error: purchaseError } = await service
    .from('purchase_events')
    .upsert(
      {
        brand_id:       matchedBrandId,
        source:         'paystack',
        reference,
        amount,
        currency,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        status:         'success',
        metadata,
        occurred_at:    paidAt,
      },
      { onConflict: 'source,reference' }
    )

  if (purchaseError) {
    console.error('[paystack-webhook] purchase_events upsert error:', purchaseError.message)
  }

  await service
    .from('sdk_events')
    .upsert(
      {
        brand_id:    matchedBrandId,
        event_type:  'purchase',
        value:       amount,
        metadata:    { source: 'paystack', reference },
        occurred_at: paidAt,
      },
      { onConflict: 'brand_id,event_type' }
    )

  return NextResponse.json({ received: true })
}
