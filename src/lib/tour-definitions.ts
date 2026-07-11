export interface TourStep {
  id:        string
  title:     string
  body:      string
  target?:   string
  position?: 'top' | 'bottom' | 'left' | 'right'
}

// Route → tour module, for the topbar's "Show me around" button to figure out
// which tour applies to the page you're currently on. Keep in sync with every
// TourTrigger placed in src/app/dashboard/**.
export const TOUR_ROUTE_MODULE: Record<string, string> = {
  '/dashboard':                       'overview',
  '/dashboard/sentiment':             'sentiment',
  '/dashboard/brand-equity':          'brand_health',
  '/dashboard/content':               'content',
  '/dashboard/funnel':                'funnel',
  '/dashboard/surveys/nps':           'nps',
  '/dashboard/surveys/panels':        'survey_panels',
  '/dashboard/surveys':               'surveys',
  '/dashboard/competitive':           'competitive',
  '/dashboard/marketplace':           'marketplace',
  '/dashboard/cultural':              'cultural',
  '/dashboard/field-intelligence':    'field_intelligence',
  '/dashboard/pr':                    'pr',
  '/dashboard/campaigns':             'campaigns',
  '/dashboard/digital':               'digital',
  '/dashboard/influencers':           'influencers',
  '/dashboard/ooh':                   'ooh',
  '/dashboard/events':                'events',
  '/dashboard/radio':                 'radio',
  '/dashboard/tv':                    'tv',
  '/dashboard/print':                 'print',
  '/dashboard/voice-builder':         'voice_builder',
  '/dashboard/pre-post':              'pre_post',
  '/dashboard/creative-library':      'creative_library',
  '/dashboard/creative-fatigue':      'creative_fatigue',
  '/dashboard/creative':              'creative',
  '/dashboard/experiments':           'experiments',
  '/dashboard/mmm':                   'mmm',
  '/dashboard/geo-lift':              'geo_lift',
  '/dashboard/budget':                'budget',
  '/dashboard/retention':             'retention',
  '/dashboard/loyalty':               'loyalty',
  '/dashboard/advocacy':              'advocacy',
  '/dashboard/cdp':                   'cdp',
  '/dashboard/board-pack':            'board_pack',
  '/dashboard/business-case':         'business_case',
  '/dashboard/methodology':           'methodology',
  '/dashboard/connectors':            'connectors',
}

// Longest-prefix match so nested routes (e.g. /dashboard/surveys/nps) resolve
// to their own module instead of falling back to a shorter parent route.
export function getModuleForPath(pathname: string): string | null {
  let best: string | null = null
  for (const route of Object.keys(TOUR_ROUTE_MODULE)) {
    if (pathname === route || pathname.startsWith(`${route}/`)) {
      if (!best || route.length > best.length) best = route
    }
  }
  return best ? TOUR_ROUTE_MODULE[best] : null
}

