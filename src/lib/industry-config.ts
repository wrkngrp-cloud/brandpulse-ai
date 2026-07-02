// Industry-based configuration: drives module visibility, connector suggestions,
// dashboard templates, and AI prompt suggestions per brand vertical.

export const INDUSTRY_IDS = [
  'fmcg', 'fintech', 'telco', 'qsr', 'ecommerce',
  'b2b_saas', 'media', 'healthcare', 'real_estate',
  'insurance', 'fashion', 'agency', 'other',
] as const

export type IndustryId = typeof INDUSTRY_IDS[number]

export type IndustryMeta = {
  id:       IndustryId
  label:    string
  icon:     string
  tagline:  string
  examples: string
}

export const INDUSTRY_META: Record<IndustryId, IndustryMeta> = {
  fmcg: {
    id:       'fmcg',
    label:    'FMCG / Consumer Goods',
    icon:     '🛒',
    tagline:  'Packaged goods, food and beverage, home and personal care',
    examples: 'Nestle, Dangote, PZ Cussons, Unilever, Cadbury',
  },
  fintech: {
    id:       'fintech',
    label:    'Fintech / Financial Services',
    icon:     '💳',
    tagline:  'Digital banking, payments, lending, savings and insurance tech',
    examples: 'Kuda, Paystack, PiggyVest, Flutterwave, Moniepoint',
  },
  telco: {
    id:       'telco',
    label:    'Telco / Telecoms',
    icon:     '📡',
    tagline:  'Mobile networks, data services, broadband and enterprise connectivity',
    examples: 'MTN, Airtel, Glo, 9mobile, Smile Communications',
  },
  qsr: {
    id:       'qsr',
    label:    'QSR / Food Service',
    icon:     '🍔',
    tagline:  'Quick service restaurants, food delivery, cafes and casual dining',
    examples: 'Chicken Republic, Mr Biggs, Dominos, Cold Stone, Bolt Food',
  },
  ecommerce: {
    id:       'ecommerce',
    label:    'E-commerce / Retail',
    icon:     '🛍',
    tagline:  'Online and physical retail, DTC brands and marketplace sellers',
    examples: 'Jumia, Konga, Spar, Shoprite, Payporte',
  },
  b2b_saas: {
    id:       'b2b_saas',
    label:    'B2B / SaaS',
    icon:     '🖥',
    tagline:  'Business software, enterprise services, professional tools',
    examples: 'Zoho, Termii, Sendchamp, BuyPower, Accounteer',
  },
  media: {
    id:       'media',
    label:    'Media / Entertainment',
    icon:     '🎬',
    tagline:  'Publishing, streaming, film, music and digital content',
    examples: 'Showmax, Africa Magic, Audiomack, Boomplay, Pulse',
  },
  healthcare: {
    id:       'healthcare',
    label:    'Healthcare / Pharma',
    icon:     '🏥',
    tagline:  'Hospitals, pharmaceuticals, healthtech and wellness brands',
    examples: 'Emzor, May and Baker, LifeBank, Reliance HMO, Helium Health',
  },
  real_estate: {
    id:       'real_estate',
    label:    'Real Estate',
    icon:     '🏢',
    tagline:  'Property development, agencies, proptech and facilities',
    examples: 'Landwey, Revolution Plus, PropertyPro, Mixta Africa',
  },
  insurance: {
    id:       'insurance',
    label:    'Insurance',
    icon:     '🛡',
    tagline:  'Life, health, auto and SME insurance providers',
    examples: 'Leadway, AXA Mansard, Stanbic IBTC, NEM Insurance',
  },
  fashion: {
    id:       'fashion',
    label:    'Fashion / Lifestyle',
    icon:     '👗',
    tagline:  'Clothing, footwear, beauty, accessories and lifestyle brands',
    examples: 'Polo Ralph Lauren Nigeria, Veekee James, Zaron, House of Lunaris',
  },
  agency: {
    id:       'agency',
    label:    'Marketing Agency',
    icon:     '🏆',
    tagline:  'Managing campaigns, strategy and measurement for multiple clients',
    examples: 'Insight Publicis, Noah, X3M Ideas, Rosabel, DDB Lagos',
  },
  other: {
    id:       'other',
    label:    'Other',
    icon:     '✦',
    tagline:  'Logistics, education, automotive, NGO or another vertical',
    examples: '',
  },
}

