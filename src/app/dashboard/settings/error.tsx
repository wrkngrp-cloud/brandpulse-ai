'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Settings error]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-5 text-center">
      <div className="h-12 w-12 rounded-full bg-destructive/10 grid place-items-center">
        <AlertCircle className="h-6 w-6 text-destructive" />
      </div>
      <div>
        <p className="text-[15px] font-semibold">Settings failed to load</p>
        <p className="text-[13px] text-muted-foreground mt-1 max-w-sm">
          {error.message || 'An unexpected error occurred.'}
        </p>
      </div>
      <Button onClick={reset} size="sm">Try again</Button>
    </div>
  )
}
