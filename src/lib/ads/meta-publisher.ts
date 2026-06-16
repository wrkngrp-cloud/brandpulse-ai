/**
 * meta-publisher.ts
 * Push an ad_draft to the Meta Marketing API (Graph v21.0).
 * The ad starts PAUSED — the brand reviews before going live.
 */

import { decrypt } from '@/lib/crypto'

const GRAPH = 'https://graph.facebook.com/v21.0'

export interface AdDraftPayload {
  id:             string
  brand_id:       string
  platform:       'meta'
  headline:       string
  body:           string | null
  cta:            string | null
  destination_url: string
  media_urls:     string[]
  target_audience: Record<string, unknown>
  placement:      string[] | null
  budget_daily:   number | null
  budget_total:   number | null
  start_date:     string | null
  end_date:       string | null
}

export interface MetaPublishResult {
  success:        boolean
  campaign_id?:   string
  adset_id?:      string
  platform_ad_id?: string
  error?:         string
}

interface MetaApiError {
  error?: {
    message: string
    type:    string
    code:    number
  }
}

interface MetaCreateResponse extends MetaApiError {
  id?: string
}

async function apiPost(
  path:    string,
  token:   string,
  body:    Record<string, unknown>
): Promise<MetaCreateResponse> {
  const res = await fetch(`${GRAPH}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ ...body, access_token: token }),
  })
  return res.json() as Promise<MetaCreateResponse>
}

/**
 * publishToMeta
 * Creates campaign → ad set → ad creative → ad, all starting PAUSED.
 *
 * @param draft         The ad draft to publish
 * @param encryptedToken  The encrypted Meta access token from digital_ad_accounts
 * @param adAccountId   The Meta ad account ID (act_XXXXXXXXX)
 */
export async function publishToMeta(
  draft:          AdDraftPayload,
  encryptedToken: string,
  adAccountId:    string
): Promise<MetaPublishResult> {
  const token = decrypt(encryptedToken)

  // 1. Create campaign
  const campaignBody: Record<string, unknown> = {
    name:             `[BP] ${draft.headline}`,
    objective:        'OUTCOME_AWARENESS',
    status:           'PAUSED',
    special_ad_categories: [],
  }

  const campaignRes = await apiPost(`/${adAccountId}/campaigns`, token, campaignBody)
  if (campaignRes.error || !campaignRes.id) {
    return { success: false, error: campaignRes.error?.message ?? 'Campaign creation failed' }
  }
  const campaignId = campaignRes.id

  // 2. Create ad set
  const adSetBody: Record<string, unknown> = {
    name:             `[BP] ${draft.headline} — Ad Set`,
    campaign_id:      campaignId,
    status:           'PAUSED',
    optimization_goal: 'REACH',
    billing_event:    'IMPRESSIONS',
    bid_amount:       200,   // ₦2.00 default bid (in cents equivalent, Meta uses subunit)
    targeting:        buildTargeting(draft.target_audience),
  }

  // Budget: prefer daily, fall back to lifetime
  if (draft.budget_daily) {
    adSetBody.daily_budget     = Math.round(draft.budget_daily * 100)   // Meta uses subunits (kobo for NGN)
  } else if (draft.budget_total) {
    adSetBody.lifetime_budget  = Math.round(draft.budget_total * 100)
    if (draft.end_date) adSetBody.end_time = new Date(draft.end_date).toISOString()
  }

  if (draft.start_date) {
    adSetBody.start_time = new Date(draft.start_date).toISOString()
  }

  const adSetRes = await apiPost(`/${adAccountId}/adsets`, token, adSetBody)
  if (adSetRes.error || !adSetRes.id) {
    return { success: false, campaign_id: campaignId, error: adSetRes.error?.message ?? 'Ad set creation failed' }
  }
  const adSetId = adSetRes.id

  // 3. Create ad creative
  const creativeBody: Record<string, unknown> = {
    name:        `[BP] ${draft.headline} — Creative`,
    object_story_spec: buildStorySpec(draft),
  }

  const creativeRes = await apiPost(`/${adAccountId}/adcreatives`, token, creativeBody)
  if (creativeRes.error || !creativeRes.id) {
    return { success: false, campaign_id: campaignId, adset_id: adSetId, error: creativeRes.error?.message ?? 'Creative creation failed' }
  }
  const creativeId = creativeRes.id

  // 4. Create ad (starts PAUSED)
  const adBody: Record<string, unknown> = {
    name:       `[BP] ${draft.headline}`,
    adset_id:   adSetId,
    creative:   { creative_id: creativeId },
    status:     'PAUSED',
  }

  const adRes = await apiPost(`/${adAccountId}/ads`, token, adBody)
  if (adRes.error || !adRes.id) {
    return {
      success:     false,
      campaign_id: campaignId,
      adset_id:    adSetId,
      error:       adRes.error?.message ?? 'Ad creation failed',
    }
  }

  return {
    success:         true,
    campaign_id:     campaignId,
    adset_id:        adSetId,
    platform_ad_id:  adRes.id,
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function buildTargeting(audience: Record<string, unknown>): Record<string, unknown> {
  // Merge caller-supplied audience with sane Nigeria defaults
  return {
    geo_locations: {
      countries: ['NG'],
    },
    age_min:       (audience.age_min as number | undefined) ?? 18,
    age_max:       (audience.age_max as number | undefined) ?? 65,
    genders:       (audience.genders  as number[] | undefined) ?? [0],  // 0 = all
    ...audience,
  }
}

function buildStorySpec(draft: AdDraftPayload): Record<string, unknown> {
  const hasMedia  = draft.media_urls.length > 0
  const firstUrl  = draft.media_urls[0]

  const callToAction = draft.cta
    ? { type: mapCta(draft.cta), value: { link: draft.destination_url } }
    : undefined

  if (hasMedia) {
    return {
      link_data: {
        link:        draft.destination_url,
        message:     draft.body ?? draft.headline,
        name:        draft.headline,
        picture:     firstUrl,
        call_to_action: callToAction,
      },
    }
  }

  return {
    link_data: {
      link:        draft.destination_url,
      message:     draft.body ?? draft.headline,
      name:        draft.headline,
      call_to_action: callToAction,
    },
  }
}

function mapCta(label: string): string {
  const map: Record<string, string> = {
    'Shop Now':      'SHOP_NOW',
    'Learn More':    'LEARN_MORE',
    'Sign Up':       'SIGN_UP',
    'Contact Us':    'CONTACT_US',
    'Download':      'DOWNLOAD',
    'Get Quote':     'GET_QUOTE',
    'Book Now':      'BOOK_NOW',
    'Subscribe':     'SUBSCRIBE',
    'Watch More':    'WATCH_MORE',
    'Apply Now':     'APPLY_NOW',
  }
  return map[label] ?? 'LEARN_MORE'
}
