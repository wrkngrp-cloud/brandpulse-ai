'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Working as Loader2 } from '@/components/brand/working'
import { updateSurveyStatus } from '../actions'

export function StatusToggle({ surveyId, status }: { surveyId: string; status: string }) {
  const [pending, startTransition] = useTransition()

  if (status === 'closed') {
    return (
      <span className="text-xs text-muted-foreground">Closed</span>
    )
  }

  return (
    <Button
      size="sm"
      variant={status === 'draft' ? 'default' : 'outline'}
      disabled={pending}
      onClick={() =>
        startTransition(() =>
          updateSurveyStatus(surveyId, status === 'draft' ? 'live' : 'closed')
        )
      }
    >
      {pending && <Loader2 className="h-3.5 w-3.5 mr-1.5" />}
      {status === 'draft' ? 'Go live' : 'Close survey'}
    </Button>
  )
}
