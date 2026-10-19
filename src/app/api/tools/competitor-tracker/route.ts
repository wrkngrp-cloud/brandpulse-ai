import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { runCompetitorTracker, type CompetitorTrackerResult } from '@/lib/tools/competitor-tracker'
import { finishRun, hashIp, ipOf, startRun } from '@/lib/tools/runs'
import { recordEvent } from '@/lib/tools/events'
import { cacheGet, cacheKey, cacheSet, CACHE_TTL, withinRateLimit } from '@/lib/tools/limits'
import { normaliseUrl } from '@/lib/tools/fetch-public'
import { gateResult } from '@/lib/tools/gate'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * The public competitor analysis.
 *
 * Open, like the scoreboard scan, because requiring an account before the
 * promised value is the friction this whole project exists to remove. What
 * guards it instead: a per-IP hourly ceiling, a six-hour cache keyed on the
 * two websites, and the SSRF screening inside fetchPublic. The service client
 * writes only our own rows — a tool run — so there is no caller row to verify.
 */

const Body = z.object({
  yourWebsite:       z.string().trim().min(4).max(300),
  competitorWebsite: z.string().trim().min(4).max(300),
  market:            z.string().trim().max(60).optional(),
  visitorId:         z.string().max(64).optional(),
})

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Give us your website and one competitor website.' }, { status: 400 })
  }
  const { yourWebsite, competitorWebsite, market, visitorId } = parsed.data

  const yours = normaliseUrl(yourWebsite)
  const theirs = normaliseUrl(competitorWebsite)
  if (!theirs) return NextResponse.json({ error: 'That competitor address did not look like a website.' }, { status: 400 })
  if (!yours)  return NextResponse.json({ error: 'That address of yours did not look like a website.' }, { status: 400 })
  if (yours.hostname.replace(/^www\./, '') === theirs.hostname.replace(/^www\./, '')) {
    return NextResponse.json({ error: 'Those are the same website. Give us a competitor to compare against.' }, { status: 400 })
  }

  const ipHash = hashIp(ipOf(req))
  const { allowed, limit } = await withinRateLimit('competitor-tracker', ipHash)
  if (!allowed) {
    return NextResponse.json(
      { error: `That is ${limit} analyses in an hour. Try again shortly, or sign in to BrandGauge where watching a competitor runs on a schedule.` },
      { status: 429 },
    )
  }

  const inputs = { yourWebsite: yours.toString(), competitorWebsite: theirs.toString(), market: market ?? null }
  const run = await startRun({ toolId: 'competitor-tracker', inputs, req, ipHash })
  await recordEvent({ event: 'free_tool_started', toolId: 'competitor-tracker', runId: run.id, visitorId, props: { market: market ?? '' } })

  const key = cacheKey('competitor-tracker', [yours.hostname, theirs.hostname, market])
  const cached = await cacheGet<CompetitorTrackerResult>(key)

  try {
    if (cached) {
      // A repeat of the same pair inside the window. Stored against this run
      // so the visitor's token works and the funnel counts them, but billed
      // to nobody: this is the duplicate-analysis detection, not a shortcut.
      await finishRun({ id: run.id, status: 'complete', result: cached, coverage: { cached: true, sources: cached.report.coverage } })
      await recordEvent({ event: 'free_tool_completed', toolId: 'competitor-tracker', runId: run.id, visitorId, props: { cached: true, moves: cached.moves.length } })
      const gatedCache = gateResult('competitor-tracker', cached as unknown as Record<string, unknown>, false)
      return NextResponse.json({ token: run.token, runId: run.id, status: 'complete', ...gatedCache })
    }

    const outcome = await runCompetitorTracker({
      yourWebsite: yours.toString(),
      competitorWebsite: theirs.toString(),
      market: market ?? null,
    })

    if (!outcome.ok) {
      const status = outcome.reason === 'no_evidence' ? 'insufficient_evidence' : 'failed'
      await finishRun({ id: run.id, status, failureNote: outcome.note, coverage: { sources: outcome.coverage } })
      await recordEvent({ event: 'free_tool_completed', toolId: 'competitor-tracker', runId: run.id, visitorId, props: { outcome: outcome.reason } })
      return NextResponse.json({
        token: run.token, runId: run.id, status,
        failureNote: outcome.note, coverage: outcome.coverage,
      })
    }

    await cacheSet(key, outcome.result, CACHE_TTL)
    await finishRun({ id: run.id, status: 'complete', result: outcome.result, coverage: { sources: outcome.result.report.coverage } })
    await recordEvent({
      event: 'free_tool_completed', toolId: 'competitor-tracker', runId: run.id, visitorId,
      props: { moves: outcome.result.moves.length, competitor: outcome.result.competitor.name },
    })

    /* The full result is stored against the run; the response is the
       preview. Trimming here rather than in the page is the difference
       between a gate and a blur: the withheld findings never leave the
       server, so nothing in dev tools contradicts what the page says. */
    const gated = gateResult('competitor-tracker', outcome.result as unknown as Record<string, unknown>, false)
    return NextResponse.json({ token: run.token, runId: run.id, status: 'complete', ...gated })
  } catch (err) {
    console.error('[competitor-tracker] run failed:', err)
    await finishRun({
      id: run.id, status: 'failed',
      failureNote: 'Something broke on our side while reading the sources. Nothing about your competitor is implied by that.',
    })
    return NextResponse.json(
      { error: 'Something broke on our side while reading the sources. Try again in a moment.' },
      { status: 500 },
    )
  }
}
