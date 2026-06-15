import { createClient }     from '@/lib/supabase/server'
import { redirect }          from 'next/navigation'
import Link                  from 'next/link'
import { buttonVariants }    from '@/components/ui/button'
import { cn }                from '@/lib/utils'
import { Megaphone, Plus }   from 'lucide-react'
import { CampaignsList }     from '@/components/campaigns/campaigns-list'

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string }>
}) {
  const { channel = 'all' } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: brand } = await supabase.from('brands').select('id').limit(1).single()
  if (!brand) redirect('/onboarding')

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select(`
      id, name, description, objective, start_date, end_date,
      total_budget, currency, status,
      campaign_channels ( channel, budget_allocation )
    `)
    .eq('brand_id', brand.id)
    .order('created_at', { ascending: false })

  // Filter by channel tab if not "all"
  const filtered = channel === 'all'
    ? (campaigns ?? [])
    : (campaigns ?? []).filter(c =>
        c.campaign_channels?.some((cc: { channel: string }) => cc.channel === channel)
      )

  const BUILT_TABS = [
    { key: 'all',    label: 'All Campaigns' },
    { key: 'ooh',    label: 'OOH',          built: true },
    { key: 'events', label: 'Events',        built: true },
  ] as const

  const CHANNEL_PAGES = [
    { key: 'digital', label: 'Digital', href: '/dashboard/digital' },
    { key: 'radio',   label: 'Radio',   href: '/dashboard/radio'   },
    { key: 'tv',      label: 'TV',      href: '/dashboard/tv'      },
    { key: 'print',   label: 'Print',   href: '/dashboard/print'   },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Organise OOH placements, events, and media spend by campaign.
          </p>
        </div>
        <Link
          href="/dashboard/campaigns/new"
          className={cn(buttonVariants({ size: 'sm' }), 'inline-flex items-center')}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          New campaign
        </Link>
      </div>

      {/* Channel tabs */}
      <div className="flex items-center gap-1 border-b overflow-x-auto pb-0">
        {BUILT_TABS.map(tab => (
          <Link
            key={tab.key}
            href={`/dashboard/campaigns?channel=${tab.key}`}
            className={cn(
              'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
              channel === tab.key
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        ))}
        {CHANNEL_PAGES.map(tab => (
          <Link
            key={tab.key}
            href={tab.href}
            className="px-3 py-2 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors -mb-px whitespace-nowrap"
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {!campaigns?.length ? (
        <div className="border rounded-xl p-12 text-center space-y-3">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Megaphone className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-sm">No campaigns yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create a campaign to organise your OOH sites and events into measurable media pushes.
            </p>
          </div>
          <Link href="/dashboard/campaigns/new" className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}>
            Create your first campaign
          </Link>
        </div>
      ) : (
        <CampaignsList campaigns={filtered} />
      )}
    </div>
  )
}
