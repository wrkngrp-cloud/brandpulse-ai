import { createServiceClient } from '@/lib/supabase/server'
import { maskEmail } from './redact'
import type { StaffSession } from './auth'

/**
 * The lead desk, in the Desk.
 *
 * The only lead desk. /dashboard/leads and its funnel are gone as of
 * 18 October: they checked `lead_desk_admins`, a table nothing has ever
 * inserted into, so they bounced everyone to /dashboard from the day they
 * shipped and the rows below were readable by nobody.
 *
 * Access is `leads.view` to read and `leads.edit` to work the pipeline, which
 * the business development role holds, so a BDM can be invited to follow up
 * without being made a founder.
 */

export interface ToolRun {
  toolId:   string
  /** The thing they pointed the tool at, pulled out of what they typed. */
  subject:  string | null
  headline: string | null
  wantsMonitoring: boolean
  createdAt: string
}

export interface LeadRow {
  id:         string
  email:      string
  name:       string | null
  company:    string | null
  role:       string | null
  website:    string | null
  status:     'new' | 'contacted' | 'qualified' | 'converted' | 'dead'
  source:     string
  signedUp:   boolean
  wantsWeekly: boolean
  /** A seeded row. Marked everywhere, because a BDM calling a person who does
   *  not exist is an embarrassing phone call. */
  isDemo:     boolean
  notes:      string | null
  contactedAt: string | null
  createdAt:  string
  /** One row per tool run, newest first. This is what turns "submitted a
   *  form" into "ran the tracker on Moniepoint, then audited their own
   *  landing page, and asked to be told when the competitor moves". */
  toolRuns:   ToolRun[]
  /** The scan they were looking at when they gave us the address. */
  scan: {
    brandName:    string
    competitors:  string[]
    category:     string | null
    shareOfReach: number | null
    mentionsFound: number | null
  } | null
}

export interface LeadsSummary {
  leads:      LeadRow[]
  total:      number
  new7:       number
  signedUp:   number
  demoRows:   number
  byStatus:   { status: string; count: number }[]
  bySource:   { source: string; count: number }[]
  /** Scans run without an address left behind, which is most of them. */
  anonymousScans: number
}

export async function leadsSummary(session: StaffSession): Promise<LeadsSummary | null> {
  if (!session.can('leads.view')) return null

  const service = await createServiceClient()
  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString()

  const [{ data: rows }, { count: scanCount }] = await Promise.all([
    service.from('leads')
      .select(`
        id, email, name, company, role, website, status, source, signed_up,
        wants_weekly, is_demo, notes, contacted_at, created_at,
        public_scans ( brand_name, competitors, category, share_of_reach, mentions_found ),
        lead_tool_runs ( tool_id, inputs, headline, wants_monitoring, created_at )
      `)
      .order('created_at', { ascending: false })
      .limit(500),
    service.from('public_scans').select('*', { count: 'exact', head: true }),
  ])

  const shows = session.sees('data.customer_email')

  const leads: LeadRow[] = (rows ?? []).map(row => {
    const scan = row.public_scans as unknown as {
      brand_name?: string; competitors?: unknown; category?: string | null
      share_of_reach?: number | null; mentions_found?: number | null
    } | null

    const runs = (row.lead_tool_runs ?? []) as unknown as {
      tool_id: string; inputs: Record<string, unknown> | null
      headline: string | null; wants_monitoring: boolean; created_at: string
    }[]

    return {
      id:      row.id,
      email:   shows ? row.email : maskEmail(row.email),
      name:    row.name,
      company: row.company,
      role:    row.role,
      website: row.website,
      status:  row.status as LeadRow['status'],
      source:  row.source,
      signedUp: row.signed_up,
      wantsWeekly: row.wants_weekly,
      isDemo:  row.is_demo ?? false,
      notes:   row.notes,
      contactedAt: row.contacted_at,
      createdAt: row.created_at,
      toolRuns: runs
        .map(run => ({
          toolId:   run.tool_id,
          subject:  subjectOf(run.inputs),
          headline: run.headline,
          wantsMonitoring: run.wants_monitoring,
          createdAt: run.created_at,
        }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      scan: scan?.brand_name
        ? {
            brandName:    scan.brand_name,
            competitors:  Array.isArray(scan.competitors) ? scan.competitors as string[] : [],
            category:     scan.category ?? null,
            shareOfReach: scan.share_of_reach ?? null,
            mentionsFound: scan.mentions_found ?? null,
          }
        : null,
    }
  })

  const tally = (key: (l: LeadRow) => string) => {
    const map = new Map<string, number>()
    for (const lead of leads) map.set(key(lead), (map.get(key(lead)) ?? 0) + 1)
    return [...map.entries()].map(([k, count]) => ({ count, key: k }))
      .sort((a, b) => b.count - a.count)
  }

  return {
    leads,
    total:    leads.length,
    new7:     leads.filter(l => l.createdAt >= since7).length,
    signedUp: leads.filter(l => l.signedUp).length,
    demoRows: leads.filter(l => l.isDemo).length,
    byStatus: tally(l => l.status).map(t => ({ status: t.key, count: t.count })),
    bySource: tally(l => l.source).map(t => ({ source: t.key, count: t.count })),
    anonymousScans: Math.max(0, (scanCount ?? 0) - leads.length),
  }
}

/**
 * The product name for a tool id.
 *
 * "Competitor Move Tracker on moniepoint.com" is an opening line and
 * "competitor-tracker" is not.
 */
export const TOOL_NAME: Record<string, string> = {
  'pr-scoreboard':      'PR Scoreboard',
  'brand-gap':          'Brand Perception Gap',
  'competitor-tracker': 'Competitor Move Tracker',
  'market-demand':      'Market Demand Gap Finder',
  'offline-tracker':    'Offline Campaign Tracker',
  'campaign-audit':     'Campaign Conversion Audit',
}

/** What they pointed the tool at, out of whatever they typed into it. */
function subjectOf(inputs: Record<string, unknown> | null): string | null {
  if (!inputs) return null
  const value = ['competitorWebsite', 'pageUrl', 'website', 'yourWebsite', 'campaignName']
    .map(key => inputs[key])
    .find((v): v is string => typeof v === 'string' && v.length > 2)
  if (!value) return null
  try { return new URL(value).hostname.replace(/^www\./, '') } catch { return value.slice(0, 60) }
}
