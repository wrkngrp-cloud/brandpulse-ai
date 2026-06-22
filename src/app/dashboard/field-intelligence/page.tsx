import { createClient }             from '@/lib/supabase/server'
import { FieldIntelligenceClient }  from './field-intelligence-client'

interface OutletRow {
  id:                  string
  outlet_name:         string | null
  outlet_type:         string | null
  product_available:   boolean | null
  stock_level:         string | null
  posm_present:        boolean | null
  posm_condition:      string | null
  competitor_activity: string | null
  competitor_name:     string | null
  observed_price_ngn:  number | null
  field_reports: {
    id:          string
    fso_name:    string
    report_date: string
    state:       string | null
    lga:         string | null
  } | null
}

export default async function FieldIntelligencePage() {
  const supabase = await createClient()
  const since    = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data: outlets } = await supabase
    .from('field_report_outlets')
    .select(`
      id,
      outlet_name,
      outlet_type,
      product_available,
      stock_level,
      posm_present,
      posm_condition,
      competitor_activity,
      competitor_name,
      observed_price_ngn,
      field_reports!inner (
        id,
        fso_name,
        report_date,
        state,
        lga
      )
    `)
    .gte('field_reports.report_date', since)
    .order('created_at', { ascending: false })

  const { data: reports } = await supabase
    .from('field_reports')
    .select(`
      id,
      fso_name,
      fso_id_code,
      report_date,
      state,
      lga,
      notes,
      submitted_at,
      fso_teams ( name )
    `)
    .gte('report_date', since)
    .order('submitted_at', { ascending: false })
    .limit(20)

  const typedOutlets = (outlets ?? []) as unknown as OutletRow[]

  // Compute header stats
  const totalOutlets  = typedOutlets.length
  const available     = typedOutlets.filter(o => o.product_available === true).length
  const posmGood      = typedOutlets.filter(o => o.posm_present === true && o.posm_condition === 'good').length
  const oos           = typedOutlets.filter(o => o.stock_level === 'out_of_stock').length
  const availPct      = totalOutlets > 0 ? Math.round((available / totalOutlets) * 100) : 0
  const posmPct       = totalOutlets > 0 ? Math.round((posmGood / totalOutlets) * 100) : 0

  // State/LGA breakdown — only outlets where report exists
  const areaMap = new Map<string, { total: number; available: number; state: string; lga: string | null }>()
  for (const o of typedOutlets) {
    const fr  = o.field_reports
    if (!fr?.state) continue
    const key = `${fr.state}|${fr.lga ?? ''}`
    const cur = areaMap.get(key) ?? { total: 0, available: 0, state: fr.state, lga: fr.lga }
    cur.total++
    if (o.product_available === true) cur.available++
    areaMap.set(key, cur)
  }
  const areaBreakdown = Array.from(areaMap.values())
    .map(a => ({ ...a, pct: Math.round((a.available / a.total) * 100) }))
    .sort((a, b) => a.pct - b.pct)

  // Competitor feed
  const competitorFeed = typedOutlets
    .filter(o => o.competitor_activity)
    .slice(0, 20)

  // Per-report stats for recent reports feed
  const reportOutletMap = new Map<string, { total: number; available: number }>()
  for (const o of typedOutlets) {
    if (!o.field_reports?.id) continue
    const cur = reportOutletMap.get(o.field_reports.id) ?? { total: 0, available: 0 }
    cur.total++
    if (o.product_available === true) cur.available++
    reportOutletMap.set(o.field_reports.id, cur)
  }

  return (
    <FieldIntelligenceClient
      stats={{ totalOutlets, availPct, posmPct, oos }}
      areaBreakdown={areaBreakdown}
      recentReports={(reports ?? []).map(r => ({
        ...r,
        outletStats: reportOutletMap.get(r.id) ?? { total: 0, available: 0 },
      }))}
      competitorFeed={competitorFeed.map(o => ({
        competitor_name:     o.competitor_name,
        competitor_activity: o.competitor_activity,
        outlet_type:         o.outlet_type,
        outlet_name:         o.outlet_name,
        state:               o.field_reports?.state ?? null,
        lga:                 o.field_reports?.lga   ?? null,
        report_date:         o.field_reports?.report_date ?? '',
      }))}
    />
  )
}
