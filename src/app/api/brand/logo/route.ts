import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const MAX_SIZE  = 5 * 1024 * 1024  // 5 MB
const ALLOWED   = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
const EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: brand } = await supabase.from('brands').select('id').limit(1).single()
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: 'File type not allowed. Use JPEG, PNG, WebP, or SVG.' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File too large. Maximum 5 MB.' }, { status: 400 })

  const ext  = EXTENSION[file.type] ?? 'png'
  const path = `${brand.id}/logo.${ext}`
  const bytes = Buffer.from(await file.arrayBuffer())

  const service = await createServiceClient()

  const { error: uploadError } = await service.storage
    .from('brand-assets')
    .upload(path, bytes, { contentType: file.type, upsert: true })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = service.storage.from('brand-assets').getPublicUrl(path)

  // Bust CDN cache by appending a timestamp param
  const url = `${publicUrl}?v=${Date.now()}`

  const { error: updateError } = await supabase
    .from('brands')
    .update({ logo_url: url })
    .eq('id', brand.id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ url })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: brand } = await supabase.from('brands').select('id, logo_url').limit(1).single()
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const service = await createServiceClient()

  // Remove all logo files for this brand (any extension)
  const { data: files } = await service.storage.from('brand-assets').list(brand.id)
  const logoFiles = (files ?? []).filter(f => f.name.startsWith('logo.'))
  if (logoFiles.length > 0) {
    await service.storage.from('brand-assets').remove(logoFiles.map(f => `${brand.id}/${f.name}`))
  }

  await supabase.from('brands').update({ logo_url: null }).eq('id', brand.id)

  return NextResponse.json({ success: true })
}
