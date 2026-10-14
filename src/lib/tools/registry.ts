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

export type ToolCategory = 'competitive' | 'market' | 'campaign'

/** Built: live and doing real work. Credentialed: live, but one named source
 *  needs an env var before it can measure rather than infer. */
export type ToolStatus = 'built' | 'credentialed'

export interface FreeTool {
  id:        'pr-scoreboard' | 'competitor-tracker' | 'market-demand' | 'offline-tracker' | 'campaign-audit'
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
}

export const TOOL_CATEGORIES: Record<ToolCategory, { label: string; blurb: string }> = {
  competitive: { label: 'Competitive intelligence', blurb: 'Who else is in the room, and what they just did.' },
  market:      { label: 'Market intelligence',      blurb: 'Where the customers are that you are not reaching.' },
  campaign:    { label: 'Campaign intelligence',    blurb: 'Whether the money you spend lands.' },
}

export const FREE_TOOLS: FreeTool[] = [
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
    order:    2,
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
    order:    3,
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
    order:    4,
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
    order:    5,
  },
]

export const TOOL_IDS = FREE_TOOLS.map(t => t.id)
export type ToolId = FreeTool['id']

export function toolById(id: string): FreeTool | undefined {
  return FREE_TOOLS.find(t => t.id === id)
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
  'pr-scoreboard':      { id: 'competitor-tracker', line: 'Want to know what these competitors are doing beyond earned media?' },
  'competitor-tracker': { id: 'pr-scoreboard',      line: 'Want to see who is winning the press in this category?' },
  'market-demand':      { id: 'campaign-audit',     line: 'Before you send traffic to these pages, check whether they are ready for it.' },
  'offline-tracker':    { id: 'campaign-audit',     line: 'Your links point somewhere. Is that page ready to convert the people who arrive?' },
  'campaign-audit':     { id: 'market-demand',      line: 'Page sorted. Now, which customers are you not reaching at all?' },
}

export function nextTool(after: ToolId): { tool: FreeTool; line: string } | null {
  const pick = NEXT_TOOL[after]
  const tool = pick && toolById(pick.id)
  return tool ? { tool, line: pick.line } : null
}
