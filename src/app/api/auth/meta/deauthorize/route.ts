// Meta Data Deletion Request callback, required for every app using Facebook
// Login, and checked in App Review. Register it in the Meta App Dashboard
// under both "Data Deletion Request URL" and "Deauthorize Callback URL":
//   https://brandgauge.app/api/auth/meta/deauthorize

import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { deleteMetaUserData, parseSignedRequest } from '@/lib/meta/data-deletion'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const secret = process.env.META_APP_SECRET
  if (!secret) return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  const APP_URL = process.env.APP_URL || 'https://brandgauge.app'

  let signedRequest: string | null = null
  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    signedRequest = typeof body.signed_request === 'string' ? body.signed_request : null
  } else {
    const form = await req.formData().catch(() => null)
    const v = form?.get('signed_request')
    signedRequest = typeof v === 'string' ? v : null
  }
  if (!signedRequest) return NextResponse.json({ error: 'Missing signed_request' }, { status: 400 })

  // Signature first, before any work.
  const data = parseSignedRequest(signedRequest, secret)
  if (!data) return NextResponse.json({ error: 'Invalid signed_request' }, { status: 400 })

  const metaUserId = typeof data.user_id === 'string' ? data.user_id : null
  if (!metaUserId) return NextResponse.json({ error: 'No user in request' }, { status: 400 })

  const db = await createServiceClient()
  const statusToken = randomBytes(18).toString('hex')
  const confirmation = `BG-${statusToken.slice(0, 10).toUpperCase()}`

  // Recorded and awaited. This used to be a `void` insert, which a lazy query
  // builder never runs, so no request was ever kept.
  const { data: row, error: insErr } = await db.from('meta_deletion_requests').insert({
    meta_user_id: metaUserId,
    deletion_id:  confirmation,
    status_token: statusToken,
    raw_payload:  { user_id: metaUserId, issued_at: data.issued_at ?? null },
  }).select('id').single()
  if (insErr || !row) {
    console.error('[meta-deletion] could not record request:', insErr?.message)
    return NextResponse.json({ error: 'Could not record the request' }, { status: 500 })
  }

  // The deletion is a handful of row deletes, so it runs now rather than on a
  // queue: the status page can say "completed" by the time anyone opens it.
  try {
    const result = await deleteMetaUserData(db, metaUserId)
    const found = result.socialConnections + result.adAccounts > 0
    await db.from('meta_deletion_requests').update({
      status: found ? 'completed' : 'nothing_found',
      result, processed_at: new Date().toISOString(),
    }).eq('id', row.id)
  } catch (err) {
    // Recorded as received, so staff can finish it; Meta still gets its answer.
    console.error('[meta-deletion] deletion failed, left as received:', err)
  }

  return NextResponse.json({
    url:               `${APP_URL}/data-deletion-status?id=${statusToken}`,
    confirmation_code: confirmation,
  })
}
