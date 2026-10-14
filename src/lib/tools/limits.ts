import { Redis } from '@upstash/redis'

/**
 * Cost and abuse guards for the public tools.
 *
 * Both halves fail open, the same decision the scoreboard scan made and for
 * the same reason: a limiter is a guard on our bill, not the product, and a
 * marketer typing their own website should not meet a 500 because Redis
 * blinked. An unthrottled minute during an outage is the cheaper problem.
 *
 * The cache is keyed on the normalised inputs, so two people auditing the same
 * page in the same afternoon cost one audit. That is also the duplicate-
 * analysis detection the brief asks for: a repeat within the window is served
 * from the cache rather than re-run.
 */

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
  : null

export const redisAvailable = redis !== null

/** Per-tool hourly ceilings per IP. Each of these costs one AI call and
 *  several outbound fetches, so they are tighter than the scoreboard's. */
export const RUNS_PER_HOUR: Record<string, number> = {
  'competitor-tracker': 6,
  'market-demand':      6,
  'campaign-audit':     8,
  'offline-tracker':    10,
}

export async function withinRateLimit(tool: string, ipHash: string): Promise<{ allowed: boolean; limit: number }> {
  const limit = RUNS_PER_HOUR[tool] ?? 10
  if (!redis) return { allowed: true, limit }
  try {
    const key = `tool:rl:${tool}:${ipHash}`
    const n = await redis.incr(key)
    if (n === 1) await redis.expire(key, 3600)
    return { allowed: n <= limit, limit }
  } catch (err) {
    console.error(`[tools] rate limiter unavailable for ${tool}, allowing:`, err)
    return { allowed: true, limit }
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null
  try { return await redis.get<T>(key) } catch { return null }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (!redis) return
  try { await redis.set(key, value, { ex: ttlSeconds }) } catch { /* not fatal */ }
}

/** Six hours. Long enough that a shared link does not re-bill us, short
 *  enough that a page fixed this morning audits clean this afternoon. */
export const CACHE_TTL = 60 * 60 * 6

export function cacheKey(tool: string, parts: Array<string | undefined | null>): string {
  return `tool:v1:${tool}:${parts.filter(Boolean).map(p => String(p).toLowerCase().trim()).join('|')}`
}
