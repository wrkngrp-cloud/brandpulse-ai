import { inngest } from '../client'
import { createServiceClient } from '@/lib/supabase/server'

// Syncs GitHub stars/forks/issues, npm weekly downloads, Stack Overflow question count
// for developer-facing brands (fintech with public APIs, B2B SaaS, marketplaces)

async function fetchGitHubRepo(repo: string): Promise<{
  stars: number; forks: number; open_issues: number; contributors: number | null
} | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'BrandGauge/1.0',
        // Use token if available for higher rate limit
        ...(process.env.GITHUB_TOKEN ? { Authorization: `token ${process.env.GITHUB_TOKEN}` } : {}),
      },
    })
    if (!res.ok) return null
    const data = await res.json() as {
      stargazers_count: number; forks_count: number; open_issues_count: number
    }
    return {
      stars:       data.stargazers_count,
      forks:       data.forks_count,
      open_issues: data.open_issues_count,
      contributors: null, // requires separate API call, skip for now
    }
  } catch { return null }
}

async function fetchNpmDownloads(packageName: string): Promise<{ downloads_weekly: number } | null> {
  try {
    // npm API: last-week downloads
    const encoded = encodeURIComponent(packageName)
    const res = await fetch(`https://api.npmjs.org/downloads/point/last-week/${encoded}`)
    if (!res.ok) return null
    const data = await res.json() as { downloads: number }
    return { downloads_weekly: data.downloads ?? 0 }
  } catch { return null }
}

async function fetchStackOverflowTag(tag: string): Promise<{ question_count: number } | null> {
  try {
    const res = await fetch(
      `https://api.stackexchange.com/2.3/tags/${encodeURIComponent(tag)}/info?site=stackoverflow`
    )
    if (!res.ok) return null
    const data = await res.json() as { items?: { count?: number }[] }
    const count = data.items?.[0]?.count ?? null
    return count != null ? { question_count: count } : null
  } catch { return null }
}

export const developerHealthSync = inngest.createFunction(
  {
    id: 'developer-health-sync',
    name: 'Developer Health Sync (GitHub/npm/StackOverflow)',
    triggers: [
      { cron: 'TZ=Africa/Lagos 0 8 * * 3' }, // weekly Wednesday 8am Lagos
      { event: 'brandgauge/developer.health.sync' },
    ],
    retries: 2,
  },
  async ({ event, step, logger }) => {
    const sb = await createServiceClient()
    const eventData = event?.data as { brand_id?: string } | undefined

    // Developer-facing brands with at least one ecosystem identifier configured
    const query = sb.from('brands')
      .select('id, name, github_repo, npm_package_name, stackoverflow_tag, brand_type')
      .in('brand_type', ['fintech', 'b2b_saas', 'marketplace'])
    if (eventData?.brand_id) query.eq('id', eventData.brand_id)

    const { data: brands } = await query

    if (!brands?.length) {
      logger.info('No developer-facing brands found, skipping')
      return { processed: 0 }
    }

    const today = new Date().toISOString().split('T')[0]
    let synced = 0

    for (const brand of brands) {
      if (brand.github_repo) {
        await step.run(`github-${brand.id}`, async () => {
          const svc = await createServiceClient()
          const ghData = await fetchGitHubRepo(brand.github_repo as string)
          if (!ghData) {
            logger.info(`GitHub fetch returned null for ${brand.name} (${brand.github_repo})`)
            return
          }
          await svc.from('developer_health_snapshots').insert({
            brand_id:    brand.id,
            platform:    'github',
            stars:       ghData.stars,
            forks:       ghData.forks,
            open_issues: ghData.open_issues,
            period_end:  today,
          })
          logger.info(`GitHub synced for ${brand.name}: ${ghData.stars} stars`)
        })
        synced++
      }

      if (brand.npm_package_name) {
        await step.run(`npm-${brand.id}`, async () => {
          const svc = await createServiceClient()
          const npmData = await fetchNpmDownloads(brand.npm_package_name as string)
          if (!npmData) {
            logger.info(`npm fetch returned null for ${brand.name} (${brand.npm_package_name})`)
            return
          }
          await svc.from('developer_health_snapshots').insert({
            brand_id:         brand.id,
            platform:         'npm',
            downloads_weekly: npmData.downloads_weekly,
            period_end:       today,
          })
          logger.info(`npm synced for ${brand.name}: ${npmData.downloads_weekly} weekly downloads`)
        })
        synced++
      }

      if (brand.stackoverflow_tag) {
        await step.run(`so-${brand.id}`, async () => {
          const svc = await createServiceClient()
          const soData = await fetchStackOverflowTag(brand.stackoverflow_tag as string)
          if (!soData) {
            logger.info(`Stack Overflow fetch returned null for ${brand.name} (${brand.stackoverflow_tag})`)
            return
          }
          await svc.from('developer_health_snapshots').insert({
            brand_id:       brand.id,
            platform:       'stackoverflow',
            question_count: soData.question_count,
            period_end:     today,
          })
          logger.info(`Stack Overflow synced for ${brand.name}: ${soData.question_count} questions`)
        })
        synced++
      }
    }

    return { processed: brands.length, synced }
  }
)
