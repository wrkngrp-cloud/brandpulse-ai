import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { runBrandGap, type BrandGapResult } from '@/lib/tools/brand-gap'
import { finishRun, hashIp, ipOf, startRun } from '@/lib/tools/runs'
import { recordEvent } from '@/lib/tools/events'
import { cacheGet, cacheKey, cacheSet, CACHE_TTL, withinRateLimit } from '@/lib/tools/limits'
import { normaliseUrl } from '@/lib/tools/fetch-public'
import { gateResult } from '@/lib/tools/gate'

export const runtime = 'nodejs'
export const maxDuration = 90

/**
 * The public brand perception reading.
 *
 * Open, like the rest of the set. What guards it: a per-IP hourly ceiling
 * tighter than the others because this run makes two of our own AI calls and
 * up to three external ones, a six-hour cache keyed on the brand and its
 * website, and the SSRF screening inside fetchPublic. The service client
 * writes only our own tool_run row, so there is no caller row to verify.
 */

const Body = z.object({
  brandName: z.string().trim().min(2).max(80),
  website:   z.string().trim().min(4).max(300),
  market:    z.string().trim().max(60).optional(),
  visitorId: z.string().max(64).optional(),
})

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Give us your brand name and your website.' }, { status: 400 })
  }
  const { brandName, website, market, visitorId } = parsed.data

  const site = normaliseUrl(website)
  if (!site) return NextResponse.json({ error: 'That address did not look like a website.' }, { status: 400 })

  const ipHash = hashIp(ipOf(req))
  const { allowed, limit } = await withinRateLimit('brand-gap', ipHash)
  if (!allowed) {
    return NextResponse.json(
      { error: `That is ${limit} readings in an hour. Try again shortly, or sign in to BrandGauge where this runs on a schedule.` },
      { status: 429 },
    )
  }

  /* `yourWebsite` as well as `website`, because the lead capture derives the
     company from the first of those keys it recognises and this tool's own
     field is the visitor's own site. One key for the engine, one for the
     desk, both the same value. */
  const inputs = {
    brandName,
    website: site.toString(),
    yourWebsite: site.toString(),
    market: market ?? null,
  }
  const run = await startRun({ toolId: 'brand-gap', inputs, req, ipHash })
  await recordEvent({ event: 'free_tool_started', toolId: 'brand-gap', runId: run.id, visitorId, props: { market: market ?? '' } })

  const key = cacheKey('brand-gap', [brandName, site.hostname, market])
  const cached = await cacheGet<BrandGapResult>(key)

  try {
    if (cached) {
      await finishRun({ id: run.id, status: 'complete', result: cached, coverage: { cached: true, sources: cached.report.coverage } })
      await recordEvent({ event: 'free_tool_completed', toolId: 'brand-gap', runId: run.id, visitorId, props: { cached: true, divergences: cached.divergences.length } })
      const gatedCache = gateResult('brand-gap', cached as unknown as Record<string, unknown>, false)
      return NextResponse.json({ token: run.token, runId: run.id, status: 'complete', ...gatedCache })
    }

    const outcome = await runBrandGap({ brandName, website: site.toString(), market: market ?? null })

    if (!outcome.ok) {
      /* Three of the four refusals are findings rather than faults: nothing
         stated, nothing describing you, nothing we could compare. They are
         reported as insufficient evidence so the page says so in those words
         instead of apologising for a failure that did not happen. */
      const status = outcome.reason === 'bad_url' || outcome.reason === 'site_unreadable'
        ? 'failed'
        : 'insufficient_evidence'
      await finishRun({ id: run.id, status, failureNote: outcome.note, coverage: { sources: outcome.coverage } })
      await recordEvent({ event: 'free_tool_completed', toolId: 'brand-gap', runId: run.id, visitorId, props: { outcome: outcome.reason } })
      return NextResponse.json({
        token: run.token, runId: run.id, status,
        reason: outcome.reason, failureNote: outcome.note, coverage: outcome.coverage,
      })
    }

    await cacheSet(key, outcome.result, CACHE_TTL)
    await finishRun({ id: run.id, status: 'complete', result: outcome.result, coverage: { sources: outcome.result.report.coverage } })
    await recordEvent({
      event: 'free_tool_completed', toolId: 'brand-gap', runId: run.id, visitorId,
      props: { divergences: outcome.result.divergences.length, press: outcome.result.described.pressCount },
    })

    const gated = gateResult('brand-gap', outcome.result as unknown as Record<string, unknown>, false)
    return NextResponse.json({ token: run.token, runId: run.id, status: 'complete', ...gated })
  } catch (err) {
    console.error('[brand-gap] run failed:', err)
    await finishRun({
      id: run.id, status: 'failed',
      failureNote: 'Something broke on our side while reading the sources. Nothing about your brand is implied by that.',
    })
    return NextResponse.json(
      { error: 'Something broke on our side while reading the sources. Try again in a moment.' },
      { status: 500 },
    )
  }
}
