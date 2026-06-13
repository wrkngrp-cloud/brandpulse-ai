'use client'

import { useActionState, useState, useRef } from 'react'
import { Button }         from '@/components/ui/button'
import { Input }          from '@/components/ui/input'
import { Label }          from '@/components/ui/label'
import { Textarea }       from '@/components/ui/textarea'
import { SuccessDialog }  from '@/components/ui/success-dialog'
import { cn }             from '@/lib/utils'
import { ChevronRight, ChevronLeft, Lock } from 'lucide-react'
import type { CampaignFormState } from '@/app/dashboard/campaigns/actions'

const OBJECTIVES = [
  { value: 'awareness',      label: 'Brand Awareness',   desc: 'Reach new audiences and build recognition' },
  { value: 'consideration',  label: 'Consideration',     desc: 'Drive research and evaluation of your brand' },
  { value: 'conversion',     label: 'Conversion',        desc: 'Generate leads, sales, or sign-ups' },
  { value: 'retention',      label: 'Retention',         desc: 'Strengthen loyalty and repeat engagement' },
]

const CHANNELS = [
  { value: 'ooh',     label: 'OOH / Outdoor',    built: true  },
  { value: 'events',  label: 'Events & Activations', built: true  },
  { value: 'digital', label: 'Digital',           built: false },
  { value: 'radio',   label: 'Radio',             built: false },
  { value: 'tv',      label: 'TV',                built: false },
  { value: 'print',   label: 'Print',             built: false },
]

interface CampaignFormProps {
  action: (prev: CampaignFormState, formData: FormData) => Promise<CampaignFormState>
}

