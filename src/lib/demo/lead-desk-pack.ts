/**
 * Demo rows for the lead desk.
 *
 * Six leads chosen to show the states the desk has to render rather than six
 * variations of the same one: a fresh single-tool lead, a multi-tool trail
 * across three weeks, one who went on to sign up, one the desk has already
 * contacted, one who asked for nothing, and one agency.
 *
 * Every address is at example.com, which RFC 2606 reserves and which can
 * never receive mail, and every row carries is_demo. Two independent reasons
 * a BDM cannot mistake one of these for a person to call.
 *
 * The dates are relative to seeding time so the desk always looks current,
 * which matters more than fixed dates for a preview that will be looked at
 * weeks from now.
 */

export interface DemoRun {
  toolId:   string
  inputs:   Record<string, unknown>
  headline: string
  wantsMonitoring: boolean
  /** ISO, computed from daysAgo at module load. */
  at:       string
}

export interface DemoLead {
  email:     string
  name:      string
  company:   string
  website:   string
  role:      string
  source:    string
  status:    'new' | 'contacted' | 'qualified' | 'converted' | 'dead'
  signedUp:  boolean
  wantsWeekly: boolean
  notes:     string | null
  firstSeen: string
  runs:      DemoRun[]
}

const daysAgo = (n: number): string =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()

