import { createClient } from '@/lib/supabase/server'
import { Skeleton } from '@/components/ui/skeleton'
import { Suspense } from 'react'

async function DashboardContent() {
  const supabase = await createClient()
  const { data: brand } = await supabase
    .from('brands')
    .select('name, category, brand_values')
    .limit(1)
    .single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{brand?.name}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{brand?.category}</p>
      </div>
      {/* Placeholder cards — filled out as each spine layer lands */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {['Brand Health Index', 'Sentiment Score', 'Share of Voice'].map(title => (
          <div key={title} className="border rounded-xl p-5 bg-card space-y-2">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold text-muted-foreground/40">—</p>
            <p className="text-xs text-muted-foreground">Connect a data source to see this</p>
          </div>
        ))}
      </div>
      <div className="border rounded-xl p-8 text-center text-muted-foreground text-sm">
        Your dashboard is ready. Connect your social accounts to start seeing data.
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}