export const TOUR_DEFINITIONS: Record<string, TourStep[]> = {

  overview: [
    {
      id:    'welcome',
      title: 'Your marketing command centre',
      body:  'Everything you need to measure, analyse and justify your marketing spend is here. Let us show you around in under a minute.',
    },
    {
      id:       'quick-actions',
      title:    'Start something new',
      body:     'Pin an OOH site, create an event, launch a consumer survey or run a quick pre-post content check without leaving this page.',
      target:   '[data-tour="quick-actions"]',
      position: 'bottom',
    },
    {
      id:       'kpi-row',
      title:    'Four numbers that matter',
      body:     'Brand Health Index, Sentiment Score, Share of Voice and Mention volume update whenever new data arrives. Tap any card to drill in.',
      target:   '[data-tour="kpi-row"]',
      position: 'bottom',
    },
    {
      id:       'bento-grid',
      title:    'Live brand snapshot',
      body:     'These cards pull from every connected source including social, surveys, campaigns and events so you always see what is happening right now.',
      target:   '[data-tour="bento-grid"]',
      position: 'top',
    },
    {
      id:       'ask-ai',
      title:    'Ask anything',
      body:     'Click the chat icon to ask any question about your brand in plain English. The AI reads all your data and gives you a grounded answer in seconds.',
      target:   '[data-tour="ask-ai"]',
      position: 'left',
    },
  ],

  brand_health: [
    {
      id:    'bhi-intro',
      title: 'Your Brand Health Index explained',
      body:  'BHI is a single 0 to 100 score that blends awareness, sentiment, perception, share of voice and earned media value into one number.',
    },
    {
      id:       'bhi-gauge',
      title:    'Reading the gauge',
      body:     'Green means your brand is healthy and growing. Amber signals a warning worth investigating. Red means something needs attention urgently.',
      target:   '[data-tour="bhi-gauge"]',
      position: 'right',
    },
    {
      id:       'components',
      title:    'What drives the score',
      body:     'Each component contributes a weighted slice. Low sentiment pulls the score down even when awareness is high, which is common after a PR incident.',
      target:   '[data-tour="bhi-components"]',
      position: 'bottom',
    },
    {
      id:       'history',
      title:    'Track progress over time',
      body:     'The trend line shows how your brand has moved over the selected date range. Share it with stakeholders to show the impact of your work.',
      target:   '[data-tour="bhi-history"]',
      position: 'top',
    },
    {
      id:    'improve',
      title: 'How to move the needle',
      body:  'Connect more data sources, run regular perception surveys and keep campaigns active. Each new data point sharpens the score.',
    },
  ],

  campaigns: [
    {
      id:    'campaigns-intro',
      title: 'Track every campaign in one place',
      body:  'Log your Flutterwave promos, seasonal activations, digital pushes and above-the-line bursts here. All spend and results land in one view.',
    },
    {
      id:       'campaign-list',
      title:    'Status at a glance',
      body:     'Active, paused and completed campaigns show budget spent, objectives and performance. Filter by date range to compare periods.',
      target:   '[data-tour="campaign-list"]',
      position: 'bottom',
    },
    {
      id:       'new-campaign',
      title:    'Create a campaign',
      body:     'Hit New Campaign to define your objectives, budget, channels and dates. BrandGauge will start tracking impact from day one.',
      target:   '[data-tour="new-campaign"]',
      position: 'bottom',
    },
    {
      id:       'campaign-detail',
      title:    'Drill into performance',
      body:     'Each campaign page shows reach, impressions, engagement and how brand metrics moved during the flight period.',
      target:   '[data-tour="campaign-list"]',
      position: 'right',
    },
    {
      id:    'digital-tracking',
      title: 'Connect your ad accounts',
      body:  'Link Meta Ads and Google Analytics in Connectors to pull spend and clicks automatically. No manual exports needed.',
    },
  ],

  events: [
    {
      id:    'events-intro',
      title: 'Log every BTL activation',
      body:  'Road shows, trade fairs, store launches, pop-ups and consumer activations all count. BrandGauge turns each one into a measurable data point.',
    },
    {
      id:       'event-list',
      title:    'Planned and live events',
      body:     'See what is coming up and what is currently running. Status updates from planned to live to reported as your team checks in.',
      target:   '[data-tour="event-list"]',
      position: 'bottom',
    },
    {
      id:       'create-event',
      title:    'Log a new activation',
      body:     'Add the city, venue, activation type and expected footfall. Ambassadors on the ground can log leads through the ambassador PWA.',
      target:   '[data-tour="create-event"]',
      position: 'bottom',
    },
    {
      id:    'attribution',
      title: 'How event ROI is measured',
      body:  'BrandGauge compares brand search uplift before, during and after each event and matches ambassador-captured leads to the campaign.',
    },
    {
      id:    'post-event',
      title: 'Post-event report',
      body:  'Once you mark an event as reported, open it to see a summary of reach, leads, estimated ROI and sentiment change generated automatically.',
    },
  ],

  influencers: [
    {
      id:    'influencers-intro',
      title: 'Know which creators actually move your brand',
      body:  'Track every influencer you work with, calculate their true earned media value and compare it against what you paid.',
    },
    {
      id:       'roi-tracker',
      title:    'Earned media value',
      body:     'EMV converts impressions and engagement into a naira equivalent based on Nigerian CPM and CPE benchmarks for your category.',
      target:   '[data-tour="influencer-roi"]',
      position: 'bottom',
    },
    {
      id:       'post-tracker',
      title:    'All their posts in one feed',
      body:     'BrandGauge pulls every tagged post into the post tracker so you can see reach, likes, comments and sentiment without chasing screenshots.',
      target:   '[data-tour="influencer-posts"]',
      position: 'bottom',
    },
    {
      id:    'tier-comparison',
      title: 'Nano vs macro performance',
      body:  'Nigerian nano-creators (under 50k followers) often outperform macro influencers on trust and conversion for FMCG and finance brands.',
    },
    {
      id:    'add-influencer',
      title: 'Add an influencer',
      body:  'Paste their Instagram or X handle to start tracking. Posts mentioning your brand or tagged to your account are picked up automatically.',
    },
  ],

  competitive: [
    {
      id:    'competitive-intro',
      title: 'See where you stand against competitors',
      body:  'Add your main competitors and BrandGauge will track their share of voice, mention volume and sentiment alongside yours.',
    },
    {
      id:       'sov-comparison',
      title:    'Share of voice head to head',
      body:     'SOV shows the percentage of total brand conversations in your category that belong to you. Losing share is an early warning of slipping relevance.',
      target:   '[data-tour="competitive-sov"]',
      position: 'bottom',
    },
    {
      id:       'mention-trends',
      title:    'Mention volume trends',
      body:     'Spikes in a competitor\'s mentions often signal a campaign launch, a crisis or a viral moment. Knowing early lets you respond fast.',
      target:   '[data-tour="competitive-mentions"]',
      position: 'bottom',
    },
    {
      id:       'sentiment-gap',
      title:    'Sentiment gap analysis',
      body:     'If a competitor has lower sentiment than you but higher SOV, that is an opening. More conversation does not always mean more love.',
      target:   '[data-tour="competitive-sentiment"]',
      position: 'top',
    },
    {
      id:    'add-competitor',
      title: 'Add a competitor',
      body:  'Type their brand name and handles in the Competitive settings. BrandGauge starts tracking from the next crawl, usually within 24 hours.',
    },
  ],

  connectors: [
    {
      id:    'connectors-intro',
      title: 'Connect your data sources',
      body:  'BrandGauge works best when it can see all your data. Connect social accounts, ad platforms and CRM tools to get the full picture.',
    },
    {
      id:       'social-connectors',
      title:    'Social media accounts',
      body:     'Link your Instagram Business and X accounts so BrandGauge can pull mentions, engagement and reach directly. No manual exports.',
      target:   '[data-tour="social-connectors"]',
      position: 'bottom',
    },
    {
      id:       'paid-connectors',
      title:    'Paid media platforms',
      body:     'Connect Meta Ads and Google Analytics to bring campaign spend and web traffic into your brand dashboards automatically.',
      target:   '[data-tour="paid-connectors"]',
      position: 'bottom',
    },
    {
      id:       'payments-connectors',
      title:    'Payments and commerce',
      body:     'Link Paystack, Flutterwave or your e-commerce sales to match marketing activity with revenue so you can show real business impact.',
      target:   '[data-tour="payments-connectors"]',
      position: 'bottom',
    },
    {
      id:    'connectors-flow',
      title: 'How data flows',
      body:  'Once connected, each source syncs on a schedule. You can trigger a manual sync at any time from the connector settings panel.',
    },
  ],

  sentiment: [
    {
      id:    'sentiment-intro',
      title: 'What people are saying, every night',
      body:  'BrandGauge crawls X and Instagram for mentions of your brand at 4 AM Lagos time and scores the tone of every conversation.',
    },
    {
      id:       'sentiment-main',
      title:    'Score, trend and mentions in one view',
      body:     'The top tiles show your overall score plus positive and negative share. Below that, a trend chart, a calendar heatmap and a feed of individual mentions you can dispute if the AI got the tone wrong.',
      target:   '[data-tour="sentiment-main"]',
      position: 'top',
    },
    {
      id:    'sentiment-alerts',
      title: 'Alerts catch trouble early',
      body:  'A sudden spike in negative mentions or a sustained slide triggers an alert with an AI explanation of what likely caused it, so you find out before it becomes a crisis.',
    },
  ],

  content: [
    {
      id:    'content-intro',
      title: 'Your owned content, measured',
      body:  'See how your posts perform and how much of the conversation in your category belongs to you.',
    },
    {
      id:       'content-main',
      title:    'Share of voice and post performance',
      body:     'The SOV card compares you against the competitors you are tracking. Below it, every post pulled from your connected accounts lands in a table you can tag by funnel stage.',
      target:   '[data-tour="content-main"]',
      position: 'top',
    },
    {
      id:    'content-tip',
      title: 'Connect more accounts for a fuller picture',
      body:  'SOV is only as complete as the accounts you have connected. Add Instagram and X in Connectors if you have not already.',
    },
  ],

  funnel: [
    {
      id:    'funnel-intro',
      title: 'From strangers to advocates',
      body:  'The Brand Funnel scores six stages, awareness, consideration, preference, action, loyalty and advocacy, so you can see exactly where people drop off.',
    },
    {
      id:       'funnel-main',
      title:    'Six stages, one score each',
      body:     'Every stage blends several signals into a 0 to 100 score. Open a stage to see the data points behind it, or ask the AI why a stage scored the way it did.',
      target:   '[data-tour="funnel-main"]',
      position: 'top',
    },
    {
      id:    'funnel-diagnose',
      title: 'Diagnose with AI',
      body:  'Click Diagnose with AI at the top for a plain-English read of where your biggest drop-off is and what is likely causing it.',
    },
  ],

  surveys: [
    {
      id:    'surveys-intro',
      title: 'Ask your audience directly',
      body:  'Surveys fill the gaps that social listening cannot. Run a Perception Audit for the full 8-dimension brand picture, or launch a quick one-off survey.',
    },
    {
      id:       'surveys-main',
      title:    'Perception Audit and everything else',
      body:     'The Perception Audit chart at the top tracks 8 brand dimensions over time. Below it, every other survey you have launched or plan to launch shows up in one list.',
      target:   '[data-tour="surveys-main"]',
      position: 'top',
    },
    {
      id:    'surveys-distribution',
      title: 'Reach people where they are',
      body:  'Every survey delivers by email, in-app and WhatsApp at once, so response rates stay healthy without extra work from you.',
    },
  ],

  nps: [
    {
      id:    'nps-intro',
      title: 'One number for loyalty',
      body:  'Net Promoter Score asks a single question, how likely are you to recommend us, and turns the answers into promoters, passives and detractors.',
    },
    {
      id:       'nps-main',
      title:    'Score and 12-week trend',
      body:     'The four tiles show your current NPS and the split behind it. The chart below tracks the trend week by week so you can catch a slide before it becomes a pattern.',
      target:   '[data-tour="nps-main"]',
      position: 'bottom',
    },
    {
      id:    'nps-diagnose',
      title: 'Diagnose with AI',
      body:  'When you have enough responses, Diagnose with AI reads the verbatims behind your score and summarises the biggest themes driving it up or down.',
    },
  ],

  survey_panels: [
    {
      id:    'panels-intro',
      title: 'Set it up once, track it forever',
      body:  'Tracking Panels auto-dispatch the same survey to the same audience every month or quarter, so you get a clean trend line without remembering to send anything.',
    },
    {
      id:       'panels-main',
      title:    'Your recurring panels',
      body:     'Each panel shows its cadence, next run date, and recipient count across email and WhatsApp. Pause, resume or dispatch early at any time.',
      target:   '[data-tour="panels-main"]',
      position: 'bottom',
    },
    {
      id:    'panels-new',
      title: 'Create a new panel',
      body:  'Hit New panel, pick a survey template and a cadence, and add your recipient list. BrandGauge handles the rest.',
    },
  ],

  marketplace: [
    {
      id:    'marketplace-intro',
      title: 'Track your shelf on Jumia and Konga',
      body:  'See how your products are priced, rated and reviewed on Nigerian marketplaces, and how you stack up against competitors selling the same category.',
    },
    {
      id:       'marketplace-main',
      title:    'Your products and the competition',
      body:     'Filter between your own listings and competitor products. Add a snapshot any time you check a price, rating or shelf position so BrandGauge can chart the trend.',
      target:   '[data-tour="marketplace-main"]',
      position: 'top',
    },
    {
      id:    'marketplace-add',
      title: 'Add a product to track',
      body:  'Hit Add product and paste the marketplace listing link. BrandGauge keeps an eye on price and rating changes from there.',
    },
  ],

  cultural: [
    {
      id:    'cultural-intro',
      title: 'How well you fit the culture',
      body:  'Cultural Intelligence scores how your content resonates with Nigerian and West African audiences, and flags upcoming moments worth activating around.',
    },
    {
      id:       'cultural-main',
      title:    'Resonance score and calendar',
      body:     'The gauge at the top blends recent content analyses into one score. Scroll down for AI-scored cultural moments with ready-made activation ideas, and a full calendar of what is coming up.',
      target:   '[data-tour="cultural-main"]',
      position: 'top',
    },
    {
      id:    'cultural-ideas',
      title: 'Get ideas for any moment',
      body:  'Click Get ideas on any cultural moment for AI-generated activation concepts tailored to your brand voice.',
    },
  ],

  field_intelligence: [
    {
      id:    'field-intel-intro',
      title: 'Your distribution network, live',
      body:  'Field Intelligence turns what your field officers see on the ground, availability, pricing, POSM placement, competitor activity, into a live dashboard.',
    },
    {
      id:       'field-intel-main',
      title:    'Availability, compliance and alerts',
      body:     'The top row shows outlets visited, availability rate, POSM compliance and out-of-stock alerts. Below it, an area-by-area breakdown and a feed of recent field reports.',
      target:   '[data-tour="field-intel-main"]',
      position: 'bottom',
    },
    {
      id:    'field-intel-setup',
      title: 'Set up your field team',
      body:  'This dashboard populates once your field officers start submitting reports through the field app. Set up your team in Settings to get started.',
    },
  ],

  pr: [
    {
      id:    'pr-intro',
      title: 'Earned media, measured',
      body:  'PR Tracking pulls in press coverage and shows how it moves your brand health, not just how many articles ran.',
    },
    {
      id:       'pr-main',
      title:    'EMV, sentiment and mentions',
      body:     'The summary row shows earned media value, reach, mention count and positive rate. Below it, recent press mentions, a monthly volume chart and how you compare to competitor coverage.',
      target:   '[data-tour="pr-main"]',
      position: 'top',
    },
    {
      id:    'pr-crawl',
      title: 'Trigger a fresh crawl',
      body:  'No coverage showing yet? Trigger a PR crawl to pull in the latest press mentions right away.',
    },
  ],

  digital: [
    {
      id:    'digital-intro',
      title: 'Every ad platform, one view',
      body:  'Digital Campaigns pulls spend, reach and performance from every connected ad platform so you stop tab-switching between dashboards.',
    },
    {
      id:       'digital-main',
      title:    'Connect a platform to get started',
      body:     'Connect Meta, Google, X, TikTok or LinkedIn here. Once connected, spend, impressions, CTR, CPC and ROAS populate automatically below.',
      target:   '[data-tour="digital-main"]',
      position: 'bottom',
    },
    {
      id:    'digital-framework',
      title: 'Awareness, consideration, conversion',
      body:  'The Performance Framework groups your metrics into the three stages that matter for paid media, with benchmarks so you know if a number is actually good.',
    },
  ],

  ooh: [
    {
      id:    'ooh-intro',
      title: 'Billboards you can actually measure',
      body:  'Out of Home Intelligence tracks each site you book and attributes real search and traffic uplift back to it, not just impressions you have to take on faith.',
    },
    {
      id:       'ooh-main',
      title:    'Your sites at a glance',
      body:     'Every billboard, wall wrap or activation you add shows its location, flight dates and attribution results in one list.',
      target:   '[data-tour="ooh-main"]',
      position: 'bottom',
    },
    {
      id:    'ooh-add',
      title: 'Add your first site',
      body:  'Hit Add site and drop a pin. BrandGauge starts tracking branded vanity link clicks and search uplift for that location from day one.',
    },
  ],

  radio: [
    {
      id:    'radio-intro',
      title: 'Reconcile your radio buy',
      body:  'Upload your agency buy plan, then log what actually aired, and BrandGauge reconciles delivery against spend across every station.',
    },
    {
      id:       'radio-main',
      title:    'Spots, impressions and spend',
      body:     'The KPI row compares spots planned to spots aired and shows gross impressions and cost per thousand. The schedule table below has every spot, station and daypart.',
      target:   '[data-tour="radio-main"]',
      position: 'top',
    },
    {
      id:    'radio-upload',
      title: 'Start with a template',
      body:  'Download the template, fill in your buy plan, and upload it to populate this dashboard in one go.',
    },
  ],

  tv: [
    {
      id:    'tv-intro',
      title: 'Reconcile your TV buy',
      body:  'Upload your agency buy plan, then log what actually aired, and BrandGauge reconciles GRP delivery against spend across every channel.',
    },
    {
      id:       'tv-main',
      title:    'GRPs, impressions and spend',
      body:     'The KPI row compares GRPs planned to GRPs delivered and shows gross impressions and cost per rating point. The schedule table below has every spot, channel and daypart.',
      target:   '[data-tour="tv-main"]',
      position: 'top',
    },
    {
      id:    'tv-upload',
      title: 'Start with a template',
      body:  'Download the template, fill in your buy plan, and upload it to populate this dashboard in one go.',
    },
  ],

  print: [
    {
      id:    'print-intro',
      title: 'Newspaper and magazine, tracked',
      body:  'Log your print placements and BrandGauge tracks readership, spend and QR scan attribution across Nigeria’s leading publications.',
    },
    {
      id:       'print-main',
      title:    'Insertions, readership and QR scans',
      body:     'The KPI row shows total insertions, spend, estimated readership and QR scans. The placements table below has every insertion with its own trackable QR link.',
      target:   '[data-tour="print-main"]',
      position: 'top',
    },
    {
      id:    'print-upload',
      title: 'Start with a template',
      body:  'Download the template, fill in your media plan, and upload it to populate this dashboard in one go.',
    },
  ],

  voice_builder: [
    {
      id:    'voice-intro',
      title: 'Teach BrandGauge your voice',
      body:  'Paste a handful of your best posts or captions and BrandGauge extracts a brand voice profile, tone, vocabulary, dos and don’ts, that every other tool in BrandGauge can write in.',
    },
    {
      id:       'voice-main',
      title:    'Build, retune, generate',
      body:     'Build Voice extracts your profile from samples. Once you have one, Retune Caption rewrites any draft to match it, and Generate Captions writes fresh copy from an idea.',
      target:   '[data-tour="voice-main"]',
      position: 'bottom',
    },
    {
      id:    'voice-samples',
      title: 'Better samples, better profile',
      body:  'Use 3 to 10 samples that genuinely represent how your brand talks. The more consistent they are, the sharper the profile.',
    },
  ],

  pre_post: [
    {
      id:    'prepost-intro',
      title: 'Check content before it goes live',
      body:  'Pre-Post Analysis scores a draft on five dimensions, engagement, cultural resonance, tone, clarity and risk, before you hit publish.',
    },
    {
      id:    'prepost-widget',
      title: 'Open the widget from anywhere',
      body:  'Press Cmd+Shift+P (or the lightning icon) from any page to score a piece of content. Every analysis you run is saved here for reference.',
    },
    {
      id:       'prepost-main',
      title:    'Your analysis history',
      body:     'Past analyses land here so you can compare scores over time or revisit what worked before a similar campaign.',
      target:   '[data-tour="prepost-main"]',
      position: 'top',
    },
  ],

  creative: [
    {
      id:    'creative-intro',
      title: 'Score creative before it airs',
      body:  'Compare two creatives head to head, check consistency against your brand voice, or analyse a competitor\'s content for what is working.',
    },
    {
      id:       'creative-main',
      title:    'Four tools, one tab bar',
      body:     'Compare scores two creatives on engagement, cultural resonance, tone, clarity and risk. Identity Check flags drift from your brand voice. Competitor Watch and Video Analysis round out the toolkit.',
      target:   '[data-tour="creative-main"]',
      position: 'top',
    },
    {
      id:    'creative-tip',
      title: 'Feed it your real drafts',
      body:  'This works best on actual campaign drafts, not finished, published work. Catch issues while you can still change them.',
    },
  ],

  creative_library: [
    {
      id:    'library-intro',
      title: 'Your vault of vetted creative',
      body:  'Every asset that has been checked and approved lives here, with its performance data and format tags, ready to reuse.',
    },
    {
      id:       'library-main',
      title:    'Filter, select, deploy',
      body:     'Filter by type or ads-ready status. Select a batch of ads-ready assets and create an ad set directly from here, no re-uploading required.',
      target:   '[data-tour="library-main"]',
      position: 'top',
    },
    {
      id:    'library-tip',
      title: 'Performance data travels with the asset',
      body:  'Each card shows impressions, CTR and ROAS from its last run, so you know what actually worked before you reuse it.',
    },
  ],

  creative_fatigue: [
    {
      id:    'fatigue-intro',
      title: 'Catch fatigue before it costs you',
      body:  'Creative Fatigue Monitor watches your active creatives for the signals that predict declining performance, frequency, CTR drop and age.',
    },
    {
      id:       'fatigue-main',
      title:    'Critical, watch, refresh, healthy',
      body:     'Every active asset lands in one of four buckets based on its fatigue score. Cards in Critical and Watch need attention soonest.',
      target:   '[data-tour="fatigue-main"]',
      position: 'top',
    },
    {
      id:    'fatigue-actions',
      title: 'Quick fixes, one click away',
      body:  'Each fatigued asset links straight to Voice Builder to retune it, Creative Library to swap it, or Experiments to A/B test a replacement.',
    },
  ],

  experiments: [
    {
      id:    'experiments-intro',
      title: 'Know when a result is real',
      body:  'A/B Testing tracks structured experiments and calculates statistical significance, so you can tell a genuine winner from normal variation.',
    },
    {
      id:       'experiments-main',
      title:    'Every experiment, one list',
      body:     'The stat row shows how many experiments are running, concluded and won. Each experiment card tracks control versus variant performance as it comes in.',
      target:   '[data-tour="experiments-main"]',
      position: 'top',
    },
    {
      id:    'experiments-new',
      title: 'Start a new experiment',
      body:  'Hit New experiment, define your hypothesis and variants, and BrandGauge tracks significance automatically as results arrive.',
    },
  ],

  mmm: [
    {
      id:    'mmm-intro',
      title: 'Which channel is actually working',
      body:  'Media Mix estimates how much each channel contributes to your results based on activity levels, spend and campaign timing.',
    },
    {
      id:       'mmm-main',
      title:    'Contribution by channel',
      body:     'The donut chart breaks down contribution by channel, with ROI per channel and specific recommendations on where to shift budget.',
      target:   '[data-tour="mmm-main"]',
      position: 'top',
    },
    {
      id:    'mmm-run',
      title: 'Run your first analysis',
      body:  'Pick a time window and hit Run analysis. BrandGauge needs a few weeks of campaign activity across channels to produce a useful read.',
    },
  ],

  geo_lift: [
    {
      id:    'geolift-intro',
      title: 'Prove incremental lift by city',
      body:  'Geo-Lift Studies compare a city where you ran a campaign against a similar city where you did not, to isolate the true incremental effect on brand search.',
    },
    {
      id:       'geolift-main',
      title:    'Your studies and their results',
      body:     'Each study shows search lift, correlation between test and control cities, and a confidence rating, plus an AI read on what the result means.',
      target:   '[data-tour="geolift-main"]',
      position: 'bottom',
    },
    {
      id:    'geolift-start',
      title: 'Start a new study',
      body:  'Pick a treatment city, a comparable control city, and a date range. BrandGauge handles the statistical comparison from there.',
    },
  ],

  budget: [
    {
      id:    'budget-intro',
      title: 'Planned versus actual, always current',
      body:  'Budget and Pacing tracks what you planned to spend against what you have actually spent, by channel, so surprises show up early.',
    },
    {
      id:       'budget-main',
      title:    'Pacing at a glance',
      body:     'The active plan summary shows total budget, spent and remaining with an On track, Ahead or Behind badge. Expand a plan to see the per-channel breakdown and line items.',
      target:   '[data-tour="budget-main"]',
      position: 'top',
    },
    {
      id:    'budget-new',
      title: 'Create a plan',
      body:  'Hit New plan, add your channels and planned amounts, then log actual spend as it happens to keep pacing accurate.',
    },
  ],

  retention: [
    {
      id:    'retention-intro',
      title: 'An early warning system for churn',
      body:  'Retention Risk blends sentiment, NPS and brand health trends into one risk score, so you can act before customers actually leave.',
    },
    {
      id:       'retention-main',
      title:    'Risk score and what is driving it',
      body:     'The gauge shows your current risk level. Below it, the specific signals feeding that score and, when there is a problem, the actual detractor voices behind it.',
      target:   '[data-tour="retention-main"]',
      position: 'top',
    },
    {
      id:    'retention-tip',
      title: 'Pair it with Advocacy',
      body:  'Retention Risk tells you who might leave. The Advocacy page tells you who is already your biggest fan, use both together.',
    },
  ],

  loyalty: [
    {
      id:    'loyalty-intro',
      title: 'Run your points program from here',
      body:  'Loyalty Engine manages tiers, member balances and rewards, so your loyalty program is not stuck in a spreadsheet.',
    },
    {
      id:       'loyalty-main',
      title:    'Programs, members, leaderboard',
      body:     'Programs holds your tier structure. Members shows every enrolled customer with their balance and status. Leaderboard ranks your top point earners.',
      target:   '[data-tour="loyalty-main"]',
      position: 'top',
    },
    {
      id:    'loyalty-award',
      title: 'Award or adjust points',
      body:  'Open a member from the Members tab to award bonus points or correct a balance directly.',
    },
  ],

  advocacy: [
    {
      id:    'advocacy-intro',
      title: 'Find and activate your biggest fans',
      body:  'Advocacy surfaces the customers most likely to promote your brand and tracks how well your referral program actually performs.',
    },
    {
      id:       'advocacy-main',
      title:    'Promoters and referral performance',
      body:     'The Promoters tab lists your highest-scoring advocates. Referral Performance tracks how many of them actually bring in new customers.',
      target:   '[data-tour="advocacy-main"]',
      position: 'top',
    },
    {
      id:    'advocacy-tip',
      title: 'Promoters come from your NPS data',
      body:  'The more NPS responses you collect, the more accurate this list gets. Keep your NPS Tracker panels running.',
    },
  ],

  cdp: [
    {
      id:    'cdp-intro',
      title: 'One profile per customer',
      body:  'Customer Data Platform merges survey responses, WhatsApp conversations and reviews into a single profile per customer, instead of scattered records.',
    },
    {
      id:       'cdp-main',
      title:    'Profiles and where they stand',
      body:     'The KPI chips break your base into promoters, passives, detractors and at-risk customers. Every merged profile is searchable below.',
      target:   '[data-tour="cdp-main"]',
      position: 'bottom',
    },
    {
      id:    'cdp-sync',
      title: 'Keep it current',
      body:  'Hit Sync data any time to pull in the latest responses and conversations from your connected sources.',
    },
  ],

  board_pack: [
    {
      id:    'boardpack-intro',
      title: 'A board-ready report in one click',
      body:  'Board Pack turns your brand health data into a one-page performance report, formatted for a board or CFO review.',
    },
    {
      id:       'boardpack-main',
      title:    'Preview before you send',
      body:     'The preview pane shows exactly what your board will see. Download it as a PDF or share it directly by email.',
      target:   '[data-tour="boardpack-main"]',
      position: 'bottom',
    },
    {
      id:    'boardpack-tip',
      title: 'Refresh it before every board meeting',
      body:  'The report pulls live data, so revisit this page right before you present to make sure the numbers are current.',
    },
  ],

  business_case: [
    {
      id:    'bizcase-intro',
      title: 'Defend your budget with data',
      body:  'Marketing Business Case builds a data-backed narrative for your marketing spend, from brand health trends to channel ROI, ready for finance.',
    },
    {
      id:       'bizcase-main',
      title:    'An AI executive brief',
      body:     'BrandGauge writes a board-ready summary from your actual performance data. It needs a few weeks of campaign and sentiment history to produce a strong narrative.',
      target:   '[data-tour="bizcase-main"]',
      position: 'top',
    },
    {
      id:    'bizcase-tip',
      title: 'Best used alongside Board Pack',
      body:  'Business Case makes the argument for investment. Board Pack reports on results after you have made it. Use them together for a full budget cycle.',
    },
  ],

  methodology: [
    {
      id:    'methodology-intro',
      title: 'How every score is calculated',
      body:  'This page explains the measurement frameworks behind every score and index in BrandGauge, adapted for the Nigerian and West African market.',
    },
    {
      id:       'methodology-main',
      title:    'A reference, not a dashboard',
      body:     'Come back here any time you need to explain a number to a stakeholder or double-check how a score is built.',
      target:   '[data-tour="methodology-main"]',
      position: 'top',
    },
  ],
}
