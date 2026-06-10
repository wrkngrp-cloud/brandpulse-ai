import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { createClient } from '@/lib/supabase/server'
import { classifySentiment } from '@/lib/ai/classify-sentiment'
import { z } from 'zod'

const ratelimit = new Ratelimit({
  redis: new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  }),
  limiter: Ratelimit.slidingWindow(10, '1 m'),
})

const schema = z.object({
  texts: z.array(z.string().min(1)).min(1).max(100),
  brandId: z.string().uuid(),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success } = await ratelimit.limit(`sentiment:${user.id}`)
  if (!success) return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

  const { texts, brandId } = parsed.data

  // RLS enforces workspace membership — if brand isn't found, user can't access it
  const { data: brand } = await supabase.from('brands').select('id').eq('id', brandId).single()
  if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 })

  const items = texts.map((text, i) => ({ id: String(i), text }))
  const results = await classifySentiment(brandId, items)

  return NextResponse.json({
    results: results.map(r => ({
      text: texts[Number(r.id)],
      sentiment: r.sentiment,
      emotion: r.emotion,
      confidence: r.confidence,
    })),
  })
}
