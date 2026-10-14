import type { MetadataRoute } from 'next'
import { FREE_TOOLS } from '@/lib/tools/registry'

/**
 * The public surface, for search engines.
 *
 * Each free tool is a real page answering a real query ("competitor tracker
 * Nigeria", "landing page audit"), which is the point of building them as
 * indexable pages rather than as app routes behind a login. Everything behind
 * /dashboard is deliberately absent.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://brandgauge.app').replace(/\/$/, '')
  const now = new Date()

  const marketing = ['', '/features', '/use-cases', '/tools', '/privacy-policy'].map(path => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: path === '' ? 1 : 0.8,
  }))

  const tools = FREE_TOOLS.map(tool => ({
    url: `${base}${tool.route}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }))

  // /tools is in both lists above; the directory entry wins on priority.
  const seen = new Set<string>()
  return [...tools, ...marketing].filter(entry => {
    if (seen.has(entry.url)) return false
    seen.add(entry.url)
    return true
  })
}
