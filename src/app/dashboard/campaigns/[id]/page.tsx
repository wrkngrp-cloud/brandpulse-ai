import { createClient }    from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link                  from 'next/link'
import { ArrowLeft }         from 'lucide-react'
import { CampaignDetailClient } from '@/components/campaigns/campaign-detail-client'

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id }       = await params
  const { tab = 'overview' } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: campaign } = await supabase
    .from('campaigns')
    .select(`
      id, name, description, objectives, start_date, end_date,
      total_budget, currency, status, ai_summary,
      campaign_channels ( id, channel, budget_allocation, objectives )
    `)
    .eq('id', id)
    .single()

  if (!campaign) notFound()

  const [
    { data: oohSites },
    { data: events },
    { data: unlinkedSites },
    { data: unlinkedEvents },
  ] = await Promise.all([
    supabase
      .from('ooh_sites')
      .select('id, site_name, city, state, format_type, visits, campaign_start, campaign_end, vanity_slug, lat, lng, monthly_cost, currency, lga')
      .eq('campaign_id', id)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
    supabase
      .from('events')
      .select('id, name, event_type, city, state, date_start, date_end, status, budget, currency')
      .eq('campaign_id', id)
      .order('date_start', { ascending: false }),
    supabase
      .from('ooh_sites')
      .select('id, site_name, city, state, format_type, visits')
      .is('campaign_id', null)
      .eq('status', 'active')
      .order('visits', { ascending: false })
      .limit(30),
    supabase
      .from('events')
      .select('id, name, event_type, city, date_start, status')
      .is('campaign_id', null)
      .order('date_start', { ascending: false })
      .limit(30),
  ])

  // Fetch event interaction counts for all events in this campaign
  const eventIds = (events ?? []).map(e => e.id)
  const { data: interactions } = eventIds.length > 0
    ? await supabase
        .from('event_interactions')
        .select('event_id, interaction_type')
        .in('event_id', eventIds)
    : { data: [] }

  // ── Performance tab extra data ────────────────────────────────────────────
  // 1. Social posts linked to this campaign (via campaign_id) or within date range
  const socialQuery = supabase
    .from('social_posts')
    .select('impressions, reach, likes, comments, shares, posted_at')
    .eq('campaign_id', id)
    .order('posted_at', { ascending: true })

  // 2. Per-visit log for each OOH site in this campaign
  const oohSiteIds = (oohSites ?? []).map(s => s.id)
  const oohVisitsQuery = oohSiteIds.length > 0
    ? supabase
        .from('ooh_visits')
        .select('site_id, visited_at')
        .in('site_id', oohSiteIds)
    : Promise.resolve({ data: [] })

  const [{ data: socialPosts }, { data: oohVisits }] = await Promise.all([
    socialQuery,
    oohVisitsQuery,
  ])

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link
          href="/dashboard/campaigns"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Campaigns
        </Link>
        <h1 className="text-xl font-semibold">{campaign.name}</h1>
        {campaign.description && (
          <p className="text-sm text-muted-foreground mt-0.5">{campaign.description}</p>
        )}
      </div>

      <CampaignDetailClient
        campaign={campaign}
        oohSites={oohSites ?? []}
        events={events ?? []}
        activeTab={tab}
        unlinkedSites={unlinkedSites ?? []}
        unlinkedEvents={unlinkedEvents ?? []}
        interactions={interactions ?? []}
        socialPosts={socialPosts ?? []}
        oohVisits={oohVisits ?? []}
      />
    </div>
  )
}
