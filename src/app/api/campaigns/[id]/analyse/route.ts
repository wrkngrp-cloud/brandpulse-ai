import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAi } from '@/lib/ai/client'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [
    { data: campaign },
    { data: brand },
    { data: oohSites },
    { data: events },
  ] = await Promise.all([
    supabase
      .from('campaigns')
      .select('id, name, description, objectives, start_date, end_date, total_budget, currency, status, campaign_channels(channel, budget_allocation)')
      .eq('id', id)
      .single(),
    supabase.from('brands').select('name, category').limit(1).single(),
    supabase
      .from('ooh_sites')
      .select('site_name, city, state, format_type, visits, monthly_cost, currency, daily_traffic, campaign_start, campaign_end, notes')
      .eq('campaign_id', id)
      .eq('status', 'active'),
    supabase
      .from('events')
      .select('id, name, city, day, status, estimated_attendance')
      .eq('campaign_id', id),
  ])

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const eventIds = (events ?? []).map(e => e.id)
  const { data: interactions } = eventIds.length > 0
    ? await supabase.from('event_interactions').select('interaction_type').in('event_id', eventIds)
    : { data: [] as { interaction_type: string }[] }

  const channels       = campaign.campaign_channels ?? []
  const totalOohVisits = (oohSites ?? []).reduce((s, x) => s + (x.visits ?? 0), 0)
  const totalOohSpend  = (oohSites ?? []).reduce((s, x) => s + (Number(x.monthly_cost) || 0), 0)
  const totalAllocated = channels.reduce((s, ch) => s + (Number(ch.budget_allocation) || 0), 0)
  const totalLeads     = (interactions ?? []).filter(i => i.interaction_type === 'new_lead').length

  const campaignDays = campaign.start_date && campaign.end_date
    ? Math.round((new Date(campaign.end_date).getTime() - new Date(campaign.start_date).getTime()) / 86_400_000)
    : null
  const daysElapsed = campaign.start_date
    ? Math.max(0, Math.round((Date.now() - new Date(campaign.start_date).getTime()) / 86_400_000))
    : null

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

  const oohLines = (oohSites ?? []).length === 0
    ? '  No OOH sites'
    : (oohSites ?? []).map(s =>
        `  - ${s.site_name}, ${s.city}: ${(s.visits ?? 0).toLocaleString()} attributed visits · ${s.currency ?? 'NGN'} ${Number(s.monthly_cost ?? 0).toLocaleString()}/month${s.notes ? ' · ' + s.notes : ''}`
      ).join('\n')

  const eventLines = (events ?? []).length === 0
    ? '  No events'
    : (events ?? []).map(e => `  - ${e.name}, ${e.city}: ${e.status}`).join('\n')

  const systemPrompt = `You are a senior brand marketing strategist specialising in Nigerian FMCG brands.
You write clear, confident campaign performance summaries for brand managers.
Reference specific numbers — OOH visits, leads, spend. Use plain English. Active voice.
Write 2–4 sentences only. No markdown. No bullet points. Return only the summary paragraph.`

  const userPrompt = `Write a performance summary for the "${campaign.name}" campaign by ${brand?.name ?? 'the brand'}.

Campaign:
- Status: ${campaign.status} · Objectives: ${(campaign.objectives as string[] | null)?.join(', ') ?? 'awareness'}
- Dates: ${fmtDate(campaign.start_date)} – ${fmtDate(campaign.end_date)}${campaignDays ? ` (${campaignDays} days total, ${daysElapsed ?? 0} elapsed)` : ''}
- Total budget: ${campaign.currency} ${Number(campaign.total_budget ?? 0).toLocaleString()} · Allocated: ${campaign.currency} ${totalAllocated.toLocaleString()}
- Channels: ${channels.map(c => c.channel).join(', ') || 'none set'}

OOH / Outdoor (${(oohSites ?? []).length} sites):
${oohLines}
Total OOH attributed visits: ${totalOohVisits.toLocaleString()} · Monthly OOH spend: ${campaign.currency} ${totalOohSpend.toLocaleString()}

Events (${(events ?? []).length}):
${eventLines}
Total leads captured: ${totalLeads.toLocaleString()}

Summarise performance in 2–4 sentences. Highlight the strongest result and one area to watch. Be specific.`

  try {
    const raw = await callAi({
      tier:        'structural',
      system:      systemPrompt,
      messages:    [{ role: 'user', content: userPrompt }],
      maxTokens:   400,
      temperature: 0.4,
    })

    const summary = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()

    await supabase
      .from('campaigns')
      .update({ ai_summary: summary })
      .eq('id', id)

    return NextResponse.json({ summary })
  } catch (err) {
    console.error('[campaigns/analyse]', err)
    return NextResponse.json({ error: 'Analysis failed — please try again.' }, { status: 500 })
  }
}
