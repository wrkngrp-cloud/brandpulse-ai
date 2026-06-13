import { createClient }    from '@/lib/supabase/server'
import { redirect }         from 'next/navigation'
import Link                 from 'next/link'
import { buttonVariants }   from '@/components/ui/button'
import { cn }               from '@/lib/utils'
import { MapPin, Plus }     from 'lucide-react'
import { OohSitesList }     from '@/components/ooh/ooh-sites-list'
import { OohMapClient }     from '@/components/ooh/ooh-map-client'

export default async function OohPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: brand } = await supabase
    .from('brands').select('id, name, ooh_redirect_domain').limit(1).single()
  if (!brand) redirect('/onboarding')

  const { data: sites } = await supabase
    .from('ooh_sites')
    .select(`
      id, site_name, city, state, country, format_type, illuminated,
      daily_traffic, weekly_cost, currency,
      campaign_start, campaign_end, lga,
      vanity_slug, landing_url, visits, qr_token, qr_scan_count,
      lat, lng, photo_url, notes
    `)
    .eq('brand_id', brand.id)
    .order('created_at', { ascending: false })

  const defaultUrl = process.env.APP_URL ?? 'https://brandpulse-ai-tau.vercel.app'
  const appUrl = brand.ooh_redirect_domain
    ? `https://${brand.ooh_redirect_domain}`
    : defaultUrl

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">OOH Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Billboards, activations, and out-of-home attribution
          </p>
        </div>
        <Link
          href="/dashboard/ooh/new"
          className={cn(buttonVariants({ size: 'sm' }), 'inline-flex items-center')}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add site
        </Link>
      </div>

      {!sites?.length ? (
        <div className="border rounded-xl p-12 text-center space-y-3">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto">
            <MapPin className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-sm">No OOH sites yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add a billboard, transit ad, or any outdoor site to start tracking attribution.
            </p>
          </div>
          <Link href="/dashboard/ooh/new" className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}>
            Add your first site
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <OohMapClient sites={sites ?? []} />
          <OohSitesList sites={sites ?? []} appUrl={appUrl} />
        </div>
      )}
    </div>
  )
}
