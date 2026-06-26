import { NextRequest, NextResponse } from 'next/server'
import { getActiveBrandId } from '@/lib/active-brand'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const runtime = 'nodejs'

const MAX_SIZE = 10 * 1024 * 1024  // 10 MB
const ALLOWED  = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/gif':  'gif',
}

type Ctx = { params: Promise<{ id: string; channelId: string }> }

// ── POST: upload a creative image ──────────────────────────────────────────────
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id: campaignId, channelId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No active brand' }, { status: 404 })
  const brand = { id: brandId }

  // Verify channel belongs to this campaign and brand
  const { data: channel } = await supabase
    .from('campaign_channels')
    .select('id, creative_urls')
    .eq('id', channelId)
    .eq('campaign_id', campaignId)
    .single()

  if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: 'File type not allowed. Use JPEG, PNG, WebP, or GIF.' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File too large. Maximum 10 MB.' }, { status: 400 })

  const ext      = EXTENSION[file.type] ?? 'jpg'
  const filename = `${Date.now()}.${ext}`
  const path     = `${brand.id}/${campaignId}/${channelId}/${filename}`
  const bytes    = Buffer.from(await file.arrayBuffer())

  const service = await createServiceClient()

  const { error: uploadError } = await service.storage
    .from('campaign-creatives')
    .upload(path, bytes, { contentType: file.type })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = service.storage.from('campaign-creatives').getPublicUrl(path)

  // Append to creative_urls array
  const existing  = (channel.creative_urls ?? []) as string[]
  const updated   = [...existing, publicUrl]

  const { error: updateError } = await supabase
    .from('campaign_channels')
    .update({ creative_urls: updated })
    .eq('id', channelId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ url: publicUrl, creative_urls: updated })
}

// ── DELETE: remove a creative URL ─────────────────────────────────────────────
const deleteSchema = z.object({ url: z.string().url() })

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id: campaignId, channelId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = deleteSchema.safeParse(await req.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: 'url is required' }, { status: 400 })

  const { data: channel } = await supabase
    .from('campaign_channels')
    .select('id, creative_urls')
    .eq('id', channelId)
    .eq('campaign_id', campaignId)
    .single()

  if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })

  const updated = ((channel.creative_urls ?? []) as string[]).filter(u => u !== body.data.url)

  await supabase.from('campaign_channels').update({ creative_urls: updated }).eq('id', channelId)

  // Also delete from storage if it's one of ours
  try {
    const urlObj = new URL(body.data.url)
    const storagePath = urlObj.pathname.split('/campaign-creatives/')[1]
    if (storagePath) {
      const service = await createServiceClient()
      await service.storage.from('campaign-creatives').remove([storagePath])
    }
  } catch { /* ignore storage delete errors */ }

  return NextResponse.json({ creative_urls: updated })
}
