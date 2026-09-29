/**
 * Demo data for the modules the four seed accounts were missing.
 *
 * AI visibility, marketing mix modelling and WhatsApp were empty in every demo
 * account, and TV, radio, print and field intelligence existed only for Jara
 * Foods. Each generator here returns rows for the seed to insert, so a failed
 * write is still caught by trackErrors rather than thrown away.
 *
 * Everything is relative to the run date and, where the calendar matters, uses
 * the same seasonality as the sentiment curve.
 */
import { createHash } from 'node:crypto'
import { nigeriaSeasonalFactor, dateDaysAgo } from './seasonality'

const iso = (d: Date) => d.toISOString().slice(0, 10)
const ts  = (d: Date) => d.toISOString()

/** Monday of the week containing `date`. */
function weekStart(date: Date): string {
  const d = new Date(date)
  const dow = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dow)
  return iso(d)
}

/* ── AI visibility ───────────────────────────────────────────────────────── */

export interface AiVisibilityInput {
  brandId:     string
  brandName:   string
  /** category questions a buyer would actually ask an assistant */
  questions:   string[]
  competitors: string[]
  /** roughly how often the brand gets named, 0..1, at the start of the window */
  mentionRateFrom: number
  /** and today */
  mentionRateTo:   number
  weeks?: number
  base?:  Date
}

const PLATFORMS = ['chatgpt', 'gemini', 'perplexity'] as const

export function aiVisibilityRows(input: AiVisibilityInput) {
  const { brandId, brandName, questions, competitors,
          mentionRateFrom, mentionRateTo, weeks = 12, base } = input

  const checks: Record<string, unknown>[] = []
  const scores: Record<string, unknown>[] = []

  for (let w = weeks - 1; w >= 0; w--) {
    const when = dateDaysAgo(w * 7, base)
    const week = weekStart(when)
    const t    = (weeks - 1 - w) / Math.max(1, weeks - 1)
    const rate = mentionRateFrom + (mentionRateTo - mentionRateFrom) * t

    const perPlatform: Record<string, { hits: number; weighted: number }> = {}
    let mentions = 0

    questions.forEach((question, qi) => {
      PLATFORMS.forEach((platform, pi) => {
        // deterministic so repeated seeds tell the same story
        const roll = Math.abs(Math.sin((w + 1) * 7.3 + qi * 2.1 + pi * 3.7)) % 1
        const mentioned = roll < rate
        const position = roll < rate * 0.45 ? 'early' : roll < rate * 0.8 ? 'mid' : 'late'
        const tone     = roll < rate * 0.6 ? 'positive' : roll < rate * 0.9 ? 'neutral' : 'negative'

        perPlatform[platform] ??= { hits: 0, weighted: 0 }
        if (mentioned) {
          mentions++
          perPlatform[platform].hits++
          const posW  = position === 'early' ? 1.0 : position === 'mid' ? 0.7 : 0.4
          const toneW = tone === 'positive' ? 1.1 : tone === 'neutral' ? 1.0 : 0.9
          perPlatform[platform].weighted += posW * toneW
        }

        checks.push({
          brand_id: brandId,
          platform,
          question,
          response_excerpt: mentioned
            ? `${brandName} is one of the options named, alongside ${competitors.slice(0, 2).join(' and ')}.`
            : `The answer names ${competitors.slice(0, 3).join(', ')} and does not mention ${brandName}.`,
          brand_mentioned: mentioned,
          mention_position: mentioned ? position : null,
          tone: mentioned ? tone : null,
          competitors_mentioned: competitors.slice(0, mentioned ? 2 : 3),
          checked_at: ts(when),
          week_of: week,
        })
      })
    })

    const asked = questions.length * PLATFORMS.length
    const score = (v: { hits: number; weighted: number } | undefined) =>
      v && questions.length ? Math.round((v.weighted / questions.length) * 100) : null

    scores.push({
      brand_id: brandId,
      week_of: week,
      visibility_score: Math.round(
        (Object.values(perPlatform).reduce((s, v) => s + v.weighted, 0) / asked) * 100,
      ),
      chatgpt_score:    score(perPlatform.chatgpt),
      gemini_score:     score(perPlatform.gemini),
      perplexity_score: score(perPlatform.perplexity),
      questions_asked:  asked,
      total_mentions:   mentions,
      platforms_active: [...PLATFORMS],
      top_competitors:  competitors.slice(0, 3),
      ai_recommendation: w === 0
        ? `${brandName} is named in roughly ${Math.round(rate * 100)}% of category answers. The fastest lift is category content that answers these questions directly, because assistants quote the sources that answer the question, not the sources that describe the brand.`
        : null,
    })
  }

  return { checks, scores }
}

