export interface TourStep {
  id:        string
  title:     string
  body:      string
  target?:   string
  position?: 'top' | 'bottom' | 'left' | 'right'
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
      body:     'Hit New Campaign to define your objectives, budget, channels and dates. BrandPulse will start tracking impact from day one.',
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
      body:  'Road shows, trade fairs, store launches, pop-ups and consumer activations all count. BrandPulse turns each one into a measurable data point.',
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
      body:  'BrandPulse compares brand search uplift before, during and after each event and matches ambassador-captured leads to the campaign.',
    },
    {
      id:       'post-event',
      title:    'Post-event report',
      body:     'Once you mark an event as reported, a summary of reach, leads, estimated ROI and sentiment change is generated automatically.',
      target:   '[data-tour="event-report"]',
      position: 'top',
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
      body:     'BrandPulse pulls every tagged post into the post tracker so you can see reach, likes, comments and sentiment without chasing screenshots.',
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
      body:  'Add your main competitors and BrandPulse will track their share of voice, mention volume and sentiment alongside yours.',
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
      body:  'Type their brand name and handles in the Competitive settings. BrandPulse starts tracking from the next crawl, usually within 24 hours.',
    },
  ],

  connectors: [
    {
      id:    'connectors-intro',
      title: 'Connect your data sources',
      body:  'BrandPulse works best when it can see all your data. Connect social accounts, ad platforms and CRM tools to get the full picture.',
    },
    {
      id:       'social-connectors',
      title:    'Social media accounts',
      body:     'Link your Instagram Business and X accounts so BrandPulse can pull mentions, engagement and reach directly. No manual exports.',
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
      id:       'crm-connectors',
      title:    'CRM and payments',
      body:     'Link HubSpot or Paystack to match marketing activity with customer acquisition and revenue so you can show real business impact.',
      target:   '[data-tour="crm-connectors"]',
      position: 'bottom',
    },
    {
      id:    'connectors-flow',
      title: 'How data flows',
      body:  'Once connected, each source syncs on a schedule. You can trigger a manual sync at any time from the connector settings panel.',
    },
  ],
}
