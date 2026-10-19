import type { BrandIconName } from '@/components/brand/icon'

/**
 * The free tools, once.
 *
 * The nav dropdown, the /tools directory and the "try this next" line at the
 * foot of every report all read this file. A sixth tool is one entry here plus
 * its own page; nothing about the navigation has to be restructured, which is
 * the whole reason the registry exists.
 *
 * `route` is the real route. The PR Scoreboard shipped at /scoreboard and
 * external links point there, so it keeps that route and the registry carries
 * it rather than the tidier /tools/pr-scoreboard. (That path exists too, as a
 * permanent redirect, so the directory's own URL shape stays predictable.)
 */

export type ToolCategory = 'brand' | 'competitive' | 'market' | 'campaign'

/** Built: live and doing real work. Credentialed: live, but one named source
 *  needs an env var before it can measure rather than infer. */
export type ToolStatus = 'built' | 'credentialed'

export interface FreeTool {
  id:        'pr-scoreboard' | 'brand-gap' | 'competitor-tracker' | 'market-demand' | 'offline-tracker' | 'campaign-audit'
  name:      string
  /** One line, benefit-led, for the dropdown and the directory card. */
  blurb:     string
  /** Two or three sentences for the directory card body. */
  detail:    string
  cta:       string
  icon:      BrandIconName
  route:     string
  category:  ToolCategory
  status:    ToolStatus
  order:     number
  /**
   * Is this tool part of the public lineup?
   *
   * An unlisted tool keeps its page, its API and its data — a link someone
   * already holds has to keep working — but it is out of the nav dropdown,
   * the directory, the sitemap and the end-of-report suggestion. That is the
   * difference between retiring an acquisition lever and deleting a feature.
   */
  listed:    boolean
}

export const TOOL_CATEGORIES: Record<ToolCategory, { label: string; blurb: string }> = {
  brand:       { label: 'Brand intelligence',       blurb: 'Whether the market describes you the way you describe yourself.' },
  competitive: { label: 'Competitive intelligence', blurb: 'Who else is in the room, and what they just did.' },
  market:      { label: 'Market intelligence',      blurb: 'Where the customers are that you are not reaching.' },
  campaign:    { label: 'Campaign intelligence',    blurb: 'Whether the money you spend lands.' },
}

const ALL_TOOLS: FreeTool[] = [
  {
    id:       'pr-scoreboard',
    name:     'PR Scoreboard',
    blurb:    "See who's winning earned media attention.",
    detail:   'Thirty days of Nigerian press for you and three rivals, weighted by how many people read each outlet, priced in Naira. Type four brand names and connect nothing.',
    cta:      'Run the scoreboard',
    icon:     'bg-mast',
    route:    '/scoreboard',
    category: 'competitive',
    status:   'built',
    order:    1,
    listed:   true,
  },
  {
    id:       'brand-gap',
    name:     'Brand Perception Gap',
    blurb:    'See whether the market describes you the way you do.',
    detail:   'Reads the positioning on your own site, then reads how the Nigerian press and an AI assistant actually describe you, and names the distance between the two. Your website, your brand name, nothing else.',
    cta:      'Find my perception gap',
    icon:     'bg-git-fork',
    route:    '/tools/brand-gap',
    category: 'brand',
    status:   'credentialed',
    order:    2,
    listed:   true,
  },
  {
    id:       'competitor-tracker',
    name:     'Competitor Move Tracker',
    blurb:    'Know what your competitors are doing.',
    detail:   'Reads a competitor’s own site and the Nigerian business press for launches, pricing changes, partnerships and expansion. Every finding carries the link it came from.',
    cta:      'Analyze a competitor',
    icon:     'bg-file-search',
    route:    '/tools/competitor-tracker',
    category: 'competitive',
    status:   'built',
    order:    3,
    listed:   true,
  },
  {
    id:       'market-demand',
    name:     'Market Demand Gap Finder',
    blurb:    'Find opportunities to acquire customers.',
    detail:   'Reads what you sell, works out how buyers in your market actually search for it, then shows which of those searches you are missing and who is there instead.',
    cta:      'Find my market opportunities',
    icon:     'bg-market',
    route:    '/tools/market-demand',
    category: 'market',
    status:   'credentialed',
    order:    4,
    listed:   true,
  },
  {
    id:       'offline-tracker',
    name:     'Offline Campaign Tracker',
    blurb:    'Track responses from offline campaigns.',
    detail:   'Trackable short links and QR codes for billboards, events, radio, flyers and activations. Print them, and see which placement people actually came from.',
    cta:      'Create my tracking links',
    icon:     'bg-qr',
    route:    '/tools/offline-tracker',
    category: 'campaign',
    status:   'built',
    order:    5,
    /* Retired from the lineup on 18 October 2026, and kept reachable.
       Two reasons, and the second is the stronger one. Nobody scans a QR code
       on a billboard on Third Mainland Bridge at speed, and nobody stops
       walking to type a vanity link, which is why this repo's own locked
       decision already makes QR a secondary toggle that is off by default for
       OOH. But even with perfect scanning it was the wrong free tool: it is
       the only one that ends with assets rather than a finding, so a visitor
       leaves with homework instead of an insight. Time to value is the whole
       game at the top of a funnel.
       The page, the /go resolution, the tables and the dashboard module all
       stay: links already generated must keep resolving, and the OOH
       measurement rethink may want this plumbing back. */
    listed:   false,
  },
  {
    id:       'campaign-audit',
    name:     'Campaign Conversion Audit',
    blurb:    'Find issues affecting campaign performance.',
    detail:   'Checks the page your ads point at: mobile speed, accessibility, whether the call to action works, and the friction that loses a buyer on a Nigerian phone.',
    cta:      'Audit my landing page',
    icon:     'bg-mouse-pointer',
    route:    '/tools/campaign-audit',
    category: 'campaign',
    status:   'built',
    order:    6,
    listed:   true,
  },
]