/* ── Marketing mix modelling ─────────────────────────────────────────────── */

export interface MmmInput {
  brandId:     string
  workspaceId: string
  /** channel -> [share of contribution, spend in NGN] */
  channels:    Record<string, [number, number]>
  outcomes:    number
  summary:     string
  recommendations: string[]
  windowDays?: number
  base?:       Date
}

export function mmmRow(input: MmmInput) {
  const { brandId, workspaceId, channels, outcomes, summary,
          recommendations, windowDays = 90, base } = input

  const contributions: Record<string, number> = {}
  const spend: Record<string, number> = {}
  const roi: Record<string, number> = {}

  for (const [name, [share, amount]] of Object.entries(channels)) {
    contributions[name] = share
    spend[name] = amount
    // outcomes attributed to the channel, valued against its spend
    roi[name] = +((outcomes * share) / Math.max(1, amount / 1000)).toFixed(3)
  }

  return {
    brand_id: brandId,
    workspace_id: workspaceId,
    window_days: windowDays,
    channel_contributions: contributions,
    channel_spend: spend,
    channel_roi: roi,
    total_estimated_outcomes: outcomes,
    ai_summary: summary,
    recommendations,
    ran_at: ts(dateDaysAgo(2, base)),
  }
}

/* ── WhatsApp ────────────────────────────────────────────────────────────── */

export interface WhatsAppInput {
  brandId:   string
  brandName: string
  contacts:  { name: string; phone: string; optedIn: boolean }[]
  campaigns: { name: string; objective: string; template: string; daysAgo: number; listSize: number }[]
  base?:     Date
}

/** Never store a phone number in the send log. Hash it. */
const hashPhone = (phone: string) => createHash('sha256').update(phone).digest('hex')

export function whatsAppRows(input: WhatsAppInput) {
  const { brandId, contacts, campaigns, base } = input

  const contactRows = contacts.map(c => ({
    brand_id: brandId,
    phone_e164: c.phone,
    name: c.name,
    whatsapp_opted_in: c.optedIn,
    opted_in_at:  c.optedIn ? ts(dateDaysAgo(120, base)) : null,
    opted_out_at: c.optedIn ? null : ts(dateDaysAgo(40, base)),
  }))

  const campaignRows = campaigns.map(c => {
    const sent      = Math.round(c.listSize * 0.97)
    const delivered = Math.round(sent * 0.94)
    const read      = Math.round(delivered * 0.78)
    const replied   = Math.round(read * 0.21)
    return {
      brand_id: brandId,
      name: c.name,
      objective: c.objective,
      template_name: c.template,
      template_language: 'en',
      list_size: c.listSize,
      sent,
      delivered,
      read_count: read,
      replied,
      failed: sent - delivered,
      status: 'completed',
      scheduled_at: ts(dateDaysAgo(c.daysAgo + 1, base)),
      completed_at: ts(dateDaysAgo(c.daysAgo, base)),
    }
  })

  /** send-log rows for one campaign, phones hashed */
  const logRowsFor = (campaignId: string, daysAgo: number) =>
    contacts.filter(c => c.optedIn).map((c, i) => {
      const delivered = i % 17 !== 0
      const read = delivered && i % 3 !== 0
      return {
        campaign_id: campaignId,
        brand_id: brandId,
        recipient_hash: hashPhone(c.phone),
        wamid: `wamid.demo.${campaignId.slice(0, 8)}.${i}`,
        status: !delivered ? 'failed' : read ? 'read' : 'delivered',
        error_code: !delivered ? '131026' : null,
        sent_at:      ts(dateDaysAgo(daysAgo, base)),
        delivered_at: delivered ? ts(dateDaysAgo(daysAgo, base)) : null,
        read_at:      read ? ts(dateDaysAgo(daysAgo, base)) : null,
      }
    })

  return { contactRows, campaignRows, logRowsFor }
}

/* ── Seasonal helper re-export so seeds import from one place ────────────── */
export { nigeriaSeasonalFactor, dateDaysAgo }
