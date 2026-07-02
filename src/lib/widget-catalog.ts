// Widget catalog — defines all available dashboard widgets.
// size: 'sm' = 1 col, 'md' = 2 col, 'lg' = 2x2, 'full' = full width

export type WidgetSize = 'sm' | 'md' | 'lg' | 'full'

export type WidgetDef = {
  id:          string
  label:       string
  description: string
  icon:        string        // emoji
  size:        WidgetSize
  href?:       string        // drill-down link
  dataKey?:    string        // which data prop feeds this widget
}

export const WIDGET_CATALOG: WidgetDef[] = [
  // ── Commercial ──────────────────────────────────────────────────────────
  { id: 'marketing-roi-score', label: 'Marketing ROI Score',   description: 'Overall commercial marketing effectiveness, 0 to 100.',  icon: '📊', size: 'sm', href: '/dashboard/board-pack' },
  { id: 'attributed-revenue',  label: 'Attributed Revenue',    description: 'Revenue attributed to marketing activities this month.',  icon: '₦',  size: 'sm' },
  { id: 'ltv-cac',             label: 'LTV to CAC',            description: 'Customer lifetime value divided by acquisition cost.',    icon: '⚖',  size: 'sm', href: '/dashboard/board-pack' },
  { id: 'roas-channel',        label: 'ROAS by Channel',        description: 'Return on ad spend broken down by campaign channel.',    icon: '📈', size: 'md', href: '/dashboard/campaigns' },
  { id: 'budget-vs-actual',    label: 'Budget vs Actual',       description: 'Planned marketing budget tracked against real spend.',   icon: '💰', size: 'md', href: '/dashboard/budget' },

  // ── Brand Health ─────────────────────────────────────────────────────────
  { id: 'bhi-score',           label: 'Brand Health Index',     description: 'Your brand overall health score, 0 to 100.',            icon: '❤', size: 'sm', href: '/dashboard/brand-equity', dataKey: 'bhi' },
  { id: 'sentiment-trend',     label: 'Sentiment Trend',        description: 'How audience sentiment has shifted over time.',         icon: '📉', size: 'md', href: '/dashboard/sentiment',   dataKey: 'trendData' },
  { id: 'share-of-voice',      label: 'Share of Voice',         description: 'Your share of category conversation vs competitors.',   icon: '🔊', size: 'sm', href: '/dashboard/brand-equity', dataKey: 'sovScore' },
  { id: 'emv-counter',         label: 'Earned Media Value',     description: 'What your organic coverage would cost as paid ads.',    icon: '📰', size: 'sm', href: '/dashboard/brand-equity' },
  { id: 'cultural-resonance',  label: 'Cultural Resonance',     description: 'How well your content connects with your audience.',    icon: '🌍', size: 'sm', href: '/dashboard/cultural' },

  // ── Campaigns ────────────────────────────────────────────────────────────
  { id: 'campaign-leaderboard',label: 'Campaign Leaderboard',   description: 'Top performing campaigns ranked by key metrics.',      icon: '🏆', size: 'lg', href: '/dashboard/campaigns', dataKey: 'activeCampaigns' },
  { id: 'digital-performance', label: 'Digital Performance',    description: 'Reach, impressions and conversions from digital ads.',  icon: '🖥', size: 'md', href: '/dashboard/digital' },

  // ── Events & Influencers ─────────────────────────────────────────────────
  { id: 'event-calendar',      label: 'Event Calendar',         description: 'Upcoming activations, sampling events and campaigns.',  icon: '📅', size: 'md', href: '/dashboard/events',    dataKey: 'upcomingEvents' },
  { id: 'ambassador-board',    label: 'Ambassador Leaderboard', description: 'Brand reps ranked by verified activations and reach.',  icon: '👥', size: 'md', href: '/dashboard/events' },
  { id: 'influencer-roi',      label: 'Influencer ROI',         description: 'Influencer performance ranked by naira per engagement.',icon: '⭐', size: 'md', href: '/dashboard/influencers' },
  { id: 'visual-mentions',     label: 'Visual Brand Mentions',  description: 'Photos where AI spotted your logo or product.',        icon: '📸', size: 'lg', href: '/dashboard/events' },

  // ── Intelligence ─────────────────────────────────────────────────────────
  { id: 'competitor-digest',   label: 'Competitor Briefing',    description: 'Weekly AI summary of competitor activity.',            icon: '🔍', size: 'full',href: '/dashboard/competitive' },
  { id: 'recent-mentions',     label: 'Recent Mentions',        description: 'Latest brand mentions across social platforms.',       icon: '💬', size: 'md', href: '/dashboard/sentiment',  dataKey: 'recentMentions' },

  // ── Research ─────────────────────────────────────────────────────────────
  { id: 'nps-score',           label: 'NPS Score',              description: 'Net Promoter Score from your most recent survey.',     icon: '⭐', size: 'sm', href: '/dashboard/surveys/nps' },
  { id: 'outlet-alerts',       label: 'Outlet Stock Alerts',    description: 'Outlets below stock threshold this week.',             icon: '⚠', size: 'md', href: '/dashboard/field-intelligence' },
  { id: 'field-coverage',      label: 'Field Sales Coverage',   description: 'Outlet coverage across regions by your field team.',   icon: '🗺', size: 'lg', href: '/dashboard/field-intelligence' },

  // ── Measurement ──────────────────────────────────────────────────────────
  { id: 'geo-lift-map',        label: 'Geo-Lift Map',           description: 'Sales uplift in areas exposed to your OOH campaigns.', icon: '📍', size: 'lg', href: '/dashboard/geo-lift' },
  { id: 'ai-insights',         label: 'AI Insights Feed',       description: 'Three things worth your attention today.',             icon: '✨', size: 'full', dataKey: 'brandName' },
  { id: 'board-pack-export',   label: 'Board Pack',             description: 'One-click PDF report ready for your next board meeting.',icon: '📋',size: 'sm', href: '/dashboard/board-pack' },
]

