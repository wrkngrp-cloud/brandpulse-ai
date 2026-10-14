import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { runMarketDemand, type MarketDemandResult } from '@/lib/tools/market-demand'
import { finishRun, hashIp, ipOf, startRun } from '@/lib/tools/runs'
import { recordEvent } from '@/lib/tools/events'
import { cacheGet, cacheKey, cacheSet, CACHE_TTL, withinRateLimit } from '@/lib/tools/limits'
import { normaliseUrl } from '@/lib/tools/fetch-public'

export const runtime = 'nodejs'
export const maxDuration = 90

/**
 * The public demand-gap analysis.
 *
 * Two AI calls and up to four billed search lookups per run, which is the most
 * expensive of the five tools, so the ceiling is tighter and the cache is the
 * duplicate-analysis guard: the same website and market inside six hours is
 * served from the previous result rather than re-bought.
 */

const Body = z.object({
  website:           z.string().trim().min(4).max(300),
  market:            z.string().trim().min(2).max(60),
  productCategory:   z.string().trim().max(80).optional(),
  competitorWebsite: z.string().trim().max(300).optional(),
  visitorId:         z.string().max(64).optional(),
})

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Give us your website and the market you sell into.' }, { status: 400 })
  }
  const { website, market, productCategory, competitorWebsite, visitorId } = parsed.data

  const site = normaliseUrl(website)
  if (!site) return NextResponse.json({ error: 'That did not look like a website.' }, { status: 400 })

  const ipHash = hashIp(ipOf(req))
  const { allowed, limit } = await withinRateLimit('market-demand', ipHash)
  if (!allowed) {
    return NextResponse.json(
      { error: `That is ${limit} reports in an hour. Try again shortly.` },
      { status: 429 },
    )
  }

  const inputs = {
    website: site.toString(), market,
    productCategory: productCategory ?? null,
    competitorWebsite: competitorWebsite ?? null,
  }
  const run = await startRun({ toolId: 'market-demand', inputs, req, ipHash })
  await recordEvent({ event: 'free_tool_started', toolId: 'market-demand', runId: run.id, visitorId, props: { market } })

  const key = cacheKey('market-demand', [site.hostname, market, productCategory, competitorWebsite])
  const cached = await cacheGet<MarketDemandResult>(key)

  try {
    if (cached) {
      await finishRun({ id: run.id, status: 'complete', result: cached, coverage: { cached: true, sources: cached.report.coverage } })
      await recordEvent({ event: 'free_tool_completed', toolId: 'market-demand', runId: run.id, visitorId, props: { cached: true, opportunities: cached.opportunities.length } })
      return NextResponse.json({ token: run.token, runId: run.id, status: 'complete', result: cached })
    }

    const outcome = await runMarketDemand({
      website: site.toString(),
      market,
      productCategory: productCategory ?? null,
      competitorWebsite: competitorWebsite ?? null,
    })

    if (!outcome.ok) {
      const status = outcome.reason === 'no_opportunities' || outcome.reason === 'too_thin'
        ? 'insufficient_evidence' : 'failed'
      await finishRun({ id: run.id, status, failureNote: outcome.note, coverage: { sources: outcome.coverage } })
      await recordEvent({ event: 'free_tool_completed', toolId: 'market-demand', runId: run.id, visitorId, props: { outcome: outcome.reason } })
      return NextResponse.json({ token: run.token, runId: run.id, status, failureNote: outcome.note, coverage: outcome.coverage })
    }

    await cacheSet(key, outcome.result, CACHE_TTL)
    await finishRun({ id: run.id, status: 'complete', result: outcome.result, coverage: { sources: outcome.result.report.coverage } })
    await recordEvent({
      event: 'free_tool_completed', toolId: 'market-demand', runId: run.id, visitorId,
      props: { opportunities: outcome.result.opportunities.length, provider: outcome.result.provider ?? 'none' },
    })

    return NextResponse.json({ token: run.token, runId: run.id, status: 'complete', result: outcome.result })
  } catch (err) {
    console.error('[market-demand] run failed:', err)
    await finishRun({
      id: run.id, status: 'failed',
      failureNote: 'Something broke on our side while reading your market. Nothing about your business is implied by that.',
    })
    return NextResponse.json({ error: 'Something broke on our side. Try again in a moment.' }, { status: 500 })
  }
}
