import { createClient }  from '@/lib/supabase/server'
import { redirect }       from 'next/navigation'
import { ArrowLeft }      from 'lucide-react'
import Link               from 'next/link'
import { EcommerceImportClient } from './ecommerce-import-client'

export const dynamic = 'force-dynamic'

export default async function EcommercePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: brand } = await supabase
    .from('brands')
    .select('id')
    .limit(1)
    .maybeSingle()
  if (!brand) redirect('/onboarding')

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href="/dashboard/connectors"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All Connectors
        </Link>
        <h1 className="text-xl font-semibold">E-commerce Sales Import</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Upload order data from Jumia, Konga, or any CSV to track sales attributed to your campaigns.
        </p>
      </div>

      <EcommerceImportClient campaigns={campaigns ?? []} />
    </div>
  )
}
