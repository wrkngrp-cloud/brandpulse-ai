import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const BUCKET    = 'campaign-creatives'
const MAX_BYTES = 10 * 1024 * 1024  // 10 MB
const ALLOWED   = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: brand } = await supabase.from('brands').select('id').limit(1).single()
  if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, WebP, and GIF images are accepted.' }, { status: 422 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File must be under 10 MB.' }, { status: 422 })
  }

  const ext       = file.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg'
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
