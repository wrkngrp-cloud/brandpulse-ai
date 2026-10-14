import { createServiceClient } from '@/lib/supabase/server'
import type { ToolRun } from './runs'

/**
 * Turning a claimed anonymous run into work the visitor can continue.
 *
 * This is the hinge of the whole acquisition strategy. The rule the brief sets
 * and this file keeps: never send someone to an empty dashboard, and never
 * make them type anything twice. So claiming does not merely record a
 * relationship — it writes the rows the destination module reads, and returns
 * the path to that module.
 *
 * Every write here goes through the service role, because claiming happens in
 * the same request as the sign-in and the caller's RLS context is not the
 * point of trust. The ownership check happened in `claimRun`, which read the
 * caller's own membership rather than taking a workspace from the body; by the
 * time a function here runs, `brandId` is a brand the caller demonstrably
 * belongs to.
 */

export interface ImportOutcome {
  /** Where to send them. A populated module, never /dashboard. */
  destination: string
  /** One line for the toast on arrival. */
  note: string
}

export async function importRun(run: ToolRun, brandId: string): Promise<ImportOutcome> {
  switch (run.toolId) {
    case 'competitor-tracker': return importCompetitorTracker(run, brandId)
    case 'market-demand':      return importMarketDemand(run, brandId)
    case 'offline-tracker':    return importOfflineTracker(run, brandId)
    case 'campaign-audit':     return importCampaignAudit(run, brandId)
    case 'pr-scoreboard':
    default:
      return { destination: '/dashboard/pr', note: 'Your press scan is on the board.' }
  }
}

/* ── Competitor Move Tracker ────────────────────────────────────────────────
   The free report becomes a watchlist: the competitor as a row in the existing
   `competitors` table, a watch holding the page hashes we already computed, and
   every verified move as baseline history. Baseline matters — these were
   already true when the watch started, so the monitoring job must never alert
   on them as if they had just happened. */
async function importCompetitorTracker(run: ToolRun, brandId: string): Promise<ImportOutcome> {
  const result = run.result as {
    competitor?: { name?: string; website?: string; market?: string | null }
    moves?: Array<{
      category: string; headline: string; significance?: string; implication?: string
      sourceUrl: string; sourceKind: string; quote?: string; publishedAt?: string | null
      confidence?: string; fingerprint: string
    }>
    hashes?: { home?: string | null; pricing?: string | null }
  } | null

  const name    = result?.competitor?.name?.trim()
  const website = result?.competitor?.website?.trim()
  if (!name || !website) return { destination: '/dashboard/competitive', note: 'Competitive workspace ready.' }

  const svc = await createServiceClient()

  // The competitor may already be on the brand's list from onboarding.
  const { data: existing } = await svc
    .from('competitors').select('id').eq('brand_id', brandId).ilike('name', name).maybeSingle()

  let competitorId = existing?.id ?? null
  if (!competitorId) {
    const { data: inserted } = await svc.from('competitors')
      .insert({ brand_id: brandId, name, website_url: website }).select('id').single()
    competitorId = inserted?.id ?? null
  } else {
    await svc.from('competitors').update({ website_url: website }).eq('id', competitorId)
  }

  await svc.from('competitor_watches').upsert({
    brand_id:        brandId,
    competitor_id:   competitorId,
    competitor_name: name,
    website_url:     website,
    market:          result?.competitor?.market ?? null,
    home_hash:       result?.hashes?.home ?? null,
    pricing_hash:    result?.hashes?.pricing ?? null,
    last_checked_at: new Date().toISOString(),
  }, { onConflict: 'brand_id,website_url' })

  const moves = (result?.moves ?? []).filter(m => m.sourceUrl && m.headline)
  if (moves.length) {
    await svc.from('competitor_moves').upsert(moves.map(m => ({
      brand_id:        brandId,
      competitor_id:   competitorId,
      competitor_name: name,
      category:        m.category,
      headline:        m.headline.slice(0, 500),
      significance:    m.significance ?? null,
      implication:     m.implication ?? null,
      source_url:      m.sourceUrl,
      source_kind:     m.sourceKind,
      quote:           m.quote ?? null,
      published_at:    m.publishedAt ?? null,
      confidence:      m.confidence ?? 'medium',
      is_baseline:     true,
      fingerprint:     m.fingerprint,
    })), { onConflict: 'brand_id,fingerprint', ignoreDuplicates: true })
  }

  return {
    destination: '/dashboard/competitive/watchlist',
    note: `${name} is on your watchlist with ${moves.length} verified ${moves.length === 1 ? 'move' : 'moves'} as the baseline.`,
  }
}

/* ── Market Demand Gap Finder ───────────────────────────────────────────────
   The three opportunities become a prioritised backlog the marketer can work:
   status moves from identified through planned to done, and the evidence
   travels with each row so nobody has to take the ranking on faith. */
