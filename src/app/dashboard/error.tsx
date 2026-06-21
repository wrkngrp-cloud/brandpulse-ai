'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Dashboard error]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-5 text-center px-4">
      <div className="h-14 w-14 rounded-2xl bg-destructive/10 grid place-items-center">
        <AlertCircle className="h-7 w-7 text-destructive" />
      </div>
      <div className="max-w-sm">
        <p className="text-[17px] font-semibold">Something went wrong</p>
        <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">
          {error.message || 'An unexpected error occurred while loading this page.'}
        </p>
        {error.digest && (
          <p className="text-[10px] font-mono text-muted-foreground/50 mt-2">ref: {error.digest}</p>
        )}
      </div>
      <div className="flex gap-2">
        <Button onClick={reset} size="sm">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Try again
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.location.href = '/dashboard'}>
          Go to dashboard
        </Button>
      </div>
    </div>
  )
}
