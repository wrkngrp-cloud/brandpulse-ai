import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getActiveBrandId } from '@/lib/active-brand'
import crypto from 'crypto'

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const bid = await getActiveBrandId(supabase)
  if (!bid) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const { data: keys, error } = await supabase
    .from('brand_api_keys')
    .select('id, name, key_prefix, last_used_at, created_at, revoked_at')
    .eq('brand_id', bid)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ keys: keys ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const bid = await getActiveBrandId(supabase)
  if (!bid) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const body = await req.json() as { name?: string }
  const name = body.name?.trim() || 'Default Key'

  const rawKey   = `bp_live_${crypto.randomBytes(16).toString('hex')}`
  const keyHash  = crypto.createHash('sha256').update(rawKey).digest('hex')
  const keyPrefix = `${rawKey.slice(0, 15)}...`

  const service = await createServiceClient()
  const { error } = await service.from('brand_api_keys').insert({
    brand_id: bid, name, key_prefix: keyPrefix, key_hash: keyHash,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ key: rawKey, prefix: keyPrefix, name })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const keyId = searchParams.get('id')
  if (!keyId) return NextResponse.json({ error: 'Key ID required' }, { status: 400 })

  const { error } = await supabase
    .from('brand_api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', keyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