// ── Module visibility ─────────────────────────────────────────────────────────
// Paths listed here are hidden from the sidebar for that industry.
// Everything not listed is visible. Users can always re-enable in Settings.

export const HIDDEN_PATHS_BY_INDUSTRY: Record<IndustryId, string[]> = {
  fmcg: [
    '/dashboard/mmm',              // requires custom MMM model setup — advanced only
  ],
  fintech: [
    '/dashboard/ooh',
    '/dashboard/radio',
    '/dashboard/tv',
    '/dashboard/print',
    '/dashboard/field-intelligence',
    '/dashboard/marketplace',
  ],
  telco: [
    '/dashboard/marketplace',
    '/dashboard/field-intelligence',
    '/dashboard/print',
  ],
  qsr: [
    '/dashboard/marketplace',
    '/dashboard/tv',
    '/dashboard/print',
    '/dashboard/mmm',
  ],
  ecommerce: [
    '/dashboard/radio',
    '/dashboard/tv',
    '/dashboard/print',
    '/dashboard/field-intelligence',
  ],
  b2b_saas: [
    '/dashboard/ooh',
    '/dashboard/radio',
    '/dashboard/tv',
    '/dashboard/print',
    '/dashboard/field-intelligence',
    '/dashboard/marketplace',
    '/dashboard/cultural',
    '/dashboard/geo-lift',
    '/dashboard/mmm',
  ],
  media: [
    '/dashboard/field-intelligence',
    '/dashboard/marketplace',
    '/dashboard/ooh',
    '/dashboard/radio',
    '/dashboard/print',
  ],
  healthcare: [
    '/dashboard/marketplace',
    '/dashboard/mmm',
    '/dashboard/field-intelligence',
  ],
  real_estate: [
    '/dashboard/marketplace',
    '/dashboard/field-intelligence',
    '/dashboard/radio',
    '/dashboard/print',
    '/dashboard/mmm',
  ],
  insurance: [
    '/dashboard/marketplace',
    '/dashboard/field-intelligence',
    '/dashboard/ooh',
    '/dashboard/radio',
    '/dashboard/print',
    '/dashboard/mmm',
  ],
  fashion: [
    '/dashboard/field-intelligence',
    '/dashboard/marketplace',
    '/dashboard/radio',
    '/dashboard/tv',
    '/dashboard/print',
    '/dashboard/mmm',
  ],
  agency: [],        // agencies see everything — they manage diverse clients
  other:  [],        // show everything by default
}

// ── Suggested connectors ──────────────────────────────────────────────────────
// Ordered by priority. Only these appear in the Connectors hub suggestion list.
// 'csv' = generic CSV uploader (always included)

export const SUGGESTED_CONNECTORS_BY_INDUSTRY: Record<IndustryId, string[]> = {
  fmcg:       ['meta_ads', 'google_ads', 'ga4', 'paystack', 'jumia', 'konga', 'csv'],
  fintech:    ['meta_ads', 'google_ads', 'ga4', 'firebase', 'appsflyer', 'hubspot', 'csv'],
  telco:      ['meta_ads', 'google_ads', 'ga4', 'firebase', 'appsflyer', 'csv'],
  qsr:        ['meta_ads', 'google_ads', 'ga4', 'firebase', 'appsflyer', 'jumia_food', 'csv'],
  ecommerce:  ['meta_ads', 'google_ads', 'ga4', 'paystack', 'flutterwave', 'shopify', 'jumia', 'csv'],
  b2b_saas:   ['meta_ads', 'google_ads', 'ga4', 'hubspot', 'paystack', 'flutterwave', 'csv'],
  media:      ['meta_ads', 'google_ads', 'ga4', 'firebase', 'appsflyer', 'csv'],
  healthcare: ['meta_ads', 'google_ads', 'ga4', 'csv'],
  real_estate:['meta_ads', 'google_ads', 'ga4', 'hubspot', 'csv'],
  insurance:  ['meta_ads', 'google_ads', 'ga4', 'hubspot', 'csv'],
  fashion:    ['meta_ads', 'google_ads', 'ga4', 'paystack', 'shopify', 'csv'],
  agency:     ['meta_ads', 'google_ads', 'ga4', 'paystack', 'flutterwave', 'hubspot', 'csv'],
  other:      ['meta_ads', 'google_ads', 'ga4', 'csv'],
}

// ── Dashboard templates ───────────────────────────────────────────────────────

