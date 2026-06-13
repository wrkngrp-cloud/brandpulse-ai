import { createClient } from '@/lib/supabase/server'
import { redirect }      from 'next/navigation'
import { OohSiteForm }   from '@/components/ooh/ooh-site-form'
import { createSite }    from '../actions'

export default async function NewOohSitePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: brand } = await supabase
    .from('brands').select('name, ooh_redirect_domain').limit(1).single()
  if (!brand) redirect('/onboarding')

  const defaultUrl = process.env.APP_URL ?? 'https://brandpulse-ai-tau.vercel.app'
  const appUrl = brand.ooh_redirect_domain
    ? `https://${brand.ooh_redirect_domain}`
    : defaultUrl

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Add OOH Site</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Generate a vanity link and UTM to attribute traffic from this site.
        </p>
      </div>

      <OohSiteForm
        action={createSite}
        brandName={brand.name}
        appUrl={appUrl}
      />
    </div>
  )
}
