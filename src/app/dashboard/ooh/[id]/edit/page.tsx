import { createClient }      from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { OohSiteForm }        from '@/components/ooh/ooh-site-form'
import { updateSite }         from '../../actions'
import Link                   from 'next/link'
import { buttonVariants }     from '@/components/ui/button'
import { cn }                 from '@/lib/utils'
import { ArrowLeft }          from 'lucide-react'

export default async function EditOohSitePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id }   = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: site } = await supabase
    .from('ooh_sites')
    .select('*')
    .eq('id', id)
    .single()

  if (!site) notFound()

  const { data: brand } = await supabase
    .from('brands').select('name, ooh_redirect_domain').limit(1).single()
  const defaultUrl = process.env.APP_URL ?? 'https://brandpulse-ai-tau.vercel.app'
  const appUrl = brand?.ooh_redirect_domain
    ? `https://${brand.ooh_redirect_domain}`
    : defaultUrl

  const boundAction = updateSite.bind(null, id)

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/dashboard/ooh/${id}`}
          className={cn(buttonVariants({ size: 'sm', variant: 'ghost' }), 'h-8 px-2')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold">Edit Site</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{site.site_name}</p>
        </div>
      </div>

      <OohSiteForm
        action={boundAction}
        brandName={brand?.name ?? ''}
        appUrl={appUrl}
        defaultValues={{
          ...site,
          lat: site.lat ? Number(site.lat) : null,
          lng: site.lng ? Number(site.lng) : null,
        }}
      />
    </div>
  )
}
