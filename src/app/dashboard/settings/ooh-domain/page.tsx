import { createClient }    from '@/lib/supabase/server'
import { redirect }         from 'next/navigation'
import { OohDomainClient }  from './ooh-domain-client'

export default async function OohDomainPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, ooh_redirect_domain, ooh_redirect_domain_verified')
    .limit(1)
    .single()

  if (!brand) redirect('/onboarding')

  const appUrl = process.env.APP_URL ?? 'https://brandpulse-ai-tau.vercel.app'
  const appHost = new URL(appUrl).hostname  // e.g. brandpulse-ai-tau.vercel.app

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">OOH Attribution Domain</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Choose how your OOH vanity links appear on billboards and print.
        </p>
      </div>

      <OohDomainClient
        brandName={brand.name}
        currentDomain={brand.ooh_redirect_domain ?? null}
        appUrl={appUrl}
        appHost={appHost}
      />
    </div>
  )
}
