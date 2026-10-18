import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveThreadId, hashIp } from '@/lib/support/chat'
import { signAttachment } from '@/lib/support/attachments'
import { withinLimit } from '@/lib/support/limits'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * A screenshot, which usually ends the diagnosis in one message.
 *
 * Two things this route does not do. It does not accept a path from the
 * caller: it names the file itself, inside a folder named after the
 * conversation, so one thread's upload can never land in another's. And it
 * does not return a URL: the bucket is private, and the reference it hands
 * back is signed so the message route can tell it came from here.
 */

const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf',
])

function ipOf(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || '0.0.0.0'
}

export async function POST(req: NextRequest) {
  const conversationId = await resolveThreadId()
  if (!conversationId) {
    return NextResponse.json({ error: 'Open the chat first.' }, { status: 409 })
  }

  if (!await withinLimit(`support:upload:${hashIp(ipOf(req))}`, 20, 600)) {
    return NextResponse.json({ error: 'Too many uploads. Try again shortly.' }, { status: 429 })
  }

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file received.' }, { status: 400 })
  }

  // Checked here as well as on the bucket. The bucket limit is the backstop;
  // this is the message somebody can act on.
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'That file is over 10MB.' }, { status: 413 })
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: 'Images and PDFs only.' }, { status: 415 })
  }

  // The name is for display. The path is ours, so a crafted filename cannot
  // escape the folder or collide with somebody else's file.
  const displayName = (file.name || 'attachment').slice(0, 120)
  const extension   = displayName.includes('.') ? displayName.split('.').pop()!.slice(0, 8) : 'bin'
  const path = `${conversationId}/${randomUUID()}.${extension.replace(/[^a-zA-Z0-9]/g, '')}`

  const service = await createServiceClient()
  const { error } = await service.storage
    .from('support-attachments')
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false })

  if (error) {
    return NextResponse.json({ error: 'Could not upload that file.' }, { status: 500 })
  }

  const ref = { path, name: displayName, type: file.type, size: file.size }
  return NextResponse.json({ ...ref, signature: signAttachment(conversationId, ref) })
}
