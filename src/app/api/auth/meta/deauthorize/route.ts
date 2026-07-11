// Meta Data Deletion Request callback — required by Meta for all apps using Facebook Login.
// Register this URL in Meta App Dashboard → Facebook Login → Settings → Data Deletion Request URL
// URL to register: https://brandgauge.app/api/auth/meta/deauthorize

import { NextRequest, NextResponse } from 'next/server'
import { createHmac }               from 'crypto'
import { createServiceClient }      from '@/lib/supabase/server'

export const runtime = 'nodejs'

function parseSignedRequest(signedRequest: string, secret: string): Record<string, unknown> | null {
  const [encodedSig, payload] = signedRequest.split('.')
  if (!encodedSig || !payload) return null

  const sig  = Buffer.from(encodedSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
  const data = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')

  const expectedSig = createHmac('sha256', secret).update(payload).digest()
  if (!sig.equals(expectedSig)) return null

  try { return JSON.parse(data) } catch { return null }
}

export async function POST(req: NextRequest) {
  const secret = process.env.META_APP_SECRET
  if (!secret) return NextResponse.json({ error: 'Not configured' }, { status: 500 })

  const APP_URL = process.env.APP_URL ?? 'https://brandpulse-ai-tau.vercel.app'

  let signedRequest: string | null = null

  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    signedRequest = typeof body.signed_request === 'string' ? body.signed_request : null
  } else {
    const form = await req.formData().catch(() => null)
    signedRequest = form ? (form.get('signed_request') as string | null) : null
  }

  if (!signedRequest) {
    return NextResponse.json({ error: 'Missing signed_request' }, { status: 400 })
  }

  const data = parseSignedRequest(signedRequest, secret)
  if (!data) {
    return NextResponse.json({ error: 'Invalid signed_request' }, { status: 400 })
  }

  const userId = data.user_id as string | undefined

  // Log the deletion request and queue cleanup
  if (userId) {
    const supabase = await createServiceClient()

    // Find workspace members whose Meta user_id matches — best effort
    // The deletion_request_id is used to confirm the deletion is complete
    const deletionId = `meta-del-${Date.now()}-${userId.slice(0, 8)}`

    // In production: queue a job to delete the user's data.
    // For now: log to a deletions table if it exists, otherwise just acknowledge.
    void supabase.from('meta_deletion_requests').insert({
      meta_user_id:    userId,
      deletion_id:     deletionId,
      requested_at:    new Date().toISOString(),
      raw_payload:     data,
    })  // fire-and-forget; table may not exist yet

    return NextResponse.json({
      url:               `${APP_URL}/data-deletion-status?id=${deletionId}`,
      confirmation_code: deletionId,
    })
  }

  return NextResponse.json({
    url:               `${APP_URL}/data-deletion-status?id=unknown`,
    confirmation_code: 'acknowledged',
  })
}
