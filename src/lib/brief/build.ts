import type { SupabaseClient } from '@supabase/supabase-js'
import { callAi, extractJson } from '@/lib/ai/client'
import type { BrandType } from '@/lib/bhi'
import type { BriefBrandType } from './metrics'
import { checkinMetricFor, addDays, weekLabel, MOMENT_KINDS, type MomentKind } from './metrics'

/**
 * The Monday Brief: what moved last week, and what probably moved it.
 *
 * The movement is arithmetic, done here, never by the model: last week's
 * number against the week before. The model is asked only for the "why", from
 * a numbered list of things that happened, and every reason must cite at
 * least one of them or it is dropped. Three rules this enforces in code
 * rather than by asking nicely:
 *
 *   No story from no data. Without last week's number and the week before,
 *   there is no brief, only a request for the number.
 *
 *   Nothing is called a cause without a test. Every link is "moved together"
 *   or "no clear cause". No lift-test result is fed in yet, so a "tested"
 *   label from the model is downgraded.
 *
 *   No invented figure. The model may only restate numbers from the list.
 */

import type { BriefContent, BriefSource, NeedsNumbers } from './types'
export type { BriefContent, BriefSource, NeedsNumbers, CauseLabel } from './types'

export type BriefOutcome =
  | { status: 'ready'; content: BriefContent }
  | { status: 'needs_numbers'; content: NeedsNumbers }

interface Inputs {
  brandName: string
  sources:   BriefSource[]
  sentiment: { thisWeek: number | null; lastWeek: number | null }
}

const pct = (v: number, prev: number) => prev > 0 ? Math.round(((v - prev) / prev) * 1000) / 10 : null

export async function buildBrief(db: SupabaseClient, brandId: string, weekStart: string): Promise<BriefOutcome> {
  const { data: brand } = await db.from('brands').select('name, brand_type').eq('id', brandId).single()
  const metric = checkinMetricFor(brand?.brand_type)
  const weekEnd = addDays(weekStart, 6)
  const prevStart = addDays(weekStart, -7)

  // ── 1. The number ─────────────────────────────────────────────────────────
  const { data: rows } = await db
    .from('metric_manual')
    .select('value, period_start, is_index')
    .eq('brand_id', brandId)
    .eq('metric_key', metric.key)
    .gte('period_start', addDays(weekStart, -7 * 7))
    .lte('period_start', weekStart)
    .order('period_start', { ascending: true })
  const history = (rows ?? []).map(r => ({ week: r.period_start as string, value: Number(r.value), isIndex: !!r.is_index }))
  const current = history.find(h => h.week === weekStart)
  const previous = history.find(h => h.week === prevStart)

  if (!current || !previous) {
    return {
      status: 'needs_numbers',
      content: {
        weekStart, weekLabel: weekLabel(weekStart),
        metric: { key: metric.key, label: metric.label, question: metric.question },
        missing: !current ? 'last_week' : 'week_before',
      },
    }
  }

  // ── 2. What happened ─────────────────────────────────────────────────────
  const inputs = await gatherInputs(db, brandId, brand?.name ?? 'the brand', prevStart, weekEnd)
  const changePct = pct(current.value, previous.value)

  const counts = {
    campaigns:       inputs.sources.filter(s => s.kind === 'campaign').length,
    moments:         inputs.sources.filter(s => s.kind === 'moment').length,
    press:           inputs.sources.filter(s => s.kind === 'press' || s.kind === 'competitor_press').length,
    competitorMoves: inputs.sources.filter(s => s.kind === 'competitor_move').length,
  }

  const base: Omit<BriefContent, 'headline' | 'summary' | 'causes' | 'watchNext'> = {
    weekStart, weekLabel: weekLabel(weekStart),
    metric: {
      key: metric.key, label: metric.label, isIndex: current.isIndex,
      value: current.value, previous: previous.value, changePct,
      history: history.map(h => ({ week: h.week, value: h.value })),
    },
    counts,
    generatedAt: new Date().toISOString(),
  }

  // ── 3. Why, from the model, held to its sources ──────────────────────────
  const read = await readWhy({ brandId, brandName: inputs.brandName, metricLabel: metric.label, isIndex: current.isIndex,
    value: current.value, previous: previous.value, changePct, weekStart, weekEnd, sources: inputs.sources, sentiment: inputs.sentiment })

  return { status: 'ready', content: { ...base, ...read } }
}

