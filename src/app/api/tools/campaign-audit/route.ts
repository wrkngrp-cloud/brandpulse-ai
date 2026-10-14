import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { runCampaignAudit, type CampaignAuditResult } from '@/lib/tools/campaign-audit'
import { CAMPAIGN_OBJECTIVES, type CampaignObjective } from '@/lib/tools/audit-vocab'
import { finishRun, hashIp, ipOf, startRun } from '@/lib/tools/runs'
import { recordEvent } from '@/lib/tools/events'
import { cacheGet, cacheKey, cacheSet, CACHE_TTL, withinRateLimit } from '@/lib/tools/limits'
import { normaliseUrl } from '@/lib/tools/fetch-public'

export const runtime = 'nodejs'
// PageSpeed Insights on a slow page genuinely takes most of a minute, and a
// shorter ceiling here would mean the performance check never runs for the
// pages that need it most.
export const maxDuration = 120

const Body = z.object({
  pageUrl:       z.string().trim().min(4).max(500),
  objective:     z.enum(CAMPAIGN_OBJECTIVES).optional(),
  market:        z.string().trim().max(60).optional(),
  competitorUrl: z.string().trim().max(500).optional(),
  visitorId:     z.string().max(64).optional(),
})

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Give us the address of the page your ads point at.' }, { status: 400 })
  }
  const { pageUrl, objective, market, competitorUrl, visitorId } = parsed.data

  const target = normaliseUrl(pageUrl)
  if (!target) return NextResponse.json({ error: 'That did not look like a web page.' }, { status: 400 })

  const ipHash = hashIp(ipOf(req))
  const { allowed, limit } = await withinRateLimit('campaign-audit', ipHash)
  if (!allowed) {
    return NextResponse.json({ error: `That is ${limit} audits in an hour. Try again shortly.` }, { status: 429 })
  }

  const inputs = {
    pageUrl: target.toString(),
    objective: objective ?? null,
    market: market ?? null,
    competitorUrl: competitorUrl ?? null,
  }
  const run = await startRun({ toolId: 'campaign-audit', inputs, req, ipHash })
  await recordEvent({ event: 'free_tool_started', toolId: 'campaign-audit', runId: run.id, visitorId, props: { objective: objective ?? '' } })

  const key = cacheKey('campaign-audit', [target.toString(), objective, market, competitorUrl])
  const cached = await cacheGet<CampaignAuditResult>(key)

  try {
    if (cached) {
      await finishRun({ id: run.id, status: 'complete', result: cached, coverage: { cached: true, sources: cached.coverage } })
      await recordEvent({ event: 'free_tool_completed', toolId: 'campaign-audit', runId: run.id, visitorId, props: { cached: true, findings: cached.findings.length } })
      return NextResponse.json({ token: run.token, runId: run.id, status: 'complete', result: cached })
    }

    const outcome = await runCampaignAudit({
      pageUrl:       target.toString(),
      objective:     (objective ?? null) as CampaignObjective | null,
      market:        market ?? null,
      competitorUrl: competitorUrl ?? null,
    })

    if (!outcome.ok) {
      await finishRun({ id: run.id, status: 'failed', failureNote: outcome.note, coverage: { sources: outcome.coverage } })
      await recordEvent({ event: 'free_tool_completed', toolId: 'campaign-audit', runId: run.id, visitorId, props: { outcome: outcome.reason } })
      return NextResponse.json({ token: run.token, runId: run.id, status: 'failed', failureNote: outcome.note, coverage: outcome.coverage })
    }

    await cacheSet(key, outcome.result, CACHE_TTL)
    await finishRun({ id: run.id, status: 'complete', result: outcome.result, coverage: { sources: outcome.result.coverage } })
    await recordEvent({
      event: 'free_tool_completed', toolId: 'campaign-audit', runId: run.id, visitorId,
      props: {
        findings: outcome.result.findings.length,
        high: outcome.result.findings.filter(f => f.severity === 'high').length,
        performanceMeasured: outcome.result.performance !== null,
      },
    })

    return NextResponse.json({ token: run.token, runId: run.id, status: 'complete', result: outcome.result })
  } catch (err) {
    console.error('[campaign-audit] run failed:', err)
    await finishRun({
      id: run.id, status: 'failed',
      failureNote: 'Something broke on our side while auditing the page. Nothing about your page is implied by that.',
    })
    return NextResponse.json({ error: 'Something broke on our side. Try again in a moment.' }, { status: 500 })
  }
}
