import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaffOrNull } from '@/lib/desk/auth'
import { signMailAttachment } from '@/lib/support/attachments'
import { withinLimit } from '@/lib/support/limits'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * An attachment for a personal mailbox message, picked before a conversation
 * necessarily exists (compose and drafts have none yet).
 *
 * A real API route rather than a Server Action, on purpose: a Server Action
 * invoked with a File argument is still bound by Next's default Server
 * Actions body limit (1MB, set via next.config.ts and never raised here), so
 * a phone photo — routinely several MB — failed outright before this code
 * ever ran. That is the crash a real photo attachment produced. The chat
 * widget's own upload (/api/support/attachment) is a route for the same
 * reason; this is the Desk's one API route, living outside the /desk/api
 * path CLAUDE.md forbids, the same way every other /api/support/* route does.
 */

const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf',
])

export async function POST(req: NextRequest) {
  const session = await requireStaffOrNull('mail.use')
  if (!session) {
    return NextResponse.json({ error: 'You do not have permission to use this.' }, { status: 403 })
  }

  if (!await withinLimit(`mail:upload:${session.userId}`, 30, 600)) {
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

  const displayName = (file.name || 'attachment').slice(0, 120)
  const extension   = displayName.includes('.') ? displayName.split('.').pop()!.slice(0, 8) : 'bin'
  const path = `mail/${session.userId}/${randomUUID()}.${extension.replace(/[^a-zA-Z0-9]/g, '')}`

  const service = await createServiceClient()
  const { error } = await service.storage
    .from('support-attachments')
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false })

  if (error) {
    return NextResponse.json({ error: 'Could not upload that file.' }, { status: 500 })
  }

  const ref = { path, name: displayName, type: file.type, size: file.size }
  return NextResponse.json({ ...ref, signature: signMailAttachment(session.userId, ref) })
}