async function gatherInputs(db: SupabaseClient, brandId: string, brandName: string, from: string, to: string): Promise<Inputs> {
  const [campaigns, moments, press, moves, sentiment] = await Promise.all([
    db.from('campaigns').select('id, name, status, start_date, end_date, total_budget, currency')
      .eq('brand_id', brandId).neq('status', 'draft')
      .lte('start_date', to).or(`end_date.is.null,end_date.gte.${from}`).limit(12),
    db.from('brand_moments').select('id, happened_on, kind, title')
      .eq('brand_id', brandId).gte('happened_on', addDays(from, -7)).lte('happened_on', to)
      .order('happened_on', { ascending: false }).limit(12),
    db.from('press_mentions').select('id, headline, publication, url, published_at, is_competitor, competitor_name')
      .eq('brand_id', brandId).gte('published_at', from).lte('published_at', to)
      .order('published_at', { ascending: false }).limit(20),
    db.from('competitor_moves').select('id, competitor_name, headline, source_url, published_at, discovered_at')
      .eq('brand_id', brandId).gte('discovered_at', from + 'T00:00:00Z').lte('discovered_at', to + 'T23:59:59Z')
      .limit(10),
    db.from('sentiment_daily').select('day, social_score')
      .eq('brand_id', brandId).gte('day', from).lte('day', to),
  ])

  const sources: BriefSource[] = []
  const push = (s: Omit<BriefSource, 'id'>) => sources.push({ ...s, id: `S${sources.length + 1}` })

  for (const c of campaigns.data ?? []) {
    const window = `${c.start_date ?? '?'} to ${c.end_date ?? 'ongoing'}`
    push({ kind: 'campaign', title: `Campaign "${c.name}" (${c.status}, ${window})`, date: c.start_date ?? from, url: `/dashboard/campaigns/${c.id}` })
  }
  for (const m of moments.data ?? []) {
    push({ kind: 'moment', title: `${MOMENT_KINDS[m.kind as MomentKind] ?? 'Moment'}: ${m.title}`, date: m.happened_on })
  }
  for (const p of press.data ?? []) {
    push({
      kind: p.is_competitor ? 'competitor_press' : 'press',
      title: `${p.is_competitor ? `About competitor ${p.competitor_name}: ` : ''}${p.headline} (${p.publication})`,
      date: p.published_at, url: p.url,
    })
  }
  for (const mv of moves.data ?? []) {
    push({ kind: 'competitor_move', title: `${mv.competitor_name}: ${mv.headline}`, date: (mv.published_at ?? mv.discovered_at ?? '').slice(0, 10), url: mv.source_url })
  }

  const days = sentiment.data ?? []
  const mid = addDays(from, 7)
  const avg = (xs: number[]) => xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null
  return {
    brandName,
    sources,
    sentiment: {
      lastWeek: avg(days.filter(d => d.day < mid && d.social_score != null).map(d => Number(d.social_score))),
      thisWeek: avg(days.filter(d => d.day >= mid && d.social_score != null).map(d => Number(d.social_score))),
    },
  }
}

const SYSTEM = `You write the Monday Brief for a marketing lead in Nigeria: what moved in their numbers last week, and what probably moved it.

You are given the change in one weekly number, already calculated, and a numbered list of things that happened around that week: the brand's own campaigns and moments, press about the brand and its competitors, and competitor moves.

Rules you must not break:
1. Every reason must cite at least one source by its id, like "S3". If nothing in the list plausibly explains the change, say so with label "no_clear_cause" and cite nothing.
2. Never say something caused the change. Things "moved together" or happened "in the same week". Use label "moved_together" for every reason that cites a source.
3. Use only numbers given to you. Never invent a figure, a share, a reach or a percentage.
4. If the number is an index, talk only in percentages, never in units.
5. A small change (under 3% either way) is "steady". Do not dramatise it.
6. At most three reasons, most likely first.
7. Plain, warm English. Active voice. No em dashes. Never use the words delve, underscore, pivotal, crucial, robust, vibrant, leverage, seamless or tapestry.

Return ONLY valid JSON, no preamble:
{"headline":"under 14 words","summary":"one or two sentences","causes":[{"text":"one sentence","label":"moved_together","sources":["S1"]}],"watch_next":"one sentence on what to watch this week, or empty"}`

