import type { MetadataRoute } from 'next'

/**
 * The free tools are meant to be found, so the marketing surface is open and
 * everything that belongs to a tenant is not. The tool result pages are keyed
 * by an opaque token and carry no personal data, but a report is one person's
 * work rather than a page for a search engine, so they stay out of the index.
 */
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://brandgauge.app').replace(/\/$/, '')
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/onboarding', '/api/', '/tools/claim', '/portal/', '/fso/', '/survey/', '/ambassador/', '/go/', '/s/', '/ref/'],
    }],
    sitemap: `${base}/sitemap.xml`,
  }
}
