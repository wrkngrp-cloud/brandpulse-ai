/**
 * The modules a demo account could still open and find empty.
 *
 * module-pack.ts closed the first round of gaps. A per-module audit of what
 * every dashboard screen reads against what the seeds write found a second
 * round: brand equity had no review or regulatory history, the funnel had no
 * purchases or product events, MMM had no email sends to weigh, and the
 * influencer module had creators with no posts under them even though the
 * post tracker is the thing it is for.
 *
 * As with the first pack, what a brand gets is decided by its vertical. A B2B
 * SaaS brand has no Jumia storefront and a packaged-food brand has no GitHub
 * repository, so those stay empty on purpose rather than being filled with
 * something untrue.
 *
 * Deliberately NOT seeded:
 *   connector tables (social_connections, ga4_connections, hubspot_connections,
 *     email_connectors, app_store_configs, youtube_api_configs ...) hold real
 *     encrypted OAuth tokens. A fake token is worse than none: sync jobs would
 *     pick it up and fail against the provider.
 *   leads, lead_desk_admins belong to BrandGauge rather than to a tenant, and
 *     are written by the service role only. See docs/scoreboard-and-leads.md.
 *   ab_events needs an experiment and a variant, and experiments are not
 *     seeded by any account yet.
 *   sentiment_disputes needs a real auth user id, and a dispute is a rare
 *     correction rather than something a demo should look full of.
 *   sector_benchmarks is already populated by migration 20260621000001 with 53
 *     rows. It has no unique key beyond id, so seeding it again would multiply
 *     the rows on every run and add a second naming scheme ('fmcg'/'sentiment'
 *     next to the existing 'FMCG'/'sentiment') to a shared reference table.
 */
import { dateDaysAgo } from './seasonality'

/* Same structural client as module-pack, so the trackErrors proxy fits too. */
/* eslint-disable @typescript-eslint/no-explicit-any */
type Sb = { from: (table: string) => any }

const iso = (d: Date) => d.toISOString().slice(0, 10)
const ts  = (d: Date) => d.toISOString()

export type BrandType =
  | 'fmcg' | 'fintech' | 'b2b_saas' | 'agency' | 'venue'
  | 'marketplace' | 'beverage_alcohol' | 'b2b_distribution'

export interface CoveragePackConfig {
  brandId:     string
  workspaceId: string
  brandName:   string
  brandType:   BrandType
  campaignIds: (string | null | undefined)[]
  base?:       Date
}

/* Which review platform a buyer in this vertical would actually check. */
const REVIEW_PLATFORMS: Record<BrandType, string[]> = {
  fmcg:              ['jumia', 'konga'],
  beverage_alcohol:  ['jumia'],
  marketplace:       ['play_store', 'app_store', 'jumia'],
  fintech:           ['play_store', 'app_store'],
  b2b_saas:          ['g2', 'capterra'],
  venue:             ['google_maps', 'tripadvisor'],
  agency:            ['google_maps'],
  b2b_distribution:  ['google_maps'],
}

/* Aspects the schema allows, narrowed to ones that mean something per vertical. */
const REVIEW_ASPECTS: Record<BrandType, string[]> = {
  fmcg:              ['value', 'reliability'],
  beverage_alcohol:  ['value', 'service'],
  marketplace:       ['reliability', 'value', 'support'],
  fintech:           ['reliability', 'support', 'price_fairness'],
  b2b_saas:          ['feature_quality', 'support', 'price_fairness'],
  venue:             ['food', 'service', 'ambiance', 'music', 'cleanliness'],
  agency:            ['service', 'value'],
  b2b_distribution:  ['reliability', 'service'],
}

/* Regulators that actually write about each vertical in this market. */
const REGULATORS: Partial<Record<BrandType, string>> = {
  fintech:           'Central Bank of Nigeria',
  fmcg:              'NAFDAC',
  beverage_alcohol:  'NAFDAC',
  marketplace:       'Federal Competition and Consumer Protection Commission',
  b2b_distribution:  'Standards Organisation of Nigeria',
}

const HAS_APP      = new Set<BrandType>(['fintech', 'marketplace', 'b2b_saas'])
const SELLS_ONLINE = new Set<BrandType>(['fmcg', 'beverage_alcohol', 'marketplace'])

