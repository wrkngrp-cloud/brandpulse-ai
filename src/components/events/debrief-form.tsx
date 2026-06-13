'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast }      from 'sonner'
import { submitDebrief } from '@/app/dashboard/events/actions'
import { Button }     from '@/components/ui/button'
import { Input }      from '@/components/ui/input'
import { Label }      from '@/components/ui/label'
import { Textarea }   from '@/components/ui/textarea'

interface Props {
  eventId:         string
  existingDebrief: Record<string, unknown> | null
}

export function DebriefForm({ eventId, existingDebrief }: Props) {
  const router = useRouter()
  const bound = submitDebrief.bind(null, eventId)
  const [state, action, pending] = useActionState(bound, null)

  const init = (key: string) => (existingDebrief?.[key] as string | undefined) ?? ''

  const [overall,             setOverall           ] = useState(init('overall'))
  const [wins,                setWins              ] = useState(init('wins'))
  const [challenges,          setChallenges        ] = useState(init('challenges'))
  const [productFeedback,     setProductFeedback   ] = useState(init('product_feedback'))
  const [competitorActivity,  setCompetitorActivity] = useState(init('competitor_activity'))
  const [followUpActions,     setFollowUpActions   ] = useState(init('follow_up_actions'))
  const [estimatedReach,      setEstimatedReach    ] = useState(String(existingDebrief?.estimated_reach ?? ''))

  useEffect(() => {
    if (state?.success) {
      toast.success('Debrief saved. Generating your ROI report…')
      router.push(`/dashboard/events/${eventId}`)
      router.refresh()
    }
    if (state?.error) toast.error(state.error)
  }, [state, router, eventId])

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
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : existingDebrief ? 'Update debrief' : 'Save debrief & generate report'}
      </Button>
    </form>
  )
}
