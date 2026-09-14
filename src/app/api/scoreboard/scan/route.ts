import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { z } from 'zod'
import { Redis } from '@upstash/redis'
import { runScoreboard } from '@/lib/press/scoreboard'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * The public scoreboard scan.
 *
 * No account, no session, nothing of the visitor's connected. They type four
 * brand names and we read a public news feed, so the promise on the page that
 * nothing of theirs is exposed is literally true and needs no asterisk.
 *
 * That also makes this an open endpoint on the internet, so it is rate
 * limited by IP and cached by the set of names. The service client is used
 * only to record the scan, which is ours and not a tenant's, so the
 * ownership rule in CLAUDE.md has nothing to verify here: there is no caller
 * row to own.
 */

const Body = z.object({
  brand:       z.string().trim().min(2).max(60),
  competitors: z.array(z.string().trim().min(2).max(60)).max(3).default([]),
  category:    z.string().trim().max(60).optional(),
})

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
  : null

const SCANS_PER_HOUR = 12
const CACHE_TTL = 60 * 60 * 6   // six hours; the press does not move faster

function ipOf(req: NextRequest): string {
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
    || req.headers.get('x-real-ip')
    || 'unknown'
}
const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 32)

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Give us a brand name, and up to three rivals.' }, { status: 400 })
  }
  const { brand, competitors, category } = parsed.data
  // A brand listed against itself skews its own share to nothing.
  const rivals = [...new Set(competitors.map(c => c.trim()).filter(c => c && c.toLowerCase() !== brand.toLowerCase()))]

  const ipHash = hash(ipOf(req))

  /* The limiter and the cache both fail open. They are a guard on cost and a
     saving on latency, not the product, and a visitor typing four brand names
     should not meet a 500 because Redis blinked. An unthrottled minute during
     an outage is a cheaper problem than a tool that looks broken. */
  if (redis) {
    try {
      const key = `sb:rl:${ipHash}`
      const n = await redis.incr(key)
      if (n === 1) await redis.expire(key, 3600)
      if (n > SCANS_PER_HOUR) {
        return NextResponse.json(
          { error: 'That is a lot of scans in one hour. Try again shortly.' },
          { status: 429 },
        )
      }
    } catch (err) {
      console.error('[scoreboard] rate limiter unavailable, allowing:', err)
    }
  }

  const cacheKey = `sb:v1:${[brand, ...rivals].map(s => s.toLowerCase()).sort().join('|')}`
  type Board = Awaited<ReturnType<typeof runScoreboard>>
  let board: Board | null = null

  if (redis) {
    try { board = await redis.get<Board>(cacheKey) } catch { /* cold read, carry on */ }
  }

  if (!board) {
    board = await runScoreboard(brand, rivals)
    // Never cache a failed read: a blocked feed would then be served as the
    // answer for six hours.
    if (redis && board.feedOk) {
      try { await redis.set(cacheKey, board, { ex: CACHE_TTL }) } catch { /* not fatal */ }
    }
  }

  // Record it. This is what the lead desk shows when the address arrives:
  // their brand, their rivals, and the number they were looking at.
  let scanId: string | null = null
  try {
    const svc = await createServiceClient()
    const subject = board.brands.find(b => b.isSubject)
    const { data } = await svc.from('public_scans').insert({
      brand_name:     brand,
      competitors:    rivals,
      category:       category ?? null,
      results:        board,
      share_of_reach: subject?.shareOfReach ?? 0,
      mentions_found: board.brands.reduce((s, b) => s + b.mentionCount, 0),
      ip_hash:        ipHash,
      referrer:       req.headers.get('referer')?.slice(0, 300) ?? null,
      user_agent:     req.headers.get('user-agent')?.slice(0, 300) ?? null,
    }).select('id').single()
    scanId = data?.id ?? null
  } catch (err) {
    // A board the visitor can read is worth more than a row we can count.
    console.error('[scoreboard] could not record the scan:', err)
  }

  return NextResponse.json({ ...board, scanId })
}