export async function seedCoveragePack(sb: Sb, cfg: CoveragePackConfig) {
  const { brandId, workspaceId, brandName, brandType, campaignIds, base } = cfg
  const campaignId = campaignIds.find(Boolean) ?? null
  const added: string[] = []

  /* ── Influencer posts ─────────────────────────────────────────────────── */
  /* The post tracker is what the influencer module is for, so a creator with
     no posts is the emptiest screen in the product. Provenance matches what a
     real pull would record: public counts are pulled, reach stays absent
     because no platform gives it for someone else's post. */
  const { data: influencers } = await sb
    .from('influencers')
    .select('id, handle, platform')
    .eq('brand_id', brandId)

  const creators = (influencers ?? []) as Array<{ id: string; handle: string | null; platform: string }>
  if (creators.length > 0) {
    const posts = creators.flatMap((c, ci) =>
      Array.from({ length: 2 }, (_, i) => {
        const n     = ci * 2 + i
        const views = 48_000 - n * 4_300
        const likes = Math.round(views * 0.071)
        const cmts  = Math.round(views * 0.0038)
        const handle = (c.handle ?? 'creator').replace(/^@/, '')
        const url = c.platform === 'tiktok'
          ? `https://www.tiktok.com/@${handle}/video/74${100000 + n}`
          : c.platform === 'twitter'
          ? `https://x.com/${handle}/status/18${400000 + n}`
          : c.platform === 'youtube'
          ? `https://www.youtube.com/watch?v=dQw4w9Wg${String(n).padStart(3, '0')}`
          : `https://www.instagram.com/reel/C${String(n).padStart(4, '0')}xYzAb/`
        return {
          brand_id:      brandId,
          influencer_id: c.id,
          campaign_id:   campaignId,
          post_url:      url,
          platform:      c.platform,
          post_type:     c.platform === 'instagram' ? 'reel' : c.platform === 'twitter' ? 'tweet' : 'video',
          views, likes, comments: cmts,
          shares: Math.round(views * 0.0021),
          // reach is owner-only on every platform, so it stays null
          metric_sources: { views: 'pulled', likes: 'pulled', comments: 'pulled', shares: 'pulled' },
          comment_samples: 'Post caption pulled from the platform.',
          created_at: ts(dateDaysAgo(50 - n * 6, base)),
        }
      }),
    )
    await sb.from('influencer_posts').insert(posts)
    added.push('influencer_posts')
  }

  /* ── Review reputation ────────────────────────────────────────────────── */
  const platforms = REVIEW_PLATFORMS[brandType] ?? ['google_maps']
  await sb.from('review_platform_snapshots').insert(
    platforms.flatMap((platform, pi) =>
      Array.from({ length: 6 }, (_, i) => {
        const end = dateDaysAgo(i * 30, base)
        return {
          brand_id:    brandId,
          platform,
          rating:      Number((4.4 - pi * 0.2 - i * 0.04).toFixed(2)),
          review_count:   1_840 - i * 120 - pi * 300,
          review_velocity: 46 - i * 3,
          period_start: iso(dateDaysAgo(i * 30 + 29, base)),
          period_end:   iso(end),
        }
      }),
    ),
  )
  added.push('review_platform_snapshots')

  await sb.from('review_aspect_sentiment').insert(
    (REVIEW_ASPECTS[brandType] ?? ['service']).flatMap((aspect, ai) =>
      (['positive', 'neutral', 'negative'] as const).map((sentiment, si) => ({
        brand_id:     brandId,
        platform:     platforms[0],
        period_start: iso(dateDaysAgo(29, base)),
        period_end:   iso(dateDaysAgo(0, base)),
        aspect, sentiment,
        score:         Number((si === 0 ? 0.72 - ai * 0.05 : si === 1 ? 0.1 : -0.55 + ai * 0.03).toFixed(2)),
        mention_count: si === 0 ? 180 - ai * 14 : si === 1 ? 64 - ai * 5 : 38 - ai * 3,
      })),
    ),
  )
  added.push('review_aspect_sentiment')

  /* ── Regulatory record ────────────────────────────────────────────────── */
  const regulator = REGULATORS[brandType]
  if (regulator) {
    await sb.from('regulatory_mentions').insert([
      {
        brand_id: brandId, source_entity: regulator,
        mention_type: 'positive_mention', sentiment: 'positive',
        headline: `${regulator} lists ${brandName} among compliant operators in its quarterly review`,
        mention_date: iso(dateDaysAgo(24, base)),
      },
      {
        brand_id: brandId, source_entity: regulator,
        mention_type: 'compliance_notice', sentiment: 'neutral',
        headline: `${regulator} issues updated reporting guidance affecting ${brandName}'s category`,
        mention_date: iso(dateDaysAgo(68, base)),
      },
      {
        brand_id: brandId, source_entity: regulator,
        mention_type: 'licence_grant', sentiment: 'positive',
        headline: `${brandName} renews its operating licence for a further three years`,
        mention_date: iso(dateDaysAgo(142, base)),
      },
    ])
    added.push('regulatory_mentions')
  }

  /* ── Developer health (open-source facing products only) ──────────────── */
  if (brandType === 'b2b_saas') {
    await sb.from('developer_health_snapshots').insert(
      Array.from({ length: 6 }, (_, i) => ({
        brand_id: brandId, platform: 'github',
        stars: 2_410 - i * 85, forks: 318 - i * 11,
        open_issues: 47 + i * 4, contributors: 62 - i * 2,
        downloads_weekly: 18_400 - i * 900,
        question_count: 128 - i * 7,
        period_end: iso(dateDaysAgo(i * 30, base)),
      })),
    )
    added.push('developer_health_snapshots')
  }

  /* ── Timeline markers, so equity charts have something to explain ─────── */
  await sb.from('brand_launch_markers').insert([
    { brand_id: brandId, label: 'Brand refresh goes live', marker_type: 'rebrand',        marker_date: iso(dateDaysAgo(196, base)) },
    { brand_id: brandId, label: 'Flagship campaign launch', marker_type: 'campaign_launch', marker_date: iso(dateDaysAgo(96, base)) },
    { brand_id: brandId, label: 'Retail partnership announced', marker_type: 'partnership', marker_date: iso(dateDaysAgo(42, base)) },
  ])
  added.push('brand_launch_markers')

  /* ── Commerce and product signal ──────────────────────────────────────── */
  await sb.from('purchase_events').insert(
    Array.from({ length: 40 }, (_, i) => ({
      brand_id: brandId,
      source:   i % 3 === 0 ? 'flutterwave' : 'paystack',
      reference: `DEMO-${brandId.slice(0, 8)}-${String(i).padStart(4, '0')}`,
      amount:    4_500 + (i % 7) * 1_850,
      currency:  'NGN',
      status:    i % 11 === 0 ? 'abandoned' : i % 17 === 0 ? 'failed' : 'success',
      occurred_at: ts(dateDaysAgo(60 - i, base)),
    })),
  )
  added.push('purchase_events')

  if (SELLS_ONLINE.has(brandType)) {
    await sb.from('ecommerce_sales').insert(
      Array.from({ length: 30 }, (_, i) => ({
        brand_id: brandId, workspace_id: workspaceId, campaign_id: campaignId,
        source:   i % 2 === 0 ? 'jumia' : 'konga',
        order_ref: `ORD-${String(90_000 + i)}`,
        product_name: `${brandName} multipack`,
        units: 1 + (i % 4),
        amount: 3_200 + (i % 5) * 1_100,
        currency: 'NGN',
        sold_at: ts(dateDaysAgo(45 - i, base)),
      })),
    )
    added.push('ecommerce_sales')
  }

  await sb.from('sdk_events').insert(
    Array.from({ length: 60 }, (_, i) => ({
      brand_id: brandId,
      event_type: ['page_view', 'signup', 'lead', 'purchase', 'conversion'][i % 5],
      value: i % 5 === 3 ? 6_400 + (i % 6) * 900 : null,
      session_id: `demo-sess-${i % 18}`,
      page_url: 'https://example.com/pricing',
      occurred_at: ts(dateDaysAgo(50 - Math.floor(i * 0.8), base)),
    })),
  )
  added.push('sdk_events')

  if (HAS_APP.has(brandType)) {
    await sb.from('app_reviews').insert(
      Array.from({ length: 24 }, (_, i) => {
        const rating = i % 9 === 0 ? 2 : i % 5 === 0 ? 3 : i % 3 === 0 ? 4 : 5
        return {
          brand_id: brandId,
          source: i % 2 === 0 ? 'google' : 'apple',
          review_id: `demo-rev-${brandId.slice(0, 8)}-${i}`,
          author: ['Chidi', 'Amaka', 'Tunde', 'Ngozi', 'Bola', 'Yetunde'][i % 6],
          rating,
          title: rating >= 4 ? 'Works well' : rating === 3 ? 'Decent, needs work' : 'Frustrating',
          body: rating >= 4
            ? 'Fast and does what it says. Support replied the same day.'
            : rating === 3
            ? 'Fine most days. Slows down in the evening.'
            : 'Kept logging me out this week. Please fix.',
          sentiment_label: rating >= 4 ? 'positive' : rating === 3 ? 'neutral' : 'negative',
          sentiment_score: rating >= 4 ? 0.68 : rating === 3 ? 0.04 : -0.61,
          reviewed_at: ts(dateDaysAgo(55 - i * 2, base)),
        }
      }),
    )
    added.push('app_reviews')
  }

  /* ── Email, which the mix model weighs as its own channel ─────────────── */
  await sb.from('email_campaign_snapshots').insert(
    Array.from({ length: 8 }, (_, i) => ({
      brand_id: brandId,
      provider: 'brevo',
      campaign_id: `demo-email-${brandId.slice(0, 8)}-${i}`,
      campaign_name: `${brandName} newsletter ${i + 1}`,
      send_date: iso(dateDaysAgo(i * 14, base)),
      recipients: 12_400 - i * 380,
      // percentages, matching what email-connector-sync.ts stores
      open_rate:  Number((34.2 - i * 0.8).toFixed(2)),
      click_rate: Number((5.1 - i * 0.2).toFixed(2)),
      unsubscribe_rate: Number((0.4 + i * 0.03).toFixed(2)),
    })),
  )
  added.push('email_campaign_snapshots')

  /* ── Digital targets, so the digital module has something to track ────── */
  if (campaignId) {
    await sb.from('campaign_targets').insert([
      { brand_id: brandId, platform_campaign_id: `demo-${brandId.slice(0, 6)}-01`, campaign_name: `${brandName} always-on`, platform: 'meta',   metric: 'cpa',  comparator: 'lte', target_value: 2_400, period: 'campaign', last_status: 'on_track' },
      { brand_id: brandId, platform_campaign_id: `demo-${brandId.slice(0, 6)}-02`, campaign_name: `${brandName} always-on`, platform: 'meta',   metric: 'roas', comparator: 'gte', target_value: 3.2,   period: 'campaign', last_status: 'off_track' },
      { brand_id: brandId, platform_campaign_id: `demo-${brandId.slice(0, 6)}-03`, campaign_name: `${brandName} search`,    platform: 'google', metric: 'ctr',  comparator: 'gte', target_value: 2.8,   period: 'daily',    last_status: 'on_track' },
    ])
    added.push('campaign_targets')
  }

  /* ── Creator deals ────────────────────────────────────────────────────── */
  await sb.from('youtube_creator_deals').insert(
    Array.from({ length: 3 }, (_, i) => ({
      brand_id: brandId, workspace_id: workspaceId,
      channel_name: ['Tayo Aina', 'Mark Angel Comedy', 'Sisi Yemmie'][i],
      channel_url: `https://www.youtube.com/@demo-channel-${i}`,
      video_url: `https://www.youtube.com/watch?v=demoVid${String(i).padStart(4, '0')}`,
      deliverables: '1 integrated mention, 1 community post',
      fee_ngn: 1_800_000 - i * 350_000,
      promo_code: `${brandName.replace(/[^A-Za-z]/g, '').slice(0, 6).toUpperCase()}${10 + i}`,
      view_guarantee: 220_000 - i * 40_000,
      actual_views:   241_300 - i * 52_000,
      linked_campaign_id: campaignId,
      deal_date: iso(dateDaysAgo(30 + i * 25, base)),
    })),
  )
  added.push('youtube_creator_deals')

  /* ── Event intercepts ─────────────────────────────────────────────────── */
  const { data: evts } = await sb.from('events').select('id').eq('brand_id', brandId)
  const eventRows = (evts ?? []) as Array<{ id: string }>
  if (eventRows.length > 0) {
    await sb.from('event_intercept_responses').insert(
      eventRows.flatMap(e =>
        Array.from({ length: 6 }, (_, i) => ({
          event_id: e.id,
          answers: {
            heard_of_us: i % 4 !== 0,
            would_recommend: 7 + (i % 4),
            where_heard: ['radio', 'a friend', 'Instagram', 'the billboard'][i % 4],
          },
          created_at: ts(dateDaysAgo(20 - i, base)),
        })),
      ),
    )
    added.push('event_intercept_responses')
  }

  /* ── Notification centre ──────────────────────────────────────────────── */
  await sb.from('notifications').insert([
    { brand_id: brandId, type: 'sentiment_alert', alert_subtype: 'volume_surge',
      title: 'Mentions up sharply', body: `${brandName} mentions are well above their usual daily range.`,
      href: '/dashboard/sentiment', baseline_value: 42, current_value: 118, z_score: 3.1,
      created_at: ts(dateDaysAgo(3, base)) },
    { brand_id: brandId, type: 'report_ready',
      title: 'Monthly board pack is ready', body: 'Your brand health summary has finished generating.',
      href: '/dashboard/board-pack', created_at: ts(dateDaysAgo(9, base)), read_at: ts(dateDaysAgo(8, base)) },
    { brand_id: brandId, type: 'sentiment_alert', alert_subtype: 'score_drop',
      title: 'Sentiment dipped after the weekend', body: 'Negative share rose on delivery complaints.',
      href: '/dashboard/sentiment', baseline_value: 71, current_value: 58, z_score: -2.4,
      created_at: ts(dateDaysAgo(17, base)) },
  ])
  added.push('notifications')

  return { added }
}
