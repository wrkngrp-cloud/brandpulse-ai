'use client'

import { useActionState, useEffect, useState } from 'react'
import { toast }         from 'sonner'
import { submitDebrief } from '@/app/dashboard/events/actions'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input }                  from '@/components/ui/input'
import { Label }                  from '@/components/ui/label'
import { Textarea }               from '@/components/ui/textarea'
import { CheckCircle2, FileText, ArrowLeft } from 'lucide-react'
import Link                       from 'next/link'
import { cn }                     from '@/lib/utils'

interface Props {
  eventId:         string
  existingDebrief: Record<string, unknown> | null
}

const DRAFT_KEY = (id: string) => `debrief_draft_${id}`

export function DebriefForm({ eventId, existingDebrief }: Props) {
  const bound = submitDebrief.bind(null, eventId)
  const [state, action, pending] = useActionState(bound, null)

  const init = (key: string) => (existingDebrief?.[key] as string | undefined) ?? ''

  const [overall,            setOverall           ] = useState(() => init('overall'))
  const [wins,               setWins              ] = useState(() => init('wins'))
  const [challenges,         setChallenges        ] = useState(() => init('challenges'))
  const [productFeedback,    setProductFeedback   ] = useState(() => init('product_feedback'))
  const [competitorActivity, setCompetitorActivity] = useState(() => init('competitor_activity'))
  const [followUpActions,    setFollowUpActions   ] = useState(() => init('follow_up_actions'))
  const [estimatedReach,     setEstimatedReach    ] = useState(String(existingDebrief?.estimated_reach ?? ''))

  // Restore draft from localStorage on mount (only for new debriefs)
  useEffect(() => {
    if (existingDebrief) return
    try {
      const saved = localStorage.getItem(DRAFT_KEY(eventId))
      if (!saved) return
      const d = JSON.parse(saved) as Record<string, string>
      if (d.overall)            setOverall(d.overall)
      if (d.wins)               setWins(d.wins)
      if (d.challenges)         setChallenges(d.challenges)
      if (d.productFeedback)    setProductFeedback(d.productFeedback)
      if (d.competitorActivity) setCompetitorActivity(d.competitorActivity)
      if (d.followUpActions)    setFollowUpActions(d.followUpActions)
      if (d.estimatedReach)     setEstimatedReach(d.estimatedReach)
    } catch {}
  }, [eventId, existingDebrief])

  // Auto-save draft to localStorage
  useEffect(() => {
    if (existingDebrief) return
    try {
      localStorage.setItem(DRAFT_KEY(eventId), JSON.stringify({
        overall, wins, challenges, productFeedback,
        competitorActivity, followUpActions, estimatedReach,
      }))
    } catch {}
  }, [eventId, existingDebrief, overall, wins, challenges, productFeedback, competitorActivity, followUpActions, estimatedReach])

  useEffect(() => {
    if (state?.error) toast.error(state.error)
    if (state?.success) {
      try { localStorage.removeItem(DRAFT_KEY(eventId)) } catch {}
    }
  }, [state, eventId])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    fd.set('payload', JSON.stringify({
      overall:             overall             || undefined,
      wins:                wins                || undefined,
      challenges:          challenges          || undefined,
      product_feedback:    productFeedback     || undefined,
      competitor_activity: competitorActivity  || undefined,
      follow_up_actions:   followUpActions     || undefined,
      estimated_reach:     estimatedReach ? parseInt(estimatedReach) : undefined,
    }))
    action(fd)
  }

  // Success screen
  if (state?.success) {
    return (
      <div className="border rounded-xl bg-card p-8 flex flex-col items-center gap-4 text-center max-w-md mx-auto">
        <div className="h-14 w-14 rounded-full bg-green-50 flex items-center justify-center">
          <CheckCircle2 className="h-7 w-7 text-green-600" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Debrief saved</h3>
          <p className="text-sm text-muted-foreground">
            Your event debrief has been recorded and the ROI report is now generating in the background.
          </p>
        </div>
        <div className="flex gap-3 pt-2">
          <Link href="/dashboard/events" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            All events
          </Link>
          <Link href={`/dashboard/events/${eventId}`} className={cn(buttonVariants({ size: 'sm' }))}>
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            View event
          </Link>
        </div>
      </div>
    )
  }

  const fields: { label: string; hint: string; value: string; setter: (v: string) => void; rows?: number }[] = [
    { label: 'Overall, how did the event go?',         hint: 'Your honest assessment.',                                                   value: overall,            setter: setOverall,            rows: 3 },
    { label: 'Key wins',                               hint: 'What worked well? What exceeded expectations?',                             value: wins,               setter: setWins,               rows: 3 },
    { label: 'Key challenges',                         hint: 'What went wrong or was harder than expected?',                              value: challenges,         setter: setChallenges,         rows: 3 },
    { label: 'Product / service feedback heard',       hint: 'What did attendees say about the brand, product, or experience?',           value: productFeedback,    setter: setProductFeedback,    rows: 4 },
    { label: 'Competitor activity observed',           hint: 'Any competitor presence, messaging, or activity at or near the venue?',     value: competitorActivity, setter: setCompetitorActivity, rows: 3 },
    { label: 'Follow-up actions',                      hint: 'What needs to happen next? Lead nurture, follow-up calls, stock replenish?', value: followUpActions,    setter: setFollowUpActions,    rows: 3 },
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {fields.map(f => (
        <div key={f.label} className="border rounded-xl p-5 bg-card space-y-3">
          <div>
            <Label className="text-sm font-medium">{f.label}</Label>
            <p className="text-xs text-muted-foreground mt-0.5">{f.hint}</p>
          </div>
          <Textarea
            rows={f.rows ?? 3}
            value={f.value}
            onChange={e => f.setter(e.target.value)}
            placeholder="Write your notes here…"
            className="resize-none"
            disabled={pending}
          />
        </div>
      ))}

      <div className="border rounded-xl p-5 bg-card space-y-3">
        <div>
          <Label htmlFor="reach" className="text-sm font-medium">Estimated total reach</Label>
          <p className="text-xs text-muted-foreground mt-0.5">How many people do you estimate saw or interacted with the brand today?</p>
        </div>
        <Input
          id="reach"
          type="number"
          min={0}
          value={estimatedReach}
          onChange={e => setEstimatedReach(e.target.value)}
          placeholder="2000"
          className="max-w-xs"
          disabled={pending}
        />
      </div>

      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : existingDebrief ? 'Update debrief' : 'Save debrief & generate report'}
      </Button>
    </form>
  )
}