/** The public lineup: the nav, the directory and the sitemap read this. */
export const FREE_TOOLS: FreeTool[] = ALL_TOOLS.filter(t => t.listed).sort((a, b) => a.order - b.order)

export const TOOL_IDS = ALL_TOOLS.map(t => t.id)
export type ToolId = FreeTool['id']

/** Resolves unlisted tools too, so a retired tool still has a name on the
 *  lead desk and in the founder's funnel. */
export function toolById(id: string): FreeTool | undefined {
  return ALL_TOOLS.find(t => t.id === id)
}

export function toolsByCategory(): Array<{ category: ToolCategory; label: string; blurb: string; tools: FreeTool[] }> {
  return (Object.keys(TOOL_CATEGORIES) as ToolCategory[]).map(category => ({
    category,
    label: TOOL_CATEGORIES[category].label,
    blurb: TOOL_CATEGORIES[category].blurb,
    tools: FREE_TOOLS.filter(t => t.category === category).sort((a, b) => a.order - b.order),
  }))
}

/**
 * What to show a visitor who has just finished one tool.
 *
 * Deliberately hand-picked rather than "the next two in the list": the
 * recommendation has to answer a question the report just raised, or it is
 * clutter competing with the beta call to action. One suggestion, never more.
 */
const NEXT_TOOL: Record<ToolId, { id: ToolId; line: string }> = {
  'pr-scoreboard':      { id: 'brand-gap',          line: 'The press has its own words for you. Do they match the ones on your website?' },
  'brand-gap':          { id: 'competitor-tracker', line: 'That is how the market reads you. Now, what are your competitors actually doing?' },
  'competitor-tracker': { id: 'pr-scoreboard',      line: 'Want to see who is winning the press in this category?' },
  'market-demand':      { id: 'campaign-audit',     line: 'Before you send traffic to these pages, check whether they are ready for it.' },
  'offline-tracker':    { id: 'campaign-audit',     line: 'Your links point somewhere. Is that page ready to convert the people who arrive?' },
  'campaign-audit':     { id: 'market-demand',      line: 'Page sorted. Now, which customers are you not reaching at all?' },
}

export function nextTool(after: ToolId): { tool: FreeTool; line: string } | null {
  const pick = NEXT_TOOL[after]
  const tool = pick && toolById(pick.id)
  // Never point a visitor at a tool that is no longer in the lineup.
  return tool && tool.listed ? { tool, line: pick.line } : null
}
