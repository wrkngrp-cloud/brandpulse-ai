import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createCampaign, trackingUrlFor, withUtm } from '@/lib/tools/offline-tracker'
import { CAMPAIGN_TYPES, FREE_PLACEMENT_LIMIT, type CampaignType } from '@/lib/tools/campaign-labels'
import { finishRun, hashIp, ipOf, runByToken, startRun } from '@/lib/tools/runs'
import { recordEvent } from '@/lib/tools/events'
import { withinRateLimit } from '@/lib/tools/limits'
import { normaliseUrl } from '@/lib/tools/fetch-public'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * Create a tracked offline campaign, with no account.
 *
 * Unlike the other three tools this one writes something durable for the
 * visitor on the first request: slugs that will be printed. There is no cache
 * here for that reason — two identical requests are two campaigns, because the
 * marketer asked for links twice and the second set is not a duplicate of the
 * first, it is a second set of posters.
 */

const Body = z.object({
  name:           z.string().trim().min(2).max(80),
  campaignType:   z.enum(CAMPAIGN_TYPES),
  destinationUrl: z.string().trim().min(4).max(500),
  market:         z.string().trim().max(60).optional(),
  placements:     z.array(z.object({ name: z.string().trim().min(1).max(60) })).min(1).max(FREE_PLACEMENT_LIMIT),
  visitorId:      z.string().max(64).optional(),
})

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Give the campaign a name, a type, a destination and up to ${FREE_PLACEMENT_LIMIT} placements.` },
      { status: 400 },
    )
  }
  const { name, campaignType, destinationUrl, market, placements, visitorId } = parsed.data

  const destination = normaliseUrl(destinationUrl)
  if (!destination) {
    return NextResponse.json({ error: 'That destination did not look like a web address.' }, { status: 400 })
  }

  const ipHash = hashIp(ipOf(req))
  const { allowed, limit } = await withinRateLimit('offline-tracker', ipHash)
  if (!allowed) {
    return NextResponse.json(
      { error: `That is ${limit} campaigns in an hour. Try again shortly, or continue in BrandGauge where campaigns are unlimited.` },
      { status: 429 },
    )
  }

  const inputs = {
    campaignName: name, campaignType, destinationUrl: destination.toString(),
    market: market ?? null, placementCount: placements.length,
  }
  const run = await startRun({ toolId: 'offline-tracker', inputs, req, ipHash })
  await recordEvent({ event: 'free_tool_started', toolId: 'offline-tracker', runId: run.id, visitorId, props: { campaignType } })

  try {
    const campaign = await createCampaign({
      runId: run.id,
      name,
      campaignType: campaignType as CampaignType,
      destinationUrl: destination.toString(),
      market: market ?? null,
      placements,
    })

    if (!campaign.placements.length) throw new Error('no placements were created')

    const result = { campaign, createdAt: new Date().toISOString() }
    await finishRun({
      id: run.id, status: 'complete', result,
      coverage: { sources: [{ source: 'Tracking links and QR codes generated', read: true }] },
    })
    await recordEvent({
      event: 'free_tool_completed', toolId: 'offline-tracker', runId: run.id, visitorId,
      props: { placements: campaign.placements.length, campaignType },
    })

    return NextResponse.json({ token: run.token, runId: run.id, status: 'complete', result })
  } catch (err) {
    console.error('[offline-tracker] creation failed:', err)
    await finishRun({
      id: run.id, status: 'failed',
      failureNote: 'We could not generate the links. Nothing was printed, so nothing is broken; try again.',
    })
    return NextResponse.json({ error: 'We could not generate the links. Try again in a moment.' }, { status: 500 })
  }
}

/**
 * The anonymous campaign dashboard, by run token.
 *
 * This is how someone who has not signed up comes back to the numbers a week
 * after printing the posters. The token is the whole authorisation and the
 * table holds only its hash; no personal data lives on a campaign, which is
 * what makes the link safe to keep in a browser or send to a colleague.
 *
 * Form responses are deliberately absent from this payload even when a
 * campaign has them, because those carry names and phone numbers and belong
 * to a workspace rather than to a token.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'No campaign token.' }, { status: 400 })

  const run = await runByToken<{ campaign?: { campaignId?: string } }>(token)
  if (!run || run.toolId !== 'offline-tracker') {
    return NextResponse.json({ error: 'That campaign has expired or never existed.' }, { status: 404 })
  }

  const svc = await createServiceClient()
  const { data: campaign } = await svc
    .from('tool_campaigns')
    .select('id, name, campaign_type, destination_url, market, brand_id, response_enabled, created_at')
    .eq('run_id', run.id)
    .maybeSingle()

  if (!campaign) return NextResponse.json({ error: 'That campaign is gone.' }, { status: 404 })

  const { data: placements } = await svc
    .from('tool_placements')
    .select('id, name, slug, utm_content, visits, unique_visits, created_at')
    .eq('campaign_id', campaign.id)
    .order('created_at', { ascending: true })

  const { data: recent } = await svc
    .from('tool_visits')
    .select('placement_id, device_type, ip_region, referrer, is_unique, is_bot, created_at')
    .eq('campaign_id', campaign.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const bots = (recent ?? []).filter(v => v.is_bot).length

  return NextResponse.json({
    campaign: {
      id:              campaign.id,
      name:            campaign.name,
      campaignType:    campaign.campaign_type,
      destinationUrl:  campaign.destination_url,
      market:          campaign.market,
      claimed:         campaign.brand_id !== null,
      responseEnabled: campaign.response_enabled,
      createdAt:       campaign.created_at,
    },
    placements: (placements ?? []).map(p => ({
      id:                 p.id,
      name:               p.name,
      slug:               p.slug,
      utmContent:         p.utm_content,
      visits:             p.visits,
      uniqueVisits:       p.unique_visits,
      trackingUrl:        trackingUrlFor(p.slug),
      destinationWithUtm: withUtm(campaign.destination_url, {
        campaignType: campaign.campaign_type as CampaignType,
        campaignName: campaign.name,
        placementUtm: p.utm_content,
      }),
    })),
    recentVisits: (recent ?? []).filter(v => !v.is_bot).slice(0, 25),
    filteredAutomated: bots,
  })
}
