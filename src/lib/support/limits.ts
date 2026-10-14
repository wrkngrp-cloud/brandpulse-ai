import { Redis } from '@upstash/redis'

/**
 * Rate limits for the public chat routes.
 *
 * Fails open, like the scoreboard's limiter. This is a guard on abuse, not an
 * authorisation check: somebody with a real question should never be turned
 * away because Redis is having a bad afternoon, and the thing being protected
 * is a row in a table rather than a credential.
 */
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null

export async function withinLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  if (!redis) return true
  try {
    const n = await redis.incr(key)
    if (n === 1) await redis.expire(key, windowSeconds)
    return n <= max
  } catch (err) {
    console.error('[support] rate limiter unavailable, allowing:', err)
    return true
  }
}
