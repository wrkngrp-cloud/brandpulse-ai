/**
 * The module registry.
 *
 * One list of every dashboard module the product ships, keyed by a stable
 * short key rather than by path, so a URL can change without orphaning the
 * usage history recorded against it.
 *
 * This exists for the Desk: adoption reporting needs to ask "which of these
 * has this account never opened", and that question needs a denominator. The
 * navigation in `src/components/dashboard/dashboard-nav.tsx` is the user's
 * view of the same set and carries the icons, which is why this file is
 * separate: it holds no React, so middleware, API routes and Inngest jobs can
 * all import it.
 *
 * `signal` names the BHI component or funnel stage the module feeds, where it
 * feeds one. The adoption engine ranks an unused module by the weight of its
 * signal for that brand's `brand_type`, so an empty module that drags the
 * score outranks an empty module that does not.
 */

export interface ModuleDef {
  key:    string
  label:  string
  path:   string
  group:  'core' | 'intelligence' | 'campaigns' | 'creative' | 'research' | 'planning' | 'retention' | 'exec'
  signal?: 'awareness' | 'perception' | 'consideration' | 'action' | 'loyalty' | 'advocacy'
}

export const MODULES: ModuleDef[] = [
  { key: 'overview',      label: 'Overview',           path: '/dashboard',                    group: 'core' },
  { key: 'sentiment',     label: 'Sentiment',          path: '/dashboard/sentiment',           group: 'core',          signal: 'perception' },
  { key: 'brand_health',  label: 'Brand Health',       path: '/dashboard/brand-equity',        group: 'core' },
  { key: 'content',       label: 'Content',            path: '/dashboard/content',             group: 'core',          signal: 'awareness' },
  { key: 'funnel',        label: 'Funnel',             path: '/dashboard/funnel',              group: 'core' },

  { key: 'competitive',   label: 'Competitive',        path: '/dashboard/competitive',         group: 'intelligence',  signal: 'consideration' },
  { key: 'marketplace',   label: 'Marketplace',        path: '/dashboard/marketplace',         group: 'intelligence',  signal: 'action' },
  { key: 'cultural',      label: 'Cultural Insights',  path: '/dashboard/cultural',            group: 'intelligence',  signal: 'perception' },
  { key: 'field_intel',   label: 'Field Intelligence', path: '/dashboard/field-intelligence',  group: 'intelligence',  signal: 'action' },
  { key: 'pr',            label: 'PR Tracking',        path: '/dashboard/pr',                  group: 'intelligence',  signal: 'awareness' },
  { key: 'youtube',       label: 'YouTube',            path: '/dashboard/youtube',             group: 'intelligence',  signal: 'awareness' },
  { key: 'ai_visibility', label: 'AI Visibility',      path: '/dashboard/ai-visibility',       group: 'intelligence',  signal: 'awareness' },

  { key: 'campaigns',     label: 'All Campaigns',      path: '/dashboard/campaigns',           group: 'campaigns' },
  { key: 'digital',       label: 'Digital Ads',        path: '/dashboard/digital',             group: 'campaigns',     signal: 'action' },
  { key: 'influencers',   label: 'Influencers',        path: '/dashboard/influencers',         group: 'campaigns',     signal: 'awareness' },
  { key: 'ooh',           label: 'Out of Home',        path: '/dashboard/ooh',                 group: 'campaigns',     signal: 'awareness' },
  { key: 'events',        label: 'Events & Activation',path: '/dashboard/events',              group: 'campaigns',     signal: 'action' },
  { key: 'radio',         label: 'Radio',              path: '/dashboard/radio',               group: 'campaigns',     signal: 'awareness' },
  { key: 'tv',            label: 'TV',                 path: '/dashboard/tv',                  group: 'campaigns',     signal: 'awareness' },
  { key: 'print',         label: 'Print',              path: '/dashboard/print',               group: 'campaigns',     signal: 'awareness' },
  { key: 'whatsapp',      label: 'WhatsApp',           path: '/dashboard/whatsapp',            group: 'campaigns',     signal: 'loyalty' },

  { key: 'voice_builder', label: 'Voice Builder',      path: '/dashboard/voice-builder',       group: 'creative' },
  { key: 'pre_post',      label: 'Pre-Post Intel',     path: '/dashboard/pre-post',            group: 'creative' },
  { key: 'creative',      label: 'Creative Analysis',  path: '/dashboard/creative',            group: 'creative' },

  { key: 'surveys',       label: 'All Surveys',        path: '/dashboard/surveys',             group: 'research',      signal: 'perception' },
  { key: 'nps',           label: 'NPS Tracker',        path: '/dashboard/surveys/nps',         group: 'research',      signal: 'advocacy' },
  { key: 'panels',        label: 'Tracking Panels',    path: '/dashboard/surveys/panels',      group: 'research',      signal: 'perception' },

  { key: 'mmm',           label: 'Media Mix',          path: '/dashboard/mmm',                 group: 'planning' },
  { key: 'geo_lift',      label: 'Geo-Lift',           path: '/dashboard/geo-lift',            group: 'planning' },
  { key: 'budget',        label: 'Budget & Pacing',    path: '/dashboard/budget',              group: 'planning' },

  { key: 'retention',     label: 'Retention Risk',     path: '/dashboard/retention',           group: 'retention',     signal: 'loyalty' },
  { key: 'loyalty',       label: 'Loyalty Engine',     path: '/dashboard/loyalty',             group: 'retention',     signal: 'loyalty' },
  { key: 'advocacy',      label: 'Advocacy',           path: '/dashboard/advocacy',            group: 'retention',     signal: 'advocacy' },
  { key: 'cdp',           label: 'Customer Data',      path: '/dashboard/cdp',                 group: 'retention' },

  { key: 'board_pack',    label: 'Board Pack',         path: '/dashboard/board-pack',          group: 'exec' },
  { key: 'business_case', label: 'Business Case',      path: '/dashboard/business-case',       group: 'exec' },
  { key: 'methodology',   label: 'Methodology',        path: '/dashboard/methodology',         group: 'exec' },
]

const BY_KEY = new Map(MODULES.map(m => [m.key, m]))

/** Longest path first, so /dashboard/surveys/nps wins over /dashboard/surveys. */
const BY_PATH_DESC = [...MODULES].sort((a, b) => b.path.length - a.path.length)

export function moduleForPath(pathname: string): ModuleDef | null {
  if (pathname === '/dashboard' || pathname === '/dashboard/') return BY_KEY.get('overview') ?? null
  return BY_PATH_DESC.find(m =>
    m.path !== '/dashboard' && (pathname === m.path || pathname.startsWith(m.path + '/')),
  ) ?? null
}

export function isModuleKey(key: string): boolean {
  return BY_KEY.has(key)
}

export function moduleLabel(key: string): string {
  return BY_KEY.get(key)?.label ?? key
}
