import { createServiceClient } from '@/lib/supabase/server'
import { maskEmail } from './redact'
import type { StaffSession } from './auth'

/**
 * The lead desk, in the Desk.
 *
 * The same rows the founder's lead desk at /dashboard/leads has always shown,
 * read here through the Desk's permission model instead of the
 * lead_desk_admins allowlist. Both exist for now: retiring the old one means
 * rewriting the leads and public_scans policies and the acquisition funnel
 * page the free tools added, which is a change of its own.
 */

export interface LeadRow {
  id:         string
  email:      string
  name:       string | null
  company:    string | null
  status:     'new' | 'contacted' | 'qualified' | 'converted' | 'dead'
  source:     string
  signedUp:   boolean
  wantsWeekly: boolean
  notes:      string | null
  contactedAt: string | null
  createdAt:  string
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
        id, email, name, company, status, source, signed_up, wants_weekly,
        notes, contacted_at, created_at,
        public_scans ( brand_name, competitors, category, share_of_reach, mentions_found )
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

    return {
      id:      row.id,
      email:   shows ? row.email : maskEmail(row.email),
      name:    row.name,
      company: row.company,
      status:  row.status as LeadRow['status'],
      source:  row.source,
      signedUp: row.signed_up,
      wantsWeekly: row.wants_weekly,
      notes:   row.notes,
      contactedAt: row.contacted_at,
      createdAt: row.created_at,
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
    byStatus: tally(l => l.status).map(t => ({ status: t.key, count: t.count })),
    bySource: tally(l => l.source).map(t => ({ source: t.key, count: t.count })),
    anonymousScans: Math.max(0, (scanCount ?? 0) - leads.length),
  }
}
