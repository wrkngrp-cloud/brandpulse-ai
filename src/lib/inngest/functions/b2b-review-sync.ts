import { inngest } from '../client'
import { createServiceClient } from '@/lib/supabase/server'

// G2 and Capterra public page scrapers for aggregate ratings.
// Only runs for brands with brand_type in (b2b_saas, marketplace) that have slugs configured.

async function fetchG2Rating(slug: string): Promise<{ rating: number; count: number } | null> {
  try {
    const url = `https://www.g2.com/products/${slug}/reviews`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
      },
    })
    if (!res.ok) return null
    const html = await res.text()

    // G2 embeds structured JSON-LD with AggregateRating
    const jsonLdMatch = html.match(/"aggregateRating":\s*\{[^}]*"ratingValue"\s*:\s*"?([0-9.]+)"?[^}]*"reviewCount"\s*:\s*"?([0-9]+)"?/) ||
                        html.match(/"ratingValue"\s*:\s*"?([0-9.]+)"?/)
    if (!jsonLdMatch) return null

    const countMatch = html.match(/"reviewCount"\s*:\s*"?([0-9,]+)"?/)
    return {
      rating: parseFloat(jsonLdMatch[1]),
      count: countMatch ? parseInt(countMatch[1].replace(/,/g, ''), 10) : 0,
    }
  } catch {
    return null
  }
}

async function fetchCapterraRating(slug: string): Promise<{ rating: number; count: number } | null> {
  try {
    // Capterra product pages: capterra.com/p/[slug] or capterra.com/software/[slug]/
    const url = `https://www.capterra.com/p/${slug}/`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })
    if (!res.ok) return null
    const html = await res.text()

    const ratingMatch = html.match(/"ratingValue"\s*:\s*"?([0-9.]+)"?/)
    const countMatch  = html.match(/"reviewCount"\s*:\s*"?([0-9,]+)"?/)
    if (!ratingMatch) return null

    return {
      rating: parseFloat(ratingMatch[1]),
      count: countMatch ? parseInt(countMatch[1].replace(/,/g, ''), 10) : 0,
    }
  } catch {
    return null
  }
}

export const b2bReviewSync = inngest.createFunction(
  {
    id: 'b2b-review-sync',
    name: 'B2B Review Platform Sync (G2/Capterra)',
    triggers: [
      { cron: 'TZ=Africa/Lagos 0 10 * * 1' }, // weekly Monday 10am Lagos
      { event: 'brandpulse/b2b.reviews.sync' },
    ],
    retries: 2,
  },
  async ({ event, step, logger }) => {
    const sb = await createServiceClient()
    const eventData = event?.data as { brand_id?: string } | undefined

    // Fetch B2B SaaS / marketplace brands with g2_slug or capterra_slug
    const query = sb.from('brands')
      .select('id, name, g2_slug, capterra_slug, brand_type')
      .in('brand_type', ['b2b_saas', 'marketplace'])
    if (eventData?.brand_id) query.eq('id', eventData.brand_id)

    const { data: brands } = await query

    if (!brands?.length) {
      logger.info('No B2B SaaS/marketplace brands with review slugs, skipping')
      return { processed: 0 }
    }

    const today = new Date().toISOString().split('T')[0]
    let synced = 0

    for (const brand of brands) {
      if (brand.g2_slug) {
        await step.run(`g2-${brand.id}`, async () => {
          const svc = await createServiceClient()
          const data = await fetchG2Rating(brand.g2_slug as string)
          if (!data) {
            logger.info(`G2 fetch returned null for ${brand.name} (${brand.g2_slug})`)
            return
          }
          const { data: prev } = await svc
            .from('review_platform_snapshots')
            .select('review_count')
            .eq('brand_id', brand.id)
            .eq('platform', 'g2')
            .order('period_end', { ascending: false })
            .limit(1).maybeSingle()

          await svc.from('review_platform_snapshots').insert({
            brand_id: brand.id,
            platform: 'g2',
            rating: +data.rating.toFixed(2),
            review_count: data.count,
            review_velocity: Math.max(0, data.count - (prev?.review_count ?? 0)),
            period_end: today,
            metadata: { slug: brand.g2_slug },
          })
          logger.info(`G2 synced for ${brand.name}: ${data.rating}/5 (${data.count} reviews)`)
        })
        synced++
      }

      if (brand.capterra_slug) {
        await step.run(`capterra-${brand.id}`, async () => {
          const svc = await createServiceClient()
          const data = await fetchCapterraRating(brand.capterra_slug as string)
          if (!data) {
            logger.info(`Capterra fetch returned null for ${brand.name} (${brand.capterra_slug})`)
            return
          }
          const { data: prev } = await svc
            .from('review_platform_snapshots')
            .select('review_count')
            .eq('brand_id', brand.id)
            .eq('platform', 'capterra')
            .order('period_end', { ascending: false })
            .limit(1).maybeSingle()

          await svc.from('review_platform_snapshots').insert({
            brand_id: brand.id,
            platform: 'capterra',
            rating: +data.rating.toFixed(2),
            review_count: data.count,
            review_velocity: Math.max(0, data.count - (prev?.review_count ?? 0)),
            period_end: today,
            metadata: { slug: brand.capterra_slug },
          })
          logger.info(`Capterra synced for ${brand.name}: ${data.rating}/5 (${data.count} reviews)`)
        })
        synced++
      }
    }

    return { processed: brands.length, synced }
  }
)
