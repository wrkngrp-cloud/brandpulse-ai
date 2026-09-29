/**
 * Check src/lib/social/post-metrics.ts against mocked platform responses.
 *
 * These calls cost money (X) or burn a rate-limited quota (Instagram), so the
 * platforms are mocked here and every branch is exercised offline: the happy
 * path, a depleted X balance, a rejected Graph API field, a post that is not in
 * the creator's recent media, an unconnected account and a malformed link.
 *
 * To check that the real credentials can read, use scripts/check-post-metrics.sh.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'

const SRC = 'src/lib/social/post-metrics.ts'
const OUT = process.env.TMPDIR ? `${process.env.TMPDIR}/bg-post-metrics` : '/tmp/bg-post-metrics'
mkdirSync(OUT, { recursive: true })

// Stub the one @/ alias import so the module compiles standalone.
let src = readFileSync(SRC, 'utf8')
src = src.replace(
  "import { decrypt } from '@/lib/crypto'",
  "const decrypt = (s) => s.replace(/^enc:/, '')"
)
writeFileSync(`${OUT}/post-metrics.ts`, src)
execSync(`npx tsc --target es2022 --module esnext --moduleResolution bundler --skipLibCheck --outDir ${OUT} ${OUT}/post-metrics.ts`, { stdio: 'inherit' })
execSync(`mv ${OUT}/post-metrics.js ${OUT}/post-metrics.mjs`)

const m = await import(`${OUT}/post-metrics.mjs`)

let pass = 0, fail = 0
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) { pass++; console.log(`  ok    ${name}`) }
  else { fail++; console.log(`  FAIL  ${name}\n        got  ${g}\n        want ${w}`) }
}

console.log('\n── URL parsers')
eq('ig /p/',        m.instagramShortcode('https://www.instagram.com/p/C8xYzAbCdEf/'), 'C8xYzAbCdEf')
eq('ig /reel/',     m.instagramShortcode('https://instagram.com/reel/DXy_1-2aBcD/?igsh=x'), 'DXy_1-2aBcD')
eq('ig user/reel',  m.instagramShortcode('https://www.instagram.com/jarafoods/reel/DAbC123xyZ/'), 'DAbC123xyZ')
eq('ig profile',    m.instagramShortcode('https://instagram.com/jarafoods'), null)
eq('x status',      m.tweetId('https://x.com/nuel/status/1234567890123456789'), '1234567890123456789')
eq('twitter.com',   m.tweetId('https://twitter.com/nuel/status/987654321?s=20'), '987654321')
eq('x profile',     m.tweetId('https://x.com/nuel'), null)
eq('yt watch',      m.youtubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1s'), 'dQw4w9WgXcQ')
eq('yt short link', m.youtubeVideoId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ')
eq('yt shorts',     m.youtubeVideoId('https://www.youtube.com/shorts/aBcDeFgHiJk'), 'aBcDeFgHiJk')

// ── fake supabase ────────────────────────────────────────────────────────────
const sb = (rows) => ({
  from: (table) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({ data: rows[table] ?? null }),
    }
    return chain
  },
})

const IG_CONN = { social_connections: { account_id: '17841400000000000', access_token: 'enc:IGTOKEN' } }

// ── fake fetch ───────────────────────────────────────────────────────────────
let lastUrl = null
const mockFetch = (handler) => { global.fetch = async (url, init) => { lastUrl = String(url); return handler(String(url), init) } }
const json = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

console.log('\n── Instagram business_discovery')
mockFetch(() => json({
  business_discovery: { media: { data: [
    { id: '1', permalink: 'https://www.instagram.com/p/OTHER111/', like_count: 5, comments_count: 1 },
    { id: '2', permalink: 'https://www.instagram.com/reel/C8xYzAbCdEf/', like_count: 3400, comments_count: 182, play_count: 48200 },
  ] } },
}))
let r = await m.fetchPostMetrics({
  supabase: sb(IG_CONN), brandId: 'b1', platform: 'instagram',
  postUrl: 'https://www.instagram.com/reel/C8xYzAbCdEf/', influencerHandle: '@tolu',
})
eq('ig matches by shortcode', r.metrics, { likes: 3400, comments: 182, views: 48200 })
eq('ig sources all pulled',   r.sources, { likes: 'pulled', comments: 'pulled', views: 'pulled' })
eq('ig owner-only named',     r.ownerOnly, ['reach', 'saves', 'shares'])
eq('ig no note on success',   r.note, null)
eq('ig strips @ from handle', lastUrl.includes('username(tolu)'), true)

console.log('\n── Instagram: post not in recent media')
r = await m.fetchPostMetrics({
  supabase: sb(IG_CONN), brandId: 'b1', platform: 'instagram',
  postUrl: 'https://www.instagram.com/p/NOTTHERE99/', influencerHandle: 'tolu',
})
eq('no match → no metrics', r.metrics, {})
eq('no match → explains',   /50 most recent/.test(r.note), true)

console.log('\n── Instagram: play_count rejected, retry without it')
let attempt = 0
mockFetch((url) => {
  attempt++
  if (url.includes('play_count')) return json({ error: { message: 'nonexisting field' } }, 400)
  return json({ business_discovery: { media: { data: [
    { id: '2', permalink: 'https://www.instagram.com/reel/C8xYzAbCdEf/', like_count: 10, comments_count: 2 },
  ] } } })
})
r = await m.fetchPostMetrics({
  supabase: sb(IG_CONN), brandId: 'b1', platform: 'instagram',
  postUrl: 'https://www.instagram.com/reel/C8xYzAbCdEf/', influencerHandle: 'tolu',
})
eq('retried without play_count', attempt, 2)
eq('still got the counts',       r.metrics, { likes: 10, comments: 2 })

console.log('\n── Instagram: not connected')
r = await m.fetchPostMetrics({
  supabase: sb({}), brandId: 'b1', platform: 'instagram',
  postUrl: 'https://www.instagram.com/p/C8xYzAbCdEf/', influencerHandle: 'tolu',
})
eq('asks to connect', /Connect your own Instagram/.test(r.note), true)

console.log('\n── Instagram: no handle saved')
r = await m.fetchPostMetrics({
  supabase: sb(IG_CONN), brandId: 'b1', platform: 'instagram',
  postUrl: 'https://www.instagram.com/p/C8xYzAbCdEf/', influencerHandle: '  ',
})
eq('explains missing handle', /no Instagram handle saved/.test(r.note), true)

console.log('\n── X tweet lookup')
process.env.TWITTER_BEARER_TOKEN = 'BEARER'
mockFetch(() => json({ data: [{ public_metrics: {
  like_count: 500, reply_count: 40, retweet_count: 30, quote_count: 12, bookmark_count: 77,
} }] }))
r = await m.fetchPostMetrics({
  supabase: sb({}), brandId: 'b1', platform: 'twitter',
  postUrl: 'https://x.com/nuel/status/1234567890',
})
eq('x maps metrics', r.metrics, { likes: 500, comments: 40, shares: 42, saves: 77 })
eq('x shares = reposts + quotes', r.metrics.shares, 42)
eq('x reach stays owner-only',    r.ownerOnly, ['reach'])

console.log('\n── X: own post returns impressions')
mockFetch(() => json({ data: [{ public_metrics: {
  like_count: 5, reply_count: 1, retweet_count: 0, quote_count: 0, bookmark_count: 0, impression_count: 9001,
} }] }))
r = await m.fetchPostMetrics({ supabase: sb({}), brandId: 'b1', platform: 'twitter', postUrl: 'https://x.com/a/status/1' })
eq('impressions → views', r.metrics.views, 9001)
eq('views marked pulled', r.sources.views, 'pulled')

console.log('\n── X: 402 depleted credits')
mockFetch(() => json({}, 402))
r = await m.fetchPostMetrics({ supabase: sb({}), brandId: 'b1', platform: 'twitter', postUrl: 'https://x.com/a/status/1' })
eq('402 → no metrics', r.metrics, {})
eq('402 → says top up', /credits are depleted/.test(r.note), true)

console.log('\n── X: 429 rate limit')
mockFetch(() => json({}, 429))
r = await m.fetchPostMetrics({ supabase: sb({}), brandId: 'b1', platform: 'twitter', postUrl: 'https://x.com/a/status/1' })
eq('429 → says retry', /rate limit/.test(r.note), true)

console.log('\n── X: deleted post')
mockFetch(() => json({ errors: [{ title: 'Not Found Error' }] }))
r = await m.fetchPostMetrics({ supabase: sb({}), brandId: 'b1', platform: 'twitter', postUrl: 'https://x.com/a/status/1' })
eq('no public_metrics → explains', /not publicly readable/.test(r.note), true)

console.log('\n── X: no bearer configured')
delete process.env.TWITTER_BEARER_TOKEN
r = await m.fetchPostMetrics({ supabase: sb({}), brandId: 'b1', platform: 'twitter', postUrl: 'https://x.com/a/status/1' })
eq('unconfigured → says so', /not configured/.test(r.note), true)

console.log('\n── YouTube')
mockFetch(() => json({ items: [{ statistics: { viewCount: '1400000000', likeCount: '18000000', commentCount: '2400000' } }] }))
r = await m.fetchPostMetrics({
  supabase: sb({ youtube_api_configs: { api_key: 'enc:YTKEY' } }),
  brandId: 'b1', platform: 'youtube', postUrl: 'https://youtu.be/dQw4w9WgXcQ',
})
eq('yt string counts → numbers', r.metrics, { views: 1400000000, likes: 18000000, comments: 2400000 })
eq('yt key decrypted into url',  lastUrl.includes('key=YTKEY'), true)

console.log('\n── YouTube: no key saved')
r = await m.fetchPostMetrics({ supabase: sb({}), brandId: 'b1', platform: 'youtube', postUrl: 'https://youtu.be/dQw4w9WgXcQ' })
eq('asks for a key', /Save a YouTube Data API key/.test(r.note), true)

console.log('\n── TikTok and Facebook stay manual')
r = await m.fetchPostMetrics({ supabase: sb({}), brandId: 'b1', platform: 'tiktok', postUrl: 'https://www.tiktok.com/@a/video/123' })
eq('tiktok → no metrics', r.metrics, {})
eq('tiktok → explains why', /creator to connect their own account/.test(r.note), true)
r = await m.fetchPostMetrics({ supabase: sb({}), brandId: 'b1', platform: 'facebook', postUrl: 'https://facebook.com/x/posts/1' })
eq('facebook → explains', /Page connected/.test(r.note), true)

console.log('\n── Malformed links')
process.env.TWITTER_BEARER_TOKEN = 'BEARER'
r = await m.fetchPostMetrics({ supabase: sb(IG_CONN), brandId: 'b1', platform: 'instagram', postUrl: 'https://instagram.com/jarafoods', influencerHandle: 'tolu' })
eq('ig profile link rejected', /does not look like an Instagram post/.test(r.note), true)
r = await m.fetchPostMetrics({ supabase: sb({}), brandId: 'b1', platform: 'twitter', postUrl: 'https://x.com/nuel' })
eq('x profile link rejected', /link to a specific X post/.test(r.note), true)

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
