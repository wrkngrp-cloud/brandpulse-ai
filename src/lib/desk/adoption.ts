import { createServiceClient } from '@/lib/supabase/server'
import { MODULES, type ModuleDef } from '@/lib/modules'
import { BRAND_TYPE_WEIGHTS, type BrandType } from '@/lib/bhi'
import { HIDDEN_PATHS_BY_INDUSTRY, type IndustryId } from '@/lib/industry-config'
import type { StaffSession } from './auth'

/**
 * What an account uses, and what it should be using.
 *
 * This is the one screen that turns telemetry into a conversation. It is a
 * calculation rather than an opinion, and every input already existed:
 *
 *   relevant  the module is not hidden for this brand's industry
 *   ready     nothing it is known to need is missing
 *   unused    no module view in the last 30 days
 *   weight    the BHI weight of the component it feeds, for this brand_type
 *
 * Ranked by weight, so an empty module that is holding the index down outranks
 * an empty module that is not. A module that feeds no BHI component still
 * appears, below the weighted ones, with its reason stated as "does not move
 * the index" rather than dressed up as a score.
 *
 * Two lists come out. `recommended` is the customer success conversation.
 * `blocked` is the connector chase: relevant, wanted, and missing a
 * prerequisite, which is a different job for a different person.
 */

export interface AdoptionItem {
  key:      string
  label:    string
  path:     string
  /** The BHI component this module feeds, or null. */
  component: string | null
  /** That component's weight for this brand type, 0 when it feeds none. */
  weight:   number
  lastUsedAt: string | null
  views30:  number
  /** Why it cannot show anything yet, when that is the case. */
  missing:  string | null
}

export interface AdoptionReport {
  brandId:    string
  brandName:  string
  brandType:  BrandType | null
  industry:   IndustryId | null
  used:       AdoptionItem[]
  recommended: AdoptionItem[]
  blocked:    AdoptionItem[]
  /** Share of relevant, ready modules opened in the last 30 days. */
  score:      number
  /** The weighted share, which is the one that tracks the index. */
  weightedScore: number
}

function weightFor(mod: ModuleDef, brandType: BrandType | null): number {
  if (!mod.bhi) return 0
  const table = brandType ? BRAND_TYPE_WEIGHTS[brandType] : null
  if (!table) return 0
  return table[mod.bhi] ?? 0
}

function isRelevant(mod: ModuleDef, industry: IndustryId | null): boolean {
  if (!industry) return true
  const hidden = HIDDEN_PATHS_BY_INDUSTRY[industry] ?? []
  return !hidden.includes(mod.path)
}

export async function adoptionForBrand(
  session: StaffSession,
  brandId: string,
): Promise<AdoptionReport | null> {
  if (!session.can('adoption.view')) return null

  const service = await createServiceClient()

  const { data: brand } = await service
    .from('brands')
    .select('id, name, brand_type, industry, workspace_id')
    .eq('id', brandId)
    .maybeSingle()
  if (!brand) return null

  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)

  const { data: events } = await service
    .from('feature_events')
    .select('module, count, last_seen_at')
    .eq('workspace_id', brand.workspace_id)
    .gte('day', since30)
    .limit(20_000)

  const views = new Map<string, { count: number; last: string }>()
  for (const e of events ?? []) {
    const prev = views.get(e.module)
    views.set(e.module, {
      count: (prev?.count ?? 0) + (e.count ?? 0),
      last:  !prev || e.last_seen_at > prev.last ? e.last_seen_at : prev.last,
    })
  }

  // One query per distinct prerequisite table, not one per module.
  const tables = [...new Set(MODULES.flatMap(m => m.requires?.tables ?? []))]
  const present = new Set<string>()
  await Promise.all(tables.map(async table => {
    const { count } = await service
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('brand_id', brandId)
    if ((count ?? 0) > 0) present.add(table)
  }))

  const brandType = (brand.brand_type as BrandType | null) ?? null
  const industry  = (brand.industry as IndustryId | null) ?? null

  const used: AdoptionItem[] = []
  const recommended: AdoptionItem[] = []
  const blocked: AdoptionItem[] = []

  for (const mod of MODULES) {
    if (mod.key === 'overview') continue
    if (!isRelevant(mod, industry)) continue

    const seen    = views.get(mod.key)
    const ready   = !mod.requires || mod.requires.tables.some(t => present.has(t))
    const missing = ready ? null : mod.requires!.label

    const item: AdoptionItem = {
      key:       mod.key,
      label:     mod.label,
      path:      mod.path,
      component: mod.bhi ?? null,
      weight:    weightFor(mod, brandType),
      lastUsedAt: seen?.last ?? null,
      views30:   seen?.count ?? 0,
      missing,
    }

    if (seen) used.push(item)
    else if (!ready) blocked.push(item)
    else recommended.push(item)
  }

  const byWeight = (a: AdoptionItem, b: AdoptionItem) =>
    b.weight - a.weight || a.label.localeCompare(b.label)

  recommended.sort(byWeight)
  blocked.sort(byWeight)
  used.sort((a, b) => b.views30 - a.views30)

  const reachable = used.length + recommended.length
  const score = reachable === 0 ? 0 : Math.round((used.length / reachable) * 100)

  const usedWeight  = used.reduce((s, i) => s + i.weight, 0)
  const totalWeight = usedWeight + recommended.reduce((s, i) => s + i.weight, 0)
  const weightedScore = totalWeight === 0 ? score : Math.round((usedWeight / totalWeight) * 100)

  return {
    brandId:   brand.id,
    brandName: brand.name,
    brandType,
    industry,
    used, recommended, blocked,
    score, weightedScore,
  }
}

/**
 * The line a person would actually say.
 *
 * Built from the numbers rather than generated, so it cannot drift from them
 * and costs nothing to produce. Empty when there is nothing worth saying,
 * which is better than a sentence that fills the space.
 */
export function adoptionHeadline(report: AdoptionReport): string | null {
  const top = report.recommended.find(i => i.weight > 0)
  if (!top) {
    const unweighted = report.recommended[0]
    if (!unweighted) return null
    return `Everything that moves the index is in use. ${unweighted.label} is unopened but does not feed the score.`
  }

  const type = report.brandType ? report.brandType.replace(/_/g, ' ') : 'this brand type'
  return `${top.label} has not been opened in 30 days, and ${top.component} is weighted ${top.weight} for a ${type} brand. That is the largest unused piece of the index.`
}
