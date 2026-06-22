import { createClient }       from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link                   from 'next/link'
import { ArrowLeft, Megaphone } from 'lucide-react'
import { LiveDashboard }       from '@/components/events/live-dashboard'
import { AmbassadorList }      from '@/components/events/ambassador-list'
import { computeEventMetrics, fmtNGN, fmtPct } from '@/lib/events/roi'
import { ReportPoller }        from '@/components/events/report-poller'
import { DebriefPromptCard }   from '@/components/events/debrief-prompt-card'
import { VisualMentions }      from '@/components/events/visual-mentions'

const APP_URL = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtNGNLocal(n: number | null | undefined): string {
  if (n == null) return '—'
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: event } = await supabase
    .from('events')
    .select('*, campaigns ( id, name )')
    .eq('id', id)
    .single()

  if (!event) notFound()

  const [
    { data: ambassadors },
    { data: interactions },
    { data: roiReport },
    { data: interceptCount },
    { data: visualMentions },
    { data: igConnection },
  ] = await Promise.all([
    supabase.from('event_ambassadors').select('id, name, phone, session_token').eq('event_id', id),
    supabase.from('event_interactions').select('id, interaction_type, ambassador_id, occurred_at').eq('event_id', id),
    supabase.from('event_roi_reports').select('metrics, narrative, generated_at').eq('event_id', id).maybeSingle(),
    supabase.from('event_intercept_responses').select('id').eq('event_id', id),
    supabase.from('visual_mentions')
      .select('id, post_url, media_url, hashtag, creator_username, post_caption, post_likes, post_comments, brand_visible, confidence, detected_elements, visual_sentiment, ai_description, detected_at')
      .eq('event_id', id)
      .order('brand_visible', { ascending: false })
      .order('detected_at', { ascending: false }),
    supabase.from('social_connections')
      .select('id')
      .eq('brand_id', event.brand_id as string)
      .eq('platform', 'instagram')
      .eq('sync_status', 'active')
      .maybeSingle(),
  ])

  const metrics = computeEventMetrics(
    interactions  ?? [],
    event.budget,
    event.kpi_targets ?? {},
  )

  // BTL-specific derived metrics
  const isBtl = event.activation_type && event.activation_type !== 'event'
  const spendBd = event.spend_breakdown as { agency?: number; materials?: number; sampling?: number; logistics?: number } | null
  const totalBtlSpend = spendBd
    ? ((spendBd.agency ?? 0) + (spendBd.materials ?? 0) + (spendBd.sampling ?? 0) + (spendBd.logistics ?? 0))
    : (event.budget ? Number(event.budget) : null)

  const actualAttendance = (interactions ?? []).length > 0 ? (interactions ?? []).length : (event.expected_attendance ?? null)
  const leadsCount = (interactions ?? []).filter(i => ['new_lead', 'new_customer'].includes(i.interaction_type)).length

  const costPerContact = totalBtlSpend && actualAttendance ? totalBtlSpend / actualAttendance : null
  const costPerLead    = totalBtlSpend && leadsCount > 0   ? totalBtlSpend / leadsCount       : null
  const sampleConvRate = event.samples_distributed && leadsCount > 0
    ? (leadsCount / event.samples_distributed) * 100
    : null

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <Link
            href="/dashboard/events"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Events
          </Link>
          {(event.campaigns as { id: string; name: string } | null) && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <Link
                href={`/dashboard/campaigns/${(event.campaigns as { id: string; name: string }).id}?tab=events`}
                className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                <Megaphone className="h-3.5 w-3.5" />
                {(event.campaigns as { id: string; name: string }).name}
              </Link>
            </>
          )}
        </div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{event.name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {event.city}{event.state ? `, ${event.state}` : ''} · {fmtDate(event.date_start)}
              {event.date_end !== event.date_start && ` – ${fmtDate(event.date_end)}`}
              {event.activation_type && ` · ${event.activation_type.replace(/_/g, ' ')}`}
            </p>
          </div>
          {(event.status === 'closed' || event.status === 'reported') && (
            <Link
              href={`/dashboard/events/${id}/debrief`}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground shrink-0"
            >
              {event.debrief ? 'Edit debrief' : 'Fill debrief'}
            </Link>
          )}
        </div>
      </div>

      {/* BTL metrics panel (shown when activation_type is set, for closed/reported status) */}
      {isBtl && (event.status === 'closed' || event.status === 'reported') && (
        <div className="border rounded-xl p-5 bg-card space-y-4">
          <h2 className="text-sm font-semibold">BTL performance</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="border rounded-xl p-4 bg-muted/30 space-y-1">
              <p className="text-lg font-semibold tabular-nums">{fmtNGNLocal(costPerContact)}</p>
              <p className="text-xs text-muted-foreground">Cost per person reached</p>
            </div>
            <div className="border rounded-xl p-4 bg-muted/30 space-y-1">
              <p className="text-lg font-semibold tabular-nums">{fmtNGNLocal(costPerLead)}</p>
              <p className="text-xs text-muted-foreground">Cost per lead</p>
            </div>
            {sampleConvRate != null && (
              <div className="border rounded-xl p-4 bg-muted/30 space-y-1">
                <p className="text-lg font-semibold tabular-nums">{sampleConvRate.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Sample conversion rate</p>
              </div>
            )}
            <div className="border rounded-xl p-4 bg-muted/30 space-y-1">
              <p className="text-lg font-semibold tabular-nums">{fmtNGNLocal(totalBtlSpend)}</p>
              <p className="text-xs text-muted-foreground">Total BTL spend</p>
            </div>
          </div>
          {spendBd && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground pt-2 border-t">
              {spendBd.agency    != null && <span>Agency: {fmtNGNLocal(spendBd.agency)}</span>}
              {spendBd.materials != null && <span>Materials: {fmtNGNLocal(spendBd.materials)}</span>}
              {spendBd.sampling  != null && <span>Sampling: {fmtNGNLocal(spendBd.sampling)}</span>}
              {spendBd.logistics != null && <span>Logistics: {fmtNGNLocal(spendBd.logistics)}</span>}
            </div>
          )}
        </div>
      )}

      {/* Closed: prompt for debrief or show progress if debrief already submitted */}
      {event.status === 'closed' && !event.debrief && <DebriefPromptCard eventId={id} />}
      {event.status === 'closed' &&  event.debrief && <ReportPoller eventId={id} />}

      {/* ROI report (reported status) */}
      {event.status === 'reported' && roiReport && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold">ROI Report</h2>

          {/* Key metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total interactions', value: metrics.total_interactions.toString() },
              { label: 'New leads',          value: metrics.total_leads.toString()        },
              { label: 'New customers',      value: metrics.total_new_customers.toString()},
              { label: 'Event EMV',          value: fmtNGN(metrics.event_emv)             },
              { label: 'Cost per lead',      value: fmtNGN(metrics.cost_per_lead)         },
              { label: 'Cost per customer',  value: fmtNGN(metrics.cost_per_account)      },
              { label: 'Event ROI',          value: fmtPct(metrics.event_roi)             },
              { label: 'Conversion rate',    value: metrics.new_customer_ratio != null
                  ? (metrics.new_customer_ratio * 100).toFixed(1) + '%'
                  : 'N/A'                                                                   },
            ].map(m => (
              <div key={m.label} className="border rounded-xl p-4 bg-card space-y-1">
                <p className="text-lg font-semibold tabular-nums">{m.value}</p>
                <p className="text-xs text-muted-foreground">{m.label}</p>
              </div>
            ))}
          </div>

          {/* Targets vs actuals */}
          {(metrics.leads_vs_target != null || metrics.customers_vs_target != null) && (
            <div className="border rounded-xl p-5 bg-card space-y-3">
              <p className="text-sm font-medium">vs targets</p>
              <div className="space-y-2">
                {metrics.leads_vs_target != null && (
                  <div className="flex justify-between text-sm">
                    <span>Leads</span>
                    <span className={metrics.leads_vs_target >= 100 ? 'text-green-600 font-medium' : 'text-orange-500 font-medium'}>
                      {metrics.leads_vs_target.toFixed(0)}% of target
                    </span>
                  </div>
                )}
                {metrics.customers_vs_target != null && (
                  <div className="flex justify-between text-sm">
                    <span>Customers</span>
                    <span className={metrics.customers_vs_target >= 100 ? 'text-green-600 font-medium' : 'text-orange-500 font-medium'}>
                      {metrics.customers_vs_target.toFixed(0)}% of target
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI narrative */}
          {roiReport.narrative && (
            <div className="border rounded-xl p-5 bg-card space-y-3">
              <p className="text-sm font-medium">AI analysis</p>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{roiReport.narrative}</p>
            </div>
          )}

          {/* Ambassador breakdown */}
          {Array.isArray((roiReport.metrics as Record<string, unknown>)?.ambassador_breakdown) && (
            <div className="border rounded-xl p-5 bg-card space-y-3">
              <p className="text-sm font-medium">Ambassador breakdown</p>
              <div className="space-y-2">
                {((roiReport.metrics as { ambassador_breakdown: { name: string; total: number; leads: number; customers: number }[] }).ambassador_breakdown).map((a, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span>{a.name}</span>
                    <span className="text-muted-foreground">{a.total} interactions · {a.leads} leads · {a.customers} customers</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(interceptCount?.length ?? 0) > 0 && (
            <p className="text-xs text-muted-foreground">
              {interceptCount?.length} intercept survey response{interceptCount?.length !== 1 ? 's' : ''} collected.
            </p>
          )}
        </div>
      )}

      {/* Live dashboard (planned + live) */}
      {(event.status === 'planned' || event.status === 'live') && (
        <LiveDashboard
          eventId={id}
          status={event.status}
          budget={event.budget ? Number(event.budget) : null}
          ambassadors={ambassadors ?? []}
          initialInteractions={interactions ?? []}
        />
      )}

      {/* Ambassador list (planned + live) */}
      {(event.status === 'planned' || event.status === 'live') && (
        <div className="border rounded-xl p-5 bg-card space-y-4">
          <h2 className="text-sm font-semibold">Ambassadors</h2>
          <AmbassadorList
            eventId={id}
            ambassadors={ambassadors ?? []}
            appUrl={APP_URL}
          />
        </div>
      )}

      {/* Visual brand mentions (E6) */}
      <div className="border rounded-xl p-5 bg-card">
        <VisualMentions
          eventId={id}
          initialData={visualMentions ?? []}
          hasIgConnection={!!igConnection}
          hasHashtags={(event.hashtags?.length ?? 0) > 0}
        />
      </div>

      {/* Event info */}
      <div className="border rounded-xl p-5 bg-card space-y-3">
        <h2 className="text-sm font-semibold">Event details</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {event.venue && (
            <>
              <dt className="text-muted-foreground">Venue</dt>
              <dd>{event.venue}</dd>
            </>
          )}
          {event.expected_attendance && (
            <>
              <dt className="text-muted-foreground">Expected attendance</dt>
              <dd>{event.expected_attendance.toLocaleString()}</dd>
            </>
          )}
          {isBtl && event.target_community_size && (
            <>
              <dt className="text-muted-foreground">Target reach</dt>
              <dd>{event.target_community_size.toLocaleString()}</dd>
            </>
          )}
          {isBtl && event.samples_distributed && (
            <>
              <dt className="text-muted-foreground">Samples planned</dt>
              <dd>{event.samples_distributed.toLocaleString()}</dd>
            </>
          )}
          {isBtl && event.collateral_distributed && (
            <>
              <dt className="text-muted-foreground">Flyers / branded items</dt>
              <dd>{event.collateral_distributed.toLocaleString()}</dd>
            </>
          )}
          {event.budget && (
            <>
              <dt className="text-muted-foreground">Budget</dt>
              <dd>{event.currency} {Number(event.budget).toLocaleString('en-NG')}</dd>
            </>
          )}
          {event.hashtags?.length > 0 && (
            <>
              <dt className="text-muted-foreground">Hashtags</dt>
              <dd className="flex flex-wrap gap-1">
                {event.hashtags.map((h: string) => (
                  <span key={h} className="text-xs bg-muted px-2 py-0.5 rounded-md">#{h}</span>
                ))}
              </dd>
            </>
          )}
        </dl>
      </div>
    </div>
  )
}
