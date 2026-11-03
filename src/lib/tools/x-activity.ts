/**
 * What a competitor did on X this week, and what people said about them.
 *
 * X's recent search covers the last seven days, which is the point: a campaign
 * goes live on X before any outlet writes it up. Two small reads per run:
 *
 *   their own posts       citable. A dated post from their account is them
 *                         announcing something, the same standing as a
 *                         release note.
 *   posts about them      context only. Strangers' posts show whether a move
 *                         landed, but one post is not evidence of a move, so
 *                         the model may use them to judge significance and may
 *                         never cite them.
 *
 * Every post read spends X credit, and this runs on a public, ungated tool.
 * So each read is capped at ten posts, the route holds a daily budget, and a
 * missing token or an empty balance is reported in the coverage list rather
 * than failing the brief.
 */

import type { PageFacts } from './html'

const X_API = 'https://api.x.com'

export interface XPost {
  id:        string
  text:      string
  createdAt: string
  username:  string
  url:       string
  likes:     number
  reposts:   number
}

export interface XRead {
  ok:     boolean
  own:    XPost[]
  about:  XPost[]
  handle: string | null
  note?:  string
}

const NOT_HANDLES = new Set(['intent', 'share', 'home', 'i', 'search', 'hashtag', 'explore', 'login', 'signup', 'tos', 'privacy', 'settings'])

/** Their X handle, from the links on their own homepage. */
export function findXHandle(facts: Pick<PageFacts, 'links'>): string | null {
  for (const { href } of facts.links) {
    const m = /^(?:https?:)?\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/(?:#!\/)?@?([A-Za-z0-9_]{1,15})(?:[/?#]|$)/i.exec(href.trim())
    if (m && !NOT_HANDLES.has(m[1].toLowerCase())) return m[1]
  }
  return null
}

interface SearchResponse {
  data?: Array<{ id: string; text: string; created_at: string; author_id: string; public_metrics?: { like_count?: number; retweet_count?: number } }>
  includes?: { users?: Array<{ id: string; username: string }> }
}

export function parseSearch(body: SearchResponse): XPost[] {
  const users = new Map((body.includes?.users ?? []).map(u => [u.id, u.username]))
  return (body.data ?? []).map(t => {
    const username = users.get(t.author_id) ?? 'i'
    return {
      id:        t.id,
      text:      t.text,
      createdAt: t.created_at,
      username,
      url:       `https://x.com/${username}/status/${t.id}`,
      likes:     t.public_metrics?.like_count ?? 0,
      reposts:   t.public_metrics?.retweet_count ?? 0,
    }
  })
}

type SearchOutcome = { ok: true; posts: XPost[] } | { ok: false; reason: 'credit' | 'auth' | 'error' }

async function search(query: string, bearer: string): Promise<SearchOutcome> {
  const url = `${X_API}/2/tweets/search/recent?query=${encodeURIComponent(query)}`
    + '&max_results=10&tweet.fields=created_at,public_metrics,author_id&expansions=author_id&user.fields=username'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8_000)
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${bearer}` }, signal: controller.signal, cache: 'no-store' })
    if (res.status === 402 || res.status === 429) return { ok: false, reason: 'credit' }
    if (res.status === 401 || res.status === 403) return { ok: false, reason: 'auth' }
    if (!res.ok) return { ok: false, reason: 'error' }
    return { ok: true, posts: parseSearch(await res.json() as SearchResponse) }
  } catch {
    return { ok: false, reason: 'error' }
  } finally {
    clearTimeout(timer)
  }
}

const REASON: Record<'credit' | 'auth' | 'error', string> = {
  credit: 'X search is out of credit or rate-limited right now, so this week on X is missing from the brief.',
  auth:   'X search refused our credentials, so this week on X is missing from the brief.',
  error:  'X search did not answer, so this week on X is missing from the brief.',
}

export async function fetchXActivity(args: { name: string; handle: string | null; budgetOk: boolean }): Promise<XRead> {
  const bearer = process.env.TWITTER_BEARER_TOKEN
  if (!bearer) return { ok: false, own: [], about: [], handle: args.handle, note: 'X search is not configured on this deployment.' }
  if (!args.budgetOk) return { ok: false, own: [], about: [], handle: args.handle, note: 'Today\'s X search allowance for the free tools is used up. Run it again tomorrow for this week on X.' }

  const quoted = `"${args.name.replace(/"/g, '')}"`
  const [own, about] = await Promise.all([
    args.handle ? search(`from:${args.handle} -is:retweet`, bearer) : Promise.resolve<SearchOutcome>({ ok: true, posts: [] }),
    search(`${quoted}${args.handle ? ` -from:${args.handle}` : ''} -is:retweet`, bearer),
  ])

  const failed = !own.ok ? own : !about.ok ? about : null
  return {
    ok:     own.ok || about.ok,
    own:    own.ok ? own.posts : [],
    about:  about.ok ? about.posts : [],
    handle: args.handle,
    note:   failed && !failed.ok ? REASON[failed.reason]
      : !args.handle ? 'We could not find their X account on their homepage, so only posts about them were read.'
      : undefined,
  }
}