export const DEMO_LEADS: DemoLead[] = [
  {
    email: 'adaeze.nwosu@example.com',
    name: 'Adaeze Nwosu',
    company: 'Jara Foods',
    website: 'https://jarafoods.example.com',
    role: 'Head of marketing, or marketing manager',
    source: 'pr-scoreboard',
    status: 'new',
    signedUp: false,
    wantsWeekly: true,
    notes: null,
    firstSeen: daysAgo(9),
    runs: [
      {
        toolId: 'pr-scoreboard',
        inputs: { brand: 'Jara Foods', competitors: ['Golden Penny', 'Honeywell'], category: 'Packaged food' },
        headline: 'Jara Foods held 11% of the category’s earned reach',
        wantsMonitoring: true,
        at: daysAgo(9),
      },
      {
        toolId: 'competitor-tracker',
        inputs: { yourWebsite: 'https://jarafoods.example.com', competitorWebsite: 'https://goldenpenny.example.com' },
        headline: 'Golden Penny added a 2kg pack at a lower price per kilo',
        wantsMonitoring: true,
        at: daysAgo(4),
      },
    ],
  },
  {
    email: 'tunde.bakare@example.com',
    name: 'Tunde Bakare',
    company: 'PocketPay',
    website: 'https://pocketpay.example.com',
    role: 'CMO or marketing director',
    source: 'competitor-tracker',
    status: 'contacted',
    signedUp: false,
    wantsWeekly: false,
    notes: 'Called 2 days after the brief. Wants to see the watchlist before committing the team.',
    firstSeen: daysAgo(16),
    runs: [
      {
        toolId: 'competitor-tracker',
        inputs: { yourWebsite: 'https://pocketpay.example.com', competitorWebsite: 'https://moniepoint.example.com', market: 'Nigeria' },
        headline: 'Transfer fee rises to ₦75 from next month',
        wantsMonitoring: true,
        at: daysAgo(16),
      },
      {
        toolId: 'campaign-audit',
        inputs: { pageUrl: 'https://pocketpay.example.com/merchants', objective: 'signups' },
        headline: 'Largest contentful paint is poor on mobile: 6.1 s',
        wantsMonitoring: false,
        at: daysAgo(15),
      },
    ],
  },
  {
    email: 'chiamaka.eze@example.com',
    name: 'Chiamaka Eze',
    company: 'Bridger',
    website: 'https://bridger.example.com',
    role: 'Growth or performance marketer',
    source: 'market-demand',
    status: 'qualified',
    signedUp: true,
    wantsWeekly: false,
    notes: 'Signed up the same afternoon and imported all three opportunities. Worth a call about the paid beta cohort.',
    firstSeen: daysAgo(21),
    runs: [
      {
        toolId: 'market-demand',
        inputs: { website: 'https://bridger.example.com', market: 'Nigeria', productCategory: 'Field sales software' },
        headline: 'Absent from every purchase-intent search for field sales tools in Lagos',
        wantsMonitoring: true,
        at: daysAgo(21),
      },
      {
        toolId: 'campaign-audit',
        inputs: { pageUrl: 'https://bridger.example.com/demo', objective: 'lead_generation' },
        headline: 'The form asks for 9 things',
        wantsMonitoring: false,
        at: daysAgo(20),
      },
      {
        toolId: 'competitor-tracker',
        inputs: { yourWebsite: 'https://bridger.example.com', competitorWebsite: 'https://fieldforce.example.com' },
        headline: 'Nothing verified in the last 30 days',
        wantsMonitoring: true,
        at: daysAgo(6),
      },
    ],
  },
  {
    email: 'segun.adeyemi@example.com',
    name: 'Segun Adeyemi',
    company: 'Pinnacle Media',
    website: 'https://pinnaclemedia.example.com',
    role: 'Agency or consultant',
    source: 'pr-scoreboard',
    status: 'new',
    signedUp: false,
    wantsWeekly: true,
    notes: null,
    firstSeen: daysAgo(2),
    runs: [
      {
        toolId: 'pr-scoreboard',
        inputs: { brand: 'Chi Limited', competitors: ['Hollandia', 'Dangote'], category: 'Beverages' },
        headline: 'Chi Limited held 31% of the category’s earned reach',
        wantsMonitoring: true,
        at: daysAgo(2),
      },
    ],
  },
  {
    email: 'fatima.bello@example.com',
    name: 'Fatima Bello',
    company: 'Kaduna Textiles',
    website: 'https://kadunatextiles.example.com',
    role: 'Brand manager',
    source: 'competitor-tracker',
    status: 'new',
    signedUp: false,
    wantsWeekly: false,
    notes: null,
    firstSeen: daysAgo(1),
    runs: [
      {
        toolId: 'competitor-tracker',
        inputs: { yourWebsite: 'https://kadunatextiles.example.com', competitorWebsite: 'https://aswanitextiles.example.com' },
        headline: 'Opened a second distribution hub in Kano',
        wantsMonitoring: false,
        at: daysAgo(1),
      },
    ],
  },
  {
    email: 'emeka.okafor@example.com',
    name: 'Emeka Okafor',
    company: 'Marketsquare',
    website: 'https://marketsquare.example.com',
    role: 'Founder or MD',
    source: 'campaign-audit',
    status: 'qualified',
    signedUp: true,
    wantsWeekly: true,
    notes: 'Four tools in three weeks and a workspace with two competitors on watch. The strongest signal on the desk.',
    firstSeen: daysAgo(24),
    runs: [
      {
        toolId: 'campaign-audit',
        inputs: { pageUrl: 'https://marketsquare.example.com/sell', objective: 'signups', market: 'Nigeria' },
        headline: 'No WhatsApp link and no tappable phone number',
        wantsMonitoring: true,
        at: daysAgo(24),
      },
      {
        toolId: 'market-demand',
        inputs: { website: 'https://marketsquare.example.com', market: 'Nigeria' },
        headline: 'Three competitors rank for "sell online in Nigeria" and you do not appear',
        wantsMonitoring: true,
        at: daysAgo(18),
      },
      {
        toolId: 'competitor-tracker',
        inputs: { yourWebsite: 'https://marketsquare.example.com', competitorWebsite: 'https://jumia.example.com' },
        headline: 'Cut seller commission to 4% for the festive quarter',
        wantsMonitoring: true,
        at: daysAgo(11),
      },
      {
        toolId: 'pr-scoreboard',
        inputs: { brand: 'Marketsquare', competitors: ['Jumia', 'Konga'], category: 'Marketplaces' },
        headline: 'Marketsquare held 6% of the category’s earned reach',
        wantsMonitoring: true,
        at: daysAgo(3),
      },
    ],
  },
]