async function importMarketDemand(run: ToolRun, brandId: string): Promise<ImportOutcome> {
  const result = run.result as {
    opportunities?: Array<{
      title: string; customerProblem?: string; intentStage?: string
      evidenceKind?: string; evidence?: unknown[]; competitorsVisible?: unknown[]
      recommendedAction?: string; priority?: number
    }>
  } | null

  const opps = result?.opportunities ?? []
  if (!opps.length) return { destination: '/dashboard/funnel', note: 'Acquisition workspace ready.' }

  const svc = await createServiceClient()
  await svc.from('acquisition_opportunities').insert(opps.map((o, i) => ({
    brand_id:            brandId,
    run_id:              run.id,
    title:               o.title.slice(0, 300),
    customer_problem:    o.customerProblem ?? null,
    intent_stage:        o.intentStage ?? null,
    evidence_kind:       o.evidenceKind ?? 'visibility_gap',
    evidence:            o.evidence ?? [],
    competitors_visible: o.competitorsVisible ?? [],
    recommended_action:  o.recommendedAction ?? null,
    priority:            o.priority ?? Math.min(5, i + 1),
  })))

  return {
    destination: '/dashboard/opportunities',
    note: `${opps.length} ${opps.length === 1 ? 'opportunity' : 'opportunities'} imported, ready to prioritise.`,
  }
}

/* ── Offline Campaign Tracker ───────────────────────────────────────────────
   Nothing is copied. The campaign row gets a workspace and a brand, so the
   slug behind every printed QR code keeps resolving and the visits already
   recorded stay attached to it. A reissued link on a billboard is not a thing
   that exists. */
async function importOfflineTracker(run: ToolRun, brandId: string): Promise<ImportOutcome> {
  const svc = await createServiceClient()

  const { data: brand } = await svc.from('brands').select('workspace_id').eq('id', brandId).single()
  if (!brand?.workspace_id) return { destination: '/dashboard/offline-tracker', note: 'Campaign workspace ready.' }

  const { data: campaigns } = await svc
    .from('tool_campaigns')
    .update({ workspace_id: brand.workspace_id, brand_id: brandId })
    .eq('run_id', run.id)
    .is('brand_id', null)
    .select('id, name')

  const campaign = campaigns?.[0]
  if (!campaign) {
    // Already claimed by this workspace on an earlier visit: find it rather
    // than reporting nothing.
    const { data: mine } = await svc
      .from('tool_campaigns').select('id, name').eq('run_id', run.id).eq('brand_id', brandId).maybeSingle()
    return mine
      ? { destination: `/dashboard/offline-tracker/${mine.id}`, note: `${mine.name} is already in your workspace.` }
      : { destination: '/dashboard/offline-tracker', note: 'Campaign workspace ready.' }
  }

  return {
    destination: `/dashboard/offline-tracker/${campaign.id}`,
    note: `${campaign.name} is yours. The links you printed keep working.`,
  }
}

/* ── Campaign Conversion Audit ──────────────────────────────────────────────
   The findings become a backlog with a status per issue, and the audit itself
   is kept so a re-run can show before and after. */
async function importCampaignAudit(run: ToolRun, brandId: string): Promise<ImportOutcome> {
  const result = run.result as {
    pageUrl?: string; objective?: string | null; market?: string | null
    summary?: string; performance?: unknown; coverage?: unknown
    findings?: Array<{
      area: string; title: string; detail?: string; severity?: string
      provenance?: string; confidence?: string; evidence?: string; recommendation?: string
    }>
  } | null

  const pageUrl = result?.pageUrl
  if (!pageUrl) return { destination: '/dashboard/campaign-audit', note: 'Audit workspace ready.' }

  const svc = await createServiceClient()
  const { data: audit } = await svc.from('page_audits').insert({
    brand_id:    brandId,
    run_id:      run.id,
    page_url:    pageUrl,
    objective:   result?.objective ?? null,
    market:      result?.market ?? null,
    performance: result?.performance ?? null,
    summary:     result?.summary ?? null,
    coverage:    result?.coverage ?? {},
  }).select('id').single()

  const findings = result?.findings ?? []
  if (audit?.id && findings.length) {
    await svc.from('page_audit_findings').insert(findings.map(f => ({
      audit_id:       audit.id,
      brand_id:       brandId,
      area:           f.area,
      title:          f.title.slice(0, 300),
      detail:         f.detail ?? null,
      severity:       f.severity ?? 'medium',
      provenance:     f.provenance === 'interpreted' ? 'interpreted' : 'observed',
      confidence:     f.confidence ?? 'medium',
      evidence:       f.evidence ?? null,
      recommendation: f.recommendation ?? null,
    })))
  }

  return {
    destination: audit?.id ? `/dashboard/campaign-audit/${audit.id}` : '/dashboard/campaign-audit',
    note: `${findings.length} ${findings.length === 1 ? 'finding' : 'findings'} imported as a plan you can work.`,
  }
}
