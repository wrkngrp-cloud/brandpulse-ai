import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const verifHash = request.headers.get('verif-hash')
  if (!verifHash) {
    return NextResponse.json({ error: 'Missing verif-hash header' }, { status: 400 })
  }

  const body = await request.text()

  const service = await createServiceClient()

  // Fetch all flutterwave webhook configs across brands
  const { data: configs } = await service
    .from('webhook_configs')
    .select('brand_id, secret_key')
    .eq('provider', 'flutterwave')

  if (!configs || configs.length === 0) {
    return NextResponse.json({ error: 'No Flutterwave configs found' }, { status: 400 })
  }

  // Flutterwave uses plain secret comparison (not HMAC)
  let matchedBrandId: string | null = null
  for (const config of configs) {
    const secret = decrypt(config.secret_key)
    if (secret === verifHash) {
      matchedBrandId = config.brand_id
      break
    }
  }

  if (!matchedBrandId) {
    return NextResponse.json({ error: 'Invalid verif-hash' }, { status: 400 })
  }

  let event: Record<string, unknown>
  try {
    event = JSON.parse(body) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Only handle successful charge completions
  const data = event.data as Record<string, unknown>
  if (
    event.event !== 'charge.completed' ||
    (data?.status as string) !== 'successful'
  ) {
    return NextResponse.json({ received: true })
  }

  const reference     = (data?.tx_ref as string)
  const amount        = (data?.amount as number) ?? 0
  const currency      = (data?.currency as string) ?? 'NGN'
  const occurredAt    = (data?.created_at as string) ?? new Date().toISOString()
  const customer      = (data?.customer as Record<string, unknown>) ?? {}
  const customerEmail = (customer?.email as string) ?? null
  const metadata      = (data?.meta as Record<string, unknown>) ?? {}

  if (!reference) {
    return NextResponse.json({ error: 'Missing tx_ref' }, { status: 400 })
  }

  const { error: purchaseError } = await service
    .from('purchase_events')
    .upsert(
      {
        brand_id:       matchedBrandId,
        source:         'flutterwave',
        reference,
        amount,
        currency,
        customer_email: customerEmail,
        customer_phone: null,
        status:         'success',
        metadata,
        occurred_at:    occurredAt,
      },
      { onConflict: 'source,reference' }
    )

  if (purchaseError) {
    console.error('[flutterwave-webhook] purchase_events upsert error:', purchaseError.message)
  }

  await service
    .from('sdk_events')
    .upsert(
      {
        brand_id:    matchedBrandId,
        event_type:  'purchase',
        value:       amount,
        metadata:    { source: 'flutterwave', reference },
        occurred_at: occurredAt,
      },
      { onConflict: 'brand_id,event_type' }
    )

  return NextResponse.json({ received: true })
}
