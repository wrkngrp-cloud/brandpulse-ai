import { inngest } from '../client'
import { createServiceClient } from '@/lib/supabase/server'

const REGULATORY_ENTITIES = [
  'CBN', 'Central Bank of Nigeria',
  'SEC', 'Securities and Exchange Commission',
  'NDIC', 'Nigerian Deposit Insurance',
  'EFCC', 'Economic and Financial Crimes',
  'NAICOM', 'National Insurance Commission',
  'NAFDAC', 'National Agency for Food',
  'APCON', 'Advertising Practitioners Council',
  'NCC', 'Nigerian Communications Commission',
  'FIRS', 'Federal Inland Revenue',
  'CAC', 'Corporate Affairs Commission',
  'Financial Reporting Council',
  'Financial Intelligence Unit',
]

const SANCTION_TERMS     = ['sanction', 'fine', 'penali', 'revok', 'suspend', 'bar', 'prohibit', 'cease', 'delist', 'shutdown']
const INVESTIGATION_TERMS = ['investigat', 'probe', 'scrutin', 'review', 'audit', 'inquir', 'allegat', 'charg']
const POSITIVE_TERMS      = ['licen', 'approv', 'grant', 'certif', 'recogni', 'award', 'compli', 'accredit']

type MentionType = 'licence_grant' | 'sanction' | 'investigation' | 'compliance_notice' | 'positive_mention' | 'neutral'

function classifyMention(text: string): MentionType | null {
  const lower = text.toLowerCase()

  const hasEntity = REGULATORY_ENTITIES.some(e => lower.includes(e.toLowerCase()))
  if (!hasEntity) return null

  if (SANCTION_TERMS.some(t => lower.includes(t)))     return 'sanction'
  if (INVESTIGATION_TERMS.some(t => lower.includes(t))) return 'investigation'
  if (POSITIVE_TERMS.some(t => lower.includes(t)))      return 'positive_mention'

  return 'compliance_notice'
}

function detectEntity(text: string): string {
  const lower = text.toLowerCase()
  for (const entity of REGULATORY_ENTITIES) {
    if (lower.includes(entity.toLowerCase())) return entity
  }
  return 'Unknown'
}

export const regulatoryMentionDetect = inngest.createFunction(
  {
    id:       'regulatory-mention-detect',
    name:     'Regulatory Mention Detector (weekly)',
    triggers: [{ cron: 'TZ=Africa/Lagos 0 6 * * 1' }],
    retries:  1,
  },
  async ({ step, logger }) => {
    const sb = await createServiceClient()

    // Only run for fintech brands — they face the most regulatory exposure
    const { data: brands } = await sb
      .from('brands')
      .select('id, name')
      .in('brand_type', ['fintech', 'b2b_saas', 'marketplace'])

    if (!brands?.length) return { processed: 0 }

    let totalInserted = 0

    for (const brand of brands) {
      const inserted = await step.run(`detect-${brand.id}`, async () => {
        // Fetch press mentions from last 14 days not yet classified
        const since = new Date()
        since.setDate(since.getDate() - 14)

        const { data: mentions } = await sb
          .from('press_mentions')
          .select('id, headline, url, published_at')
          .eq('brand_id', brand.id)
          .gte('published_at', since.toISOString())
          .order('published_at', { ascending: false })
          .limit(100)

        if (!mentions?.length) return 0

        // Check which ones already have regulatory_mentions records to avoid duplication
        const { data: existing } = await sb
          .from('regulatory_mentions')
          .select('url')
          .eq('brand_id', brand.id)
          .gte('mention_date', since.toISOString().split('T')[0])

        const existingUrls = new Set((existing ?? []).map(r => r.url))
        let count = 0

        for (const mention of mentions) {
          if (!mention.headline) continue
          if (mention.url && existingUrls.has(mention.url)) continue

          const mentionType = classifyMention(mention.headline)
          if (!mentionType) continue

          const sourceEntity = detectEntity(mention.headline)
          const sentiment    = mentionType === 'sanction' || mentionType === 'investigation'
            ? 'negative'
            : mentionType === 'positive_mention' || mentionType === 'licence_grant'
            ? 'positive'
            : 'neutral'

          await sb.from('regulatory_mentions').insert({
            brand_id:      brand.id,
            source_entity: sourceEntity,
            mention_type:  mentionType,
            sentiment,
            headline:      mention.headline,
            url:           mention.url ?? null,
            mention_date:  mention.published_at
              ? new Date(mention.published_at).toISOString().split('T')[0]
              : new Date().toISOString().split('T')[0],
          })
          count++
        }

        logger.info(`Brand ${brand.name}: ${count} regulatory mentions detected`)
        return count
      })

      totalInserted += inserted
    }

    return { processed: brands.length, totalInserted }
  }
)
