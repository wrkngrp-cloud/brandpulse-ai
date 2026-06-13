'use client'

import { useState, useTransition } from 'react'
import Link                        from 'next/link'
import { toast }                   from 'sonner'
import { useRouter }               from 'next/navigation'
import { skipDebriefAndGenerate }  from '@/app/dashboard/events/actions'
import { Button }                  from '@/components/ui/button'
import { buttonVariants }          from '@/components/ui/button'
import { ClipboardList }           from 'lucide-react'
import { cn }                      from '@/lib/utils'

export function DebriefPromptCard({ eventId }: { eventId: string }) {
  const router = useRouter()
  const [skipPending, startSkip] = useTransition()
  const [skipped, setSkipped]   = useState(false)

  if (skipped) return null

  return (
    <div className="border rounded-xl p-6 bg-card space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">Fill in your post-event debrief</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Capture what happened in the field — wins, challenges, and product feedback.
            This gets woven into your ROI report by the AI.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 pl-12">
        <Link
          href={`/dashboard/events/${eventId}/debrief`}
          className={cn(buttonVariants({ size: 'sm' }))}
        >
          Fill debrief
        </Link>
        <Button
          size="sm"
          variant="ghost"
          disabled={skipPending}
          onClick={() => startSkip(async () => {
            const r = await skipDebriefAndGenerate(eventId)
            if (r?.error) {
              toast.error(r.error)
            } else {
              setSkipped(true)
              router.refresh()
            }
          })}
        >
          {skipPending ? 'Starting…' : 'Skip and generate report'}
        </Button>
      </div>
    </div>
  )
}
