import { type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

interface OutletPayload {
  outlet_name:         string | null
  outlet_type:         string | null
  product_available:   boolean | null
  facings_count:       number | null
  stock_level:         string | null
  observed_price_ngn:  number | null
  posm_present:        boolean | null
  posm_condition:      string | null
  competitor_activity: string | null
  competitor_name:     string | null
}

interface SubmitBody {
  token:       string
  fso_name:    string
  fso_id_code: string | null
  report_date: string
  state:       string | null
  lga:         string | null
  notes:       string | null
  outlets:     OutletPayload[]
}

export async function POST(request: NextRequest) {
  const body = await request.json() as SubmitBody
  const { token, fso_name, fso_id_code, report_date, state, lga, notes, outlets } = body

  if (!token || !fso_name || !Array.isArray(outlets) || outlets.length === 0) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const service = await createServiceClient()

  const { data: team } = await service
    .from('fso_teams')
    .select('id, brand_id, workspace_id, active')
    .eq('token', token)
    .single()

  if (!team || !team.active) {
    return Response.json({ error: 'Invalid or inactive token' }, { status: 401 })
  }

  const { data: report, error: reportErr } = await service
    .from('field_reports')
    .insert({
      brand_id:     team.brand_id,
      workspace_id: team.workspace_id,
      fso_team_id:  team.id,
      fso_name,
      fso_id_code:  fso_id_code ?? null,
      report_date,
      state:        state ?? null,
      lga:          lga   ?? null,
      notes:        notes ?? null,
    })
    .select('id')
    .single()

  if (reportErr || !report) {
    return Response.json({ error: reportErr?.message ?? 'Failed to create report' }, { status: 500 })
  }

  const outletRows = outlets.map((o) => ({
    field_report_id:      report.id,
    brand_id:             team.brand_id,
    outlet_name:          o.outlet_name,
    outlet_type:          o.outlet_type,
    product_available:    o.product_available,
    facings_count:        o.facings_count,
    stock_level:          o.stock_level,
    observed_price_ngn:   o.observed_price_ngn,
    posm_present:         o.posm_present,
    posm_condition:       o.posm_condition,
    competitor_activity:  o.competitor_activity,
    competitor_name:      o.competitor_name,
  }))

  const { error: outletErr } = await service
    .from('field_report_outlets')
    .insert(outletRows)

  if (outletErr) {
    return Response.json({ error: outletErr.message }, { status: 500 })
  }

  return Response.json({ success: true, report_id: report.id })
}