export const DASHBOARD_TEMPLATE_BY_INDUSTRY: Record<IndustryId, string> = {
  fmcg:       'fmcg_cmo',
  fintech:    'fintech_growth',
  telco:      'fintech_growth',
  qsr:        'fmcg_cmo',
  ecommerce:  'fintech_growth',
  b2b_saas:   'fintech_growth',
  media:      'fmcg_cmo',
  healthcare: 'fmcg_cmo',
  real_estate:'fintech_growth',
  insurance:  'fintech_growth',
  fashion:    'fmcg_cmo',
  agency:     'agency',
  other:      'fmcg_cmo',
}

// ── Monday morning AI prompts ─────────────────────────────────────────────────

export const AI_PROMPTS_BY_INDUSTRY: Record<IndustryId, string[]> = {
  fmcg: [
    'How did last week\'s activation perform vs our KPIs?',
    'Which Lagos outlets are under-stocked this week?',
    'Compare my share of voice vs Indomie and Dangote this month.',
    'Did the Big Brother Naija sponsorship move our brand health scores?',
    'Which ambassador drove the most leads at Nourish Nigeria?',
    'Show me a jollof-season promo comparison across Lagos, Abuja and Port Harcourt.',
    'What is my cost per contact from last Saturday\'s sampling activation?',
  ],
  fintech: [
    'What is our 90-day user retention cohort looking like?',
    'Show CAC by channel — is Meta cheaper than Google this month?',
    'How many new customers did we acquire from the back-to-school campaign?',
    'What is our LTV to CAC ratio right now?',
    'Which influencer drove the most app installs last quarter?',
    'How has our NPS trended since the new onboarding flow launched?',
    'Compare brand sentiment vs our two closest competitors this week.',
  ],
  telco: [
    'What is our SIM churn rate this month vs last month?',
    'Show ARPU trend for the past 6 months.',
    'Which campaign drove the most data bundle activations?',
    'How is our brand health tracking vs MTN and Airtel?',
    'What are customers saying about our network quality this week?',
    'Which regions had the highest subscriber growth last quarter?',
  ],
  qsr: [
    'How did last weekend\'s promo perform vs the previous one?',
    'Which delivery platform — Jumia Food or Bolt — drove more orders?',
    'Show me customer sentiment for our new menu items.',
    'What is our cost per new customer from the student discount campaign?',
    'Which influencer recipe post drove the most engagement this week?',
    'How is our brand tracking vs Chicken Republic and Kilimanjaro?',
  ],
  ecommerce: [
    'What is my ROAS across Meta and Google this week?',
    'Which product category has the highest return rate this month?',
    'How did the payday sale perform vs last month?',
    'What are customers saying about our delivery experience?',
    'Show me my top 5 performing influencers by attributed orders.',
    'What is our cart abandonment trend over the past 30 days?',
  ],
  b2b_saas: [
    'How many MQLs did we generate from content this month?',
    'What is our SQL to deal conversion rate this quarter?',
    'Which channel is driving the most qualified pipeline?',
    'Show me our NPS by customer segment.',
    'What are prospects saying about us vs our top competitor?',
    'How long is our average sales cycle right now?',
  ],
  media: [
    'How did our latest content release perform on social?',
    'What is our MAU trend for the past 3 months?',
    'Which creator partnership drove the most new subscribers?',
    'Show me sentiment around our new show or series.',
    'What is our 30-day retention rate for new subscribers?',
    'How is our brand tracking vs competitor platforms this week?',
  ],
  healthcare: [
    'What are patients saying about our service quality this month?',
    'How has our brand health scored since the new campaign launched?',
    'Which channel is driving the most appointment bookings?',
    'Show me NPS scores from our post-visit surveys.',
    'How is our brand visibility tracking vs competitor clinics?',
    'What are the most common concerns patients raise online?',
  ],
  real_estate: [
    'How many qualified leads did we generate from the OOH campaign?',
    'What is our cost per lead from digital vs events this month?',
    'Show me sentiment around our latest development launch.',
    'Which content type is driving the most site visits?',
    'How is our brand tracking vs other developers in Lagos?',
    'What are buyers saying about our payment plans online?',
  ],
  insurance: [
    'What is our quote-to-policy conversion rate this month?',
    'Which campaign drove the most new policy activations?',
    'How has customer sentiment trended since the claims process update?',
    'Show me NPS scores from recent policyholders.',
    'Which channel has the lowest cost per acquisition?',
    'How is our brand tracking vs Leadway and AXA Mansard?',
  ],
  fashion: [
    'How did our latest collection launch perform on social?',
    'Which influencer drove the most sales last week?',
    'Show me sentiment around the new campaign creative.',
    'What is our return rate vs industry benchmark?',
    'How is our brand tracking vs competitor fashion labels?',
    'Which product category has the best engagement rate?',
  ],
  agency: [
    'Give me a summary of all active client campaigns this week.',
    'Which client had the best brand health movement last month?',
    'Compare influencer ROI across all active briefs.',
    'What creative assets performed best across all client accounts?',
    'Show me budget pacing for all campaigns ending this quarter.',
    'Which client needs a performance conversation based on their data?',
  ],
  other: [
    'How is my brand health trending this month?',
    'What are customers saying about us online?',
    'Which campaign drove the most engagement last week?',
    'Show me my top performing content this month.',
    'How am I tracking vs my competitors?',
    'What should I focus on to improve brand performance?',
  ],
}

