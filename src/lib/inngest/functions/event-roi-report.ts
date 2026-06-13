import { inngest } from '../client'
import { createServiceClient } from '@/lib/supabase/server'
import { computeEventMetrics } from '@/lib/events/roi'
import { callAi } from '@/lib/ai/client'

export const eventRoiReport = inngest.createFunction(
  { id: 'event-roi-report', name: 'Event ROI Report', triggers: [{ event: 'brandpulse/event.closed' }] },
  async ({ event, step }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { eventId } = (event as any).data as { eventId: string }

    return await step.run('generate-roi-report', async () => {
      const service = await createServiceClient()

      const { data: ev } = await service
        .from('events')
        .select('*, brands(name)')
        .eq('id', eventId)
        .single()

      if (!ev) throw new Error(`Event ${eventId} not found`)

      const [
        { data: interactions },
        { data: interceptResponses },
        { data: ambassadors },
      ] = await Promise.all([
        service.from('event_interactions').select('interaction_type, ambassador_id, lead_interest, occurred_at').eq('event_id', eventId),
        service.from('event_intercept_responses').select('answers').eq('event_id', eventId),
        service.from('event_ambassadors').select('id, name').eq('event_id', eventId),
      ])

      const metrics = computeEventMetrics(
        interactions  ?? [],
        ev.budget,
        ev.kpi_targets ?? {},
      )

      const ambBreakdown = (ambassadors ?? []).map(a => {
        const mine = (interactions ?? []).filter((i: { ambassador_id: string | null }) => i.ambassador_id === a.id)
        return {
          name:      a.name,
          total:     mine.length,
          leads:     mine.filter((i: { interaction_type: string }) => i.interaction_type === 'new_lead').length,
          customers: mine.filter((i: { interaction_type: string }) => i.interaction_type === 'new_customer').length,
        }
      }).sort((a, b) => b.total - a.total)

      const surveyCount = (interceptResponses ?? []).length
      const brandName   = (ev.brands as { name: string } | null)?.name ?? 'the brand'

      // Include debrief intelligence if available
      const debrief = ev.debrief as Record<string, string> | null
      const debriefSection = debrief
        ? `\nPOST-EVENT DEBRIEF (field intelligence from the event manager):
${debrief.overall        ? `- Overall: ${debrief.overall}` : ''}
${debrief.wins           ? `- Wins: ${debrief.wins}` : ''}
${debrief.challenges     ? `- Challenges: ${debrief.challenges}` : ''}
${debrief.product_feedback  ? `- Product feedback heard: ${debrief.product_feedback}` : ''}
${debrief.competitor_activity ? `- Competitor activity: ${debrief.competitor_activity}` : ''}
${debrief.follow_up_actions   ? `- Follow-up actions: ${debrief.follow_up_actions}` : ''}
${debrief.estimated_reach     ? `- Estimated total reach: ${debrief.estimated_reach}` : ''}`
        : ''

      const objectives = ev.objectives as { stages?: string[]; notes?: string } | null
      const objectivesList = objectives?.stages?.length
        ? `Event objectives: ${objectives.stages.join(', ')}.`
        : ''

      const narrative = await callAi({
        tier:   'structural',
        system: 'You are a brand intelligence analyst writing a concise post-event ROI report for a Nigerian brand. Be specific, reference the numbers, and keep the tone warm and professional. Where debrief notes are provided, weave them into the analysis.',
        messages: [{
          role:    'user',
          content: `Write a post-event ROI report narrative for "${ev.name}" (${brandName}) held in ${ev.city}${ev.state ? ', ' + ev.state : ''} on ${ev.date_start}${ev.date_end !== ev.date_start ? ' to ' + ev.date_end : ''}.
${objectivesList}

KEY METRICS:
- Total interactions logged: ${metrics.total_interactions}
- Engaged visitors: ${metrics.total_engaged}
- New leads captured: ${metrics.total_leads}
- New customers: ${metrics.total_new_customers}
- Merch distributed: ${metrics.total_merch}, Samples: ${metrics.total_samples}
- Photo moments: ${metrics.total_photo}
- Event EMV: ₦${metrics.event_emv.toLocaleString()}
- Budget: ${ev.budget ? '₦' + Number(ev.budget).toLocaleString() : 'not set'}
- Cost per lead: ${metrics.cost_per_lead ? '₦' + metrics.cost_per_lead.toFixed(0) : 'N/A'}
- Cost per new customer: ${metrics.cost_per_account ? '₦' + metrics.cost_per_account.toFixed(0) : 'N/A'}
- Event ROI: ${metrics.event_roi ? metrics.event_roi.toFixed(1) + '%' : 'N/A'}
- New customer conversion rate: ${metrics.new_customer_ratio ? (metrics.new_customer_ratio * 100).toFixed(1) + '%' : 'N/A'}

KPI TARGETS:
- Leads target: ${ev.kpi_targets?.expected_leads ?? 'not set'} ${metrics.leads_vs_target ? '(' + metrics.leads_vs_target.toFixed(0) + '% achieved)' : ''}
- Customers target: ${ev.kpi_targets?.expected_new_customers ?? 'not set'} ${metrics.customers_vs_target ? '(' + metrics.customers_vs_target.toFixed(0) + '% achieved)' : ''}

TOP AMBASSADORS: ${ambBreakdown.slice(0, 3).map(a => `${a.name} (${a.total} interactions, ${a.leads} leads)`).join(', ') || 'none logged'}

INTERCEPT SURVEYS: ${surveyCount} responses collected.
${debriefSection}

Write 3-4 paragraphs covering: (1) overall performance summary, (2) what worked well, (3) areas to improve, (4) recommended next steps. Under 400 words. No bullet lists — flowing prose.`,
        }],
        maxTokens: 700,
      })

      await service.from('event_roi_reports').upsert({
        event_id:     eventId,
        metrics:      { ...metrics, ambassador_breakdown: ambBreakdown, survey_count: surveyCount },
        narrative,
        generated_at: new Date().toISOString(),
      }, { onConflict: 'event_id' })

      await service.from('events').update({ status: 'reported' }).eq('id', eventId)

      return { eventId, totalInteractions: metrics.total_interactions }
    })
  },
)