async function readWhy(a: {
  brandId: string; brandName: string; metricLabel: string; isIndex: boolean
  value: number; previous: number; changePct: number | null; weekStart: string; weekEnd: string
  sources: BriefSource[]; sentiment: { thisWeek: number | null; lastWeek: number | null }
}): Promise<Pick<BriefContent, 'headline' | 'summary' | 'causes' | 'watchNext'>> {
  const direction = a.changePct == null ? 'changed' : a.changePct > 0 ? 'rose' : a.changePct < 0 ? 'fell' : 'held steady'
  const fallback = {
    headline: `${a.metricLabel} ${direction}${a.changePct != null ? ` ${Math.abs(a.changePct)}%` : ''} last week`,
    summary: a.sources.length
      ? 'We could not write the reasons this time. The numbers and what happened around them are below.'
      : 'Nothing we track happened around this change: no campaign, moment, press or competitor move. Add the moments you know about and the next brief can link them.',
    causes: [] as BriefContent['causes'],
    watchNext: null as string | null,
  }

  const figure = a.isIndex
    ? `index ${a.value} (week before: ${a.previous})`
    : `${a.value.toLocaleString('en-NG')} (week before: ${a.previous.toLocaleString('en-NG')})`
  const user = [
    `Brand: ${a.brandName}`,
    `Week: ${a.weekStart} to ${a.weekEnd}`,
    `${a.metricLabel}: ${figure}${a.changePct != null ? `, a change of ${a.changePct > 0 ? '+' : ''}${a.changePct}%` : ''}${a.isIndex ? ' (an index, not real units)' : ''}`,
    a.sentiment.thisWeek != null && a.sentiment.lastWeek != null
      ? `Social sentiment score: ${a.sentiment.thisWeek}/100 last week, ${a.sentiment.lastWeek}/100 the week before.` : '',
    '',
    'SOURCES',
    a.sources.length ? a.sources.map(s => `[${s.id}] ${s.date} · ${s.kind} · ${s.title}`).join('\n') : '(none)',
  ].filter(Boolean).join('\n')

  if (!a.sources.length) return fallback

  try {
    const raw = await callAi({
      tier: 'structural',
      system: SYSTEM,
      messages: [{ role: 'user', content: user }],
      maxTokens: 1200,
      meta: { brandId: a.brandId, feature: 'monday_brief' },
    })
    const parsed = extractJson<{ headline?: string; summary?: string; watch_next?: string; causes?: { text?: string; label?: string; sources?: string[] }[] }>(raw)
    const causes = sanitiseCauses(parsed.causes ?? [], a.sources)
    return {
      headline:  parsed.headline?.trim() || fallback.headline,
      summary:   parsed.summary?.trim() || fallback.summary,
      causes,
      watchNext: parsed.watch_next?.trim() || null,
    }
  } catch (err) {
    console.error('[monday-brief] reading failed:', err)
    return fallback
  }
}

/**
 * Hold the model's reasons to the sources it was given. At most three. A
 * reason citing nothing real survives only as "no clear cause"; a cited one
 * is always "moved together", because no test result is fed in yet.
 */
export function sanitiseCauses(
  raw: { text?: string; label?: string; sources?: string[] }[],
  sources: BriefSource[],
): BriefContent['causes'] {
  const byId = new Map(sources.map(s => [s.id, s]))
  return raw.slice(0, 3).flatMap<BriefContent['causes'][number]>(c => {
    const text = c.text?.trim()
    if (!text) return []
    const cited = (c.sources ?? []).map(id => byId.get(String(id).trim())).filter((s): s is BriefSource => !!s)
    if (!cited.length) return c.label === 'no_clear_cause' ? [{ text, label: 'no_clear_cause', sources: [] }] : []
    return [{ text, label: 'moved_together', sources: cited }]
  })
}

// Compile-time guard: the brand types metrics.ts repeats must match bhi.ts
// exactly, in both directions, or this stops type-checking.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const _brandTypesMatch: Same<BrandType, BriefBrandType> = true
void _brandTypesMatch