export const WIDGET_BY_ID = Object.fromEntries(WIDGET_CATALOG.map(w => [w.id, w]))

// ── Templates ─────────────────────────────────────────────────────────────────

export type DashboardTemplate = {
  id:          string
  label:       string
  description: string
  icon:        string
  widgetIds:   string[]
}

export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  {
    id:          'fmcg_cmo',
    label:       'FMCG CMO',
    description: 'Brand health, field coverage, competitive intelligence and campaign performance.',
    icon:        '🛒',
    widgetIds:   ['bhi-score','share-of-voice','sentiment-trend','campaign-leaderboard','event-calendar','ambassador-board','competitor-digest','outlet-alerts','field-coverage','budget-vs-actual','ai-insights'],
  },
  {
    id:          'fintech_growth',
    label:       'Fintech Growth',
    description: 'Commercial metrics, acquisition efficiency, retention and campaign ROAS.',
    icon:        '💳',
    widgetIds:   ['marketing-roi-score','attributed-revenue','ltv-cac','roas-channel','bhi-score','sentiment-trend','campaign-leaderboard','influencer-roi','nps-score','budget-vs-actual','ai-insights'],
  },
  {
    id:          'agency',
    label:       'Agency',
    description: 'Multi-client view: campaign leaderboards, creative performance and influencer ROI.',
    icon:        '🏆',
    widgetIds:   ['campaign-leaderboard','influencer-roi','sentiment-trend','share-of-voice','bhi-score','roas-channel','visual-mentions','competitor-digest','budget-vs-actual','board-pack-export','ai-insights'],
  },
  {
    id:          'field_ops',
    label:       'Field Operations',
    description: 'Field coverage, outlet alerts, event calendar and ambassador leaderboard.',
    icon:        '🗺',
    widgetIds:   ['outlet-alerts','field-coverage','event-calendar','ambassador-board','budget-vs-actual','bhi-score','campaign-leaderboard','ai-insights'],
  },
]

export const TEMPLATE_BY_ID = Object.fromEntries(DASHBOARD_TEMPLATES.map(t => [t.id, t]))

export const DEFAULT_WIDGET_IDS = [
  'bhi-score','sentiment-trend','share-of-voice','campaign-leaderboard',
  'event-calendar','recent-mentions','ai-insights',
]

// Map industry to template
export const TEMPLATE_BY_INDUSTRY: Record<string, string> = {
  fmcg:       'fmcg_cmo',
  qsr:        'fmcg_cmo',
  ecommerce:  'fintech_growth',
  fintech:    'fintech_growth',
  telco:      'fintech_growth',
  b2b_saas:   'fintech_growth',
  media:      'fintech_growth',
  healthcare: 'fmcg_cmo',
  real_estate:'fintech_growth',
  insurance:  'fintech_growth',
  fashion:    'fmcg_cmo',
  agency:     'agency',
  other:      'fmcg_cmo',
}
