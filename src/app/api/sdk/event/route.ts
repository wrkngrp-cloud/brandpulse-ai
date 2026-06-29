export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { createServiceClient } from '@/lib/supabase/server'

const ratelimit = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? new Ratelimit({
      redis: new Redis({
        url:   process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      }),
      limiter: Ratelimit.slidingWindow(100, '1 m'),
    })
  : null

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const eventSchema = z.object({
  pixel_id:   z.string().min(1),
  event_type: z.string().min(1).max(50),
  value:      z.number().optional(),
  session_id: z.string().optional(),
  page_url:   z.string().optional(),
  referrer:   z.string().optional(),
  metadata:   z.record(z.string(), z.unknown()).optional(),
})

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS })
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON' },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  const parsed = eventSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 422, headers: CORS_HEADERS }
    )
  }

  const { pixel_id, event_type, value, session_id, page_url, referrer, metadata } = parsed.data

  // Rate limit by pixel_id (skipped if Upstash is not configured)
  if (ratelimit) {
    const { success } = await ratelimit.limit(pixel_id)
    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: CORS_HEADERS }
      )
    }
  }

  const supabase = await createServiceClient()

  // Resolve pixel_id → brand_id
  const { data: pixelConfig, error: pixelError } = await supabase
    .from('pixel_configs')
    .select('brand_id')
    .eq('pixel_id', pixel_id)
    .single()

  if (pixelError || !pixelConfig) {
    return NextResponse.json(
      { error: 'Unknown pixel' },
      { status: 404, headers: CORS_HEADERS }
    )
  }

  const userAgent = request.headers.get('user-agent') ?? undefined

  const { error: insertError } = await supabase.from('sdk_events').insert({
    brand_id:   pixelConfig.brand_id,
    event_type,
    value:      value ?? null,
    session_id: session_id ?? null,
    user_agent: userAgent ?? null,
    page_url:   page_url ?? null,
    referrer:   referrer ?? null,
    metadata:   metadata ?? {},
    occurred_at: new Date().toISOString(),
  })

  if (insertError) {
    return NextResponse.json(
      { error: 'Insert failed' },
      { status: 500, headers: CORS_HEADERS }
    )
  }

  return NextResponse.json({ received: true }, { status: 200, headers: CORS_HEADERS })
}
