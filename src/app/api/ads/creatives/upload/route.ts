import { NextRequest, NextResponse } from 'next/server'
import { getActiveBrandId } from '@/lib/active-brand'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const BUCKET          = 'campaign-creatives'
const MAX_IMAGE_BYTES = 10 * 1024 * 1024   // 10 MB
const MAX_VIDEO_BYTES = 500 * 1024 * 1024  // 500 MB
const ALLOWED_IMAGES  = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const ALLOWED_VIDEOS  = new Set(['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'])
const ALLOWED         = new Set([...ALLOWED_IMAGES, ...ALLOWED_VIDEOS])

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No active brand' }, { status: 404 })
  const brand = { id: brandId }

  const form = await req.formData().catch(() => null)
  const file = form?.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, WebP, GIF images or MP4, MOV, AVI, WebM videos are accepted.' }, { status: 422 })
  }
  const isVideo = ALLOWED_VIDEOS.has(file.type)
  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
  if (file.size > maxBytes) {
    return NextResponse.json({ error: isVideo ? 'Video must be under 500 MB.' : 'Image must be under 10 MB.' }, { status: 422 })
  }

  const mimeExt: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
    'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/x-msvideo': 'avi', 'video/webm': 'webm',
  }
  const ext       = mimeExt[file.type] ?? 'bin'
  const filename  = `ads/${brand.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const bytes     = await file.arrayBuffer()

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(filename, bytes, { contentType: file.type, upsert: false })

  if (upErr) {
    console.error('[ads/creatives/upload] storage error:', upErr)
    return NextResponse.json({ error: 'Upload failed.' }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(filename)
  return NextResponse.json({ url: publicUrl })
}