export function CampaignForm({ action }: CampaignFormProps) {
  const [state, dispatch, pending] = useActionState(action, null)
  const [step, setStep]             = useState<1 | 2>(1)
  const [objective, setObjective]   = useState('')
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  const [channelBudgets, setChannelBudgets]     = useState<Record<string, string>>({})
  const formRef = useRef<HTMLFormElement>(null)

  function toggleChannel(ch: string) {
    setSelectedChannels(prev =>
      prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
    )
  }

  function handleNext(e: React.FormEvent) {
    e.preventDefault()
    const form = formRef.current
    if (!form) return
    const name = (form.elements.namedItem('name') as HTMLInputElement)?.value.trim()
    if (!name) return
    setStep(2)
  }

  const budgetedChannels = selectedChannels.filter(ch => channelBudgets[ch])
  const totalAllocated   = budgetedChannels.reduce((sum, ch) => sum + Number(channelBudgets[ch] || 0), 0)

  return (
    <>
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-6">
        <span className={cn('font-medium', step === 1 ? 'text-foreground' : '')}>
          1. Campaign Brief
        </span>
        <ChevronRight className="h-3 w-3" />
        <span className={cn('font-medium', step === 2 ? 'text-foreground' : '')}>
          2. Channels &amp; Budget
        </span>
      </div>

      <form ref={formRef} action={dispatch} className="space-y-5">
        {/* ── Step 1: Campaign Brief ── */}
        <div className={step === 1 ? 'space-y-5' : 'hidden'}>
          <div className="space-y-1.5">
            <Label htmlFor="name">Campaign name</Label>
            <Input id="name" name="name" placeholder="e.g. Q3 Awareness Push" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea id="description" name="description" placeholder="What is this campaign trying to achieve?" rows={2} className="resize-none" />
          </div>

          <div className="space-y-2">
            <Label>Objective</Label>
            <input type="hidden" name="objective" value={objective} />
            <div className="grid grid-cols-2 gap-2">
              {OBJECTIVES.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setObjective(o.value)}
                  className={cn(
                    'text-left border rounded-xl p-3 transition-colors',
                    objective === o.value
                      ? 'border-foreground bg-muted'
                      : 'hover:bg-muted/50'
                  )}
                >
                  <p className="text-sm font-medium">{o.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{o.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start_date">Start date</Label>
              <Input id="start_date" name="start_date" type="date" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end_date">End date <span className="text-muted-foreground font-normal">(blank = Always On)</span></Label>
              <Input id="end_date" name="end_date" type="date" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="total_budget">Total budget</Label>
              <Input id="total_budget" name="total_budget" type="number" min="0" step="1000" placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" name="currency" defaultValue="NGN" maxLength={3} className="uppercase" />
            </div>
          </div>

          <Button type="button" onClick={handleNext} className="w-full">
            Next: Channels &amp; Budget
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {/* ── Step 2: Channels & Budget ── */}
        <div className={step === 2 ? 'space-y-5' : 'hidden'}>
          {/* Hidden inputs so all form data submits together */}
          {selectedChannels.map(ch => (
            <input key={ch} type="hidden" name="channels" value={ch} />
          ))}
          <input
            type="hidden"
            name="channel_budgets"
            value={JSON.stringify(
              Object.fromEntries(
                Object.entries(channelBudgets).map(([k, v]) => [k, Number(v)])
              )
            )}
          />

          <div className="space-y-2">
            <Label>Select channels for this campaign</Label>
            <p className="text-xs text-muted-foreground">Choose the media channels this campaign will run across. Unbuilt channels will be available in a future update.</p>
            <div className="space-y-2 mt-3">
              {CHANNELS.map(ch => (
                <div
                  key={ch.value}
                  className={cn(
                    'border rounded-xl p-3 transition-colors',
                    !ch.built && 'opacity-50 cursor-not-allowed',
                    ch.built && selectedChannels.includes(ch.value) && 'border-foreground bg-muted',
                    ch.built && !selectedChannels.includes(ch.value) && 'hover:bg-muted/50 cursor-pointer',
                  )}
                  onClick={() => ch.built && toggleChannel(ch.value)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={cn(
                        'h-4 w-4 rounded border-2 flex items-center justify-center shrink-0',
                        selectedChannels.includes(ch.value) ? 'bg-foreground border-foreground' : 'border-muted-foreground',
                        !ch.built && 'border-muted',
                      )}>
                        {selectedChannels.includes(ch.value) && (
                          <svg className="h-2.5 w-2.5 text-background" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="text-sm font-medium">{ch.label}</span>
                    </div>
                    {!ch.built && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Lock className="h-3 w-3" />
                        Coming soon
                      </div>
                    )}
                  </div>

                  {/* Budget allocation field — only for selected built channels */}
                  {ch.built && selectedChannels.includes(ch.value) && (
                    <div className="mt-3 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <Label className="text-xs text-muted-foreground shrink-0">Budget allocation</Label>
                      <Input
                        type="number"
                        min="0"
                        step="1000"
                        placeholder="0"
                        value={channelBudgets[ch.value] ?? ''}
                        onChange={e => setChannelBudgets(prev => ({ ...prev, [ch.value]: e.target.value }))}
                        className="h-7 text-sm"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Budget summary */}
          {selectedChannels.length > 0 && totalAllocated > 0 && (
            <div className="border rounded-xl p-3 bg-muted/30 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total allocated</span>
                <span className="font-medium tabular-nums">NGN {totalAllocated.toLocaleString('en-NG')}</span>
              </div>
            </div>
          )}

          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Button type="submit" disabled={pending} className="flex-1">
              {pending ? 'Creating…' : 'Create campaign'}
            </Button>
          </div>
        </div>
      </form>

      <SuccessDialog
        open={!!(state?.success && state.campaignId)}
        title="Campaign created"
        description={state?.campaignName ? `"${state.campaignName}" is ready. Add OOH sites or events to it.` : undefined}
        viewHref={state?.campaignId ? `/dashboard/campaigns/${state.campaignId}` : '/dashboard/campaigns'}
        viewLabel="View campaign"
        closeHref="/dashboard/campaigns"
        closeLabel="All campaigns"
      />
    </>
  )
}