// ── Key metrics per industry ──────────────────────────────────────────────────
// Surfaced prominently in the commercial metrics layer (Tier 1 manual entry).

export const KEY_METRICS_BY_INDUSTRY: Record<IndustryId, { label: string; description: string; metricKey: string }[]> = {
  fmcg: [
    { label: 'Monthly ad spend',       description: 'Total marketing spend across all channels', metricKey: 'total_spend'        },
    { label: 'Events this month',       description: 'Number of activations and sampling events', metricKey: 'event_count'        },
    { label: 'Market share',           description: 'Your % of category sales (Nielsen or estimate)', metricKey: 'market_share'  },
    { label: 'Distribution coverage',  description: '% of target outlets stocking your products', metricKey: 'distribution_pct'  },
    { label: 'Revenue this month',     description: 'Sell-in or sell-out revenue (NGN)',          metricKey: 'revenue_monthly'   },
  ],
  fintech: [
    { label: 'New customers',     description: 'New paying or active customers this month',    metricKey: 'new_customers'    },
    { label: 'Monthly ad spend',  description: 'Total marketing spend across all channels',    metricKey: 'total_spend'      },
    { label: 'Churn rate',        description: '% of customers who churned this month',        metricKey: 'churn_rate'       },
    { label: 'ARPU',              description: 'Average revenue per user per month (NGN)',     metricKey: 'arpu'             },
    { label: 'MAU',               description: 'Monthly active users on your platform',        metricKey: 'mau'              },
  ],
  telco: [
    { label: 'Active subscribers', description: 'Total active SIMs or accounts this month', metricKey: 'active_subscribers' },
    { label: 'Monthly ad spend',   description: 'Total marketing spend across all channels', metricKey: 'total_spend'       },
    { label: 'SIM churn rate',     description: '% of subscribers who churned this month',  metricKey: 'churn_rate'        },
    { label: 'ARPU',               description: 'Average revenue per user per month (NGN)', metricKey: 'arpu'              },
    { label: 'New activations',    description: 'New SIM activations this month',           metricKey: 'new_customers'     },
  ],
  qsr: [
    { label: 'Monthly orders',       description: 'Total orders across all channels',            metricKey: 'order_count'    },
    { label: 'Monthly ad spend',     description: 'Total marketing spend across all channels',   metricKey: 'total_spend'    },
    { label: 'Average order value',  description: 'Average transaction size (NGN)',              metricKey: 'aov'            },
    { label: 'Revenue this month',   description: 'Total revenue across outlets and delivery',   metricKey: 'revenue_monthly'},
    { label: 'New customers',        description: 'First-time customers this month',             metricKey: 'new_customers'  },
  ],
  ecommerce: [
    { label: 'Monthly revenue',   description: 'Total GMV or revenue this month (NGN)',        metricKey: 'revenue_monthly' },
    { label: 'Monthly ad spend',  description: 'Total marketing spend across all channels',    metricKey: 'total_spend'     },
    { label: 'Orders this month', description: 'Total orders placed',                          metricKey: 'order_count'     },
    { label: 'New customers',     description: 'First-time buyers this month',                 metricKey: 'new_customers'   },
    { label: 'Return rate',       description: '% of orders returned',                         metricKey: 'return_rate'     },
  ],
  b2b_saas: [
    { label: 'MRR',               description: 'Monthly recurring revenue (NGN)',              metricKey: 'mrr'             },
    { label: 'New customers',     description: 'New paying accounts this month',               metricKey: 'new_customers'   },
    { label: 'Monthly ad spend',  description: 'Total marketing spend across all channels',    metricKey: 'total_spend'     },
    { label: 'Churn rate',        description: '% of accounts that churned this month',        metricKey: 'churn_rate'      },
    { label: 'New MQLs',          description: 'Marketing qualified leads generated',          metricKey: 'mql_count'       },
  ],
  media: [
    { label: 'MAU',              description: 'Monthly active users or readers',            metricKey: 'mau'             },
    { label: 'New subscribers',  description: 'New paying or free subscribers this month', metricKey: 'new_customers'   },
    { label: 'Monthly ad spend', description: 'Total marketing spend across all channels', metricKey: 'total_spend'     },
    { label: 'Churn rate',       description: '% of subscribers who churned this month',   metricKey: 'churn_rate'      },
    { label: 'Revenue',          description: 'Total subscription or ad revenue (NGN)',    metricKey: 'revenue_monthly' },
  ],
  healthcare: [
    { label: 'New patients',     description: 'New patients or appointments this month',  metricKey: 'new_customers'   },
    { label: 'Monthly ad spend', description: 'Total marketing spend across all channels',metricKey: 'total_spend'     },
    { label: 'Revenue',          description: 'Total revenue from consultations (NGN)',   metricKey: 'revenue_monthly' },
    { label: 'NPS score',        description: 'Latest Net Promoter Score from patients',  metricKey: 'nps'             },
  ],
  real_estate: [
    { label: 'Leads this month', description: 'Qualified property enquiries',             metricKey: 'mql_count'       },
    { label: 'Monthly ad spend', description: 'Total marketing spend across all channels',metricKey: 'total_spend'     },
    { label: 'Deals closed',     description: 'Units sold or lettings agreed this month', metricKey: 'new_customers'   },
    { label: 'Average deal value',description:'Average property sale or rental value (NGN)',metricKey: 'aov'           },
  ],
  insurance: [
    { label: 'New policies',     description: 'New policies activated this month',        metricKey: 'new_customers'   },
    { label: 'Monthly ad spend', description: 'Total marketing spend across all channels',metricKey: 'total_spend'     },
    { label: 'Premium revenue',  description: 'Total premium collected this month (NGN)', metricKey: 'revenue_monthly' },
    { label: 'Churn rate',       description: '% of policies that lapsed this month',     metricKey: 'churn_rate'      },
  ],
  fashion: [
    { label: 'Monthly revenue',  description: 'Total sales this month (NGN)',             metricKey: 'revenue_monthly' },
    { label: 'Monthly ad spend', description: 'Total marketing spend across all channels',metricKey: 'total_spend'     },
    { label: 'Orders this month',description: 'Total orders placed',                      metricKey: 'order_count'     },
    { label: 'New customers',    description: 'First-time buyers this month',             metricKey: 'new_customers'   },
  ],
  agency: [
    { label: 'Active clients',    description: 'Number of active client accounts',         metricKey: 'active_clients'  },
    { label: 'Total spend managed',description:'Total client media spend managed (NGN)',   metricKey: 'total_spend'     },
    { label: 'Campaigns live',    description: 'Active campaigns across all clients',      metricKey: 'campaign_count'  },
  ],
  other: [
    { label: 'Monthly ad spend',  description: 'Total marketing spend across all channels',metricKey: 'total_spend'    },
    { label: 'New customers',     description: 'New customers or leads this month',        metricKey: 'new_customers'  },
    { label: 'Revenue',           description: 'Total revenue this month (NGN)',           metricKey: 'revenue_monthly'},
  ],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getIndustryFromCategory(category: string): IndustryId {
  const map: Record<string, IndustryId> = {
    'Fintech':              'fintech',
    'FMCG':                 'fmcg',
    'Telco':                'telco',
    'Fashion & Apparel':    'fashion',
    'Healthcare':           'healthcare',
    'Education':            'other',
    'Entertainment & Media':'media',
    'Retail':               'ecommerce',
    'Real Estate':          'real_estate',
    'Logistics':            'other',
    'Food & Beverage':      'qsr',
    'Automotive':           'other',
    'Other':                'other',
  }
  return map[category] ?? 'other'
}

export function isPathHidden(path: string, industry: IndustryId | null): boolean {
  if (!industry) return false
  const hidden = HIDDEN_PATHS_BY_INDUSTRY[industry] ?? []
  return hidden.some(h => path === h || path.startsWith(h + '/'))
}
